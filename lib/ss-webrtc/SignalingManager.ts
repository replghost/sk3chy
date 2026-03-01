/**
 * SignalingManager: WebRTC signaling via statement store channels
 *
 * Implements the signaling protocol using single-writer channels:
 * - presence/peer-{peerId}: Peer discovery (written by owner)
 * - epochs/peer-{peerId}: Epoch tracking (written by owner)
 * - offers/from-{A}-to-{B}: Offer SDP (written by offerer A)
 * - answers/from-{B}-to-{A}: Answer SDP (written by answerer B)
 */

import { StatementStore } from './StatementStore'
import {
  getAnswerChannel,
  getEpochChannel,
  getOfferChannel,
  getPresenceChannel,
  isOfferer,
  isPresenceExpired,
  type AnswerValue,
  type EpochValue,
  type LogType,
  type OfferValue,
  type PresenceValue
} from './types'

export interface SignalingEvents {
  /** Called when a new peer is discovered via presence */
  onPeerDiscovered: (peerId: string, username?: string) => void | Promise<void>
  /** Called when a peer's presence expires */
  onPeerExpired: (peerId: string) => void | Promise<void>
  /** Called when an offer is received (we are the answerer) */
  onOfferReceived: (from: string, sdp: string, epoch: number) => void | Promise<void>
  /** Called when an answer is received (we are the offerer) */
  onAnswerReceived: (from: string, sdp: string, epoch: number) => void | Promise<void>
  /** Logging callback */
  onLog: (message: string, type: LogType) => void
}

export interface SignalingConfig {
  store: StatementStore
  documentId: string
  peerId: string
  username?: string
  presenceTtl: number
  pollInterval: number
  events: SignalingEvents
}

/**
 * SignalingManager coordinates peer discovery and WebRTC signaling.
 *
 * Global invariants maintained:
 * 1. Single-writer rule: Each channel is written only by its owner
 * 2. Deterministic offerer: Lower peerId always sends offer
 * 3. Epoch monotonicity: Stale data is ignored via epoch comparison
 * 4. Idempotent signaling: Rewriting with newer data is safe
 */
export class SignalingManager {
  private store: StatementStore
  private documentId: string
  private peerId: string
  private username?: string
  private presenceTtl: number
  private pollInterval: number
  private events: SignalingEvents

  // Our current epoch (increments on restart)
  private epoch: number

  // Known peer epochs (for validating offers/answers)
  private peerEpochs: Map<string, number> = new Map()

  // Known peers from presence (peerId -> PresenceValue)
  private knownPeers: Map<string, PresenceValue> = new Map()

  // Processed offers/answers (to avoid duplicate handling)
  private processedOffers: Set<string> = new Set()
  private processedAnswers: Set<string> = new Set()

  // Polling state
  private polling: boolean = false
  private presenceInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: SignalingConfig) {
    this.store = config.store
    this.documentId = config.documentId
    this.peerId = config.peerId
    this.username = config.username
    this.presenceTtl = config.presenceTtl
    this.pollInterval = config.pollInterval
    this.events = config.events

    // Initialize epoch (timestamp-based for ordering)
    this.epoch = Date.now()
  }

  /**
   * Get our current epoch
   */
  getEpoch(): number {
    return this.epoch
  }

  /**
   * Get known peers
   */
  getKnownPeers(): string[] {
    return Array.from(this.knownPeers.keys())
  }

  /**
   * Check if we should be the offerer for a peer
   */
  shouldOffer(otherPeerId: string): boolean {
    return isOfferer(this.peerId, otherPeerId)
  }

  /**
   * Start the signaling manager
   */
  async start(): Promise<void> {
    // Publish our epoch
    await this.publishEpoch()

    // Publish initial presence
    await this.publishPresence()

    // Start presence heartbeat
    this.startPresenceHeartbeat()

    // Start polling
    this.startPolling()

    this.events.onLog('Signaling manager started', 'success')
  }

  /**
   * Stop the signaling manager
   */
  stop(): void {
    this.polling = false

    if (this.presenceInterval) {
      clearInterval(this.presenceInterval)
      this.presenceInterval = null
    }

    this.knownPeers.clear()
    this.peerEpochs.clear()
    this.processedOffers.clear()
    this.processedAnswers.clear()

    this.events.onLog('Signaling manager stopped', 'info')
  }

  /**
   * Publish our presence to the presence channel
   */
  async publishPresence(): Promise<boolean> {
    const channel = getPresenceChannel(this.documentId, this.peerId)
    const value: PresenceValue = {
      type: 'presence',
      peerId: this.peerId,
      epoch: this.epoch,
      timestamp: Date.now(),
      ttl: this.presenceTtl,
      username: this.username
    }

    try {
      const result = await this.store.write(channel, value)
      if (!result) {
        // Presence write failed, but this is non-critical - don't crash
        this.events.onLog('Presence write failed (non-critical)', 'warning')
      }
      return result
    } catch (error) {
      // Network errors during presence updates are non-critical
      const msg = error instanceof Error ? error.message : 'Unknown error'
      this.events.onLog(`Presence write error (non-critical): ${msg}`, 'warning')
      return false
    }
  }

  /**
   * Publish our epoch to the epoch channel
   */
  async publishEpoch(): Promise<boolean> {
    const channel = getEpochChannel(this.documentId, this.peerId)
    const value: EpochValue = {
      type: 'epoch',
      peerId: this.peerId,
      epoch: this.epoch,
      timestamp: Date.now()
    }

    return this.store.write(channel, value)
  }

  /**
   * Send an offer to a peer
   *
   * Precondition: We are the offerer (our peerId < otherPeerId)
   */
  async sendOffer(to: string, sdp: string): Promise<boolean> {
    if (!isOfferer(this.peerId, to)) {
      this.events.onLog(`Cannot send offer to ${to}: we are not the offerer`, 'error')
      return false
    }

    const channel = getOfferChannel(this.documentId, this.peerId, to)
    const value: OfferValue = {
      type: 'offer',
      from: this.peerId,
      to,
      epoch: this.epoch,
      sdp,
      timestamp: Date.now()
    }

    this.events.onLog(`Sending offer to ${to}`, 'blockchain')
    return this.store.write(channel, value)
  }

  /**
   * Send an answer to a peer
   *
   * Precondition: We are the answerer (our peerId > otherPeerId)
   */
  async sendAnswer(to: string, sdp: string): Promise<boolean> {
    if (isOfferer(this.peerId, to)) {
      this.events.onLog(`Cannot send answer to ${to}: we are not the answerer`, 'error')
      return false
    }

    const channel = getAnswerChannel(this.documentId, this.peerId, to)
    const value: AnswerValue = {
      type: 'answer',
      from: this.peerId,
      to,
      epoch: this.epoch,
      sdp,
      timestamp: Date.now()
    }

    this.events.onLog(`Sending answer to ${to}`, 'blockchain')
    return this.store.write(channel, value)
  }

  /**
   * Start the presence heartbeat
   */
  private startPresenceHeartbeat(): void {
    if (this.presenceInterval) return

    // Publish presence at half the TTL to ensure continuous visibility
    const interval = Math.max(this.presenceTtl / 2, 1000)

    this.presenceInterval = setInterval(() => {
      this.publishPresence()
    }, interval)

    this.events.onLog(`Presence heartbeat started (every ${interval}ms)`, 'info')
  }

  /**
   * Start polling for peer discovery and signaling messages
   */
  private startPolling(): void {
    if (this.polling) return
    this.polling = true

    this.pollLoop()
    this.events.onLog(`Polling started (every ${this.pollInterval}ms)`, 'info')
  }

  /**
   * Main polling loop
   */
  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        await this.pollPresences()
        await this.pollEpochs()
        await this.pollOffers()
        await this.pollAnswers()
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        this.events.onLog(`Polling error: ${msg}`, 'error')
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollInterval))
    }
  }

  /**
   * Poll for peer presences
   */
  private async pollPresences(): Promise<void> {
    const presences = await this.store.readPresences()
    const now = Date.now()
    const currentPeers = new Set<string>()

    for (const [, value] of presences) {
      if (value.type !== 'presence') continue
      if (value.peerId === this.peerId) continue

      const presence = value as PresenceValue

      // Check if presence has expired
      if (isPresenceExpired(presence, now)) {
        // If we knew this peer, notify expiration
        if (this.knownPeers.has(presence.peerId)) {
          this.knownPeers.delete(presence.peerId)
          await this.events.onPeerExpired(presence.peerId)
        }
        continue
      }

      currentPeers.add(presence.peerId)

      // Check if this is a new peer
      const existingPresence = this.knownPeers.get(presence.peerId)
      if (!existingPresence) {
        this.knownPeers.set(presence.peerId, presence)
        this.events.onLog(`Discovered peer: ${presence.username || presence.peerId}`, 'success')
        await this.events.onPeerDiscovered(presence.peerId, presence.username)
      } else if (presence.timestamp > existingPresence.timestamp) {
        // Update with newer presence
        this.knownPeers.set(presence.peerId, presence)
      }
    }

    // Check for expired peers that are no longer in the presence list
    for (const [peerId] of this.knownPeers) {
      if (!currentPeers.has(peerId)) {
        const presence = this.knownPeers.get(peerId)
        if (presence && isPresenceExpired(presence, now)) {
          this.knownPeers.delete(peerId)
          await this.events.onPeerExpired(peerId)
        }
      }
    }
  }

  /**
   * Poll for peer epochs
   */
  private async pollEpochs(): Promise<void> {
    const epochs = await this.store.readEpochs()

    for (const [, value] of epochs) {
      if (value.type !== 'epoch') continue
      if (value.peerId === this.peerId) continue

      const epochValue = value as EpochValue
      const existingEpoch = this.peerEpochs.get(epochValue.peerId)

      if (!existingEpoch || epochValue.epoch > existingEpoch) {
        this.peerEpochs.set(epochValue.peerId, epochValue.epoch)

        // If epoch increased, clear processed offers/answers for this peer
        // (they may have restarted)
        if (existingEpoch && epochValue.epoch > existingEpoch) {
          this.clearProcessedForPeer(epochValue.peerId)
          this.events.onLog(`Peer ${epochValue.peerId} epoch increased to ${epochValue.epoch}`, 'info')
        }
      }
    }
  }

  /**
   * Poll for offers addressed to us
   */
  private async pollOffers(): Promise<void> {
    const offers = await this.store.readOffers()

    for (const [, value] of offers) {
      if (value.type !== 'offer') continue

      const offer = value as OfferValue

      // Only process offers addressed to us
      if (offer.to !== this.peerId) continue

      // We should be the answerer (higher peerId)
      if (isOfferer(this.peerId, offer.from)) continue

      // Check for duplicate processing
      const processKey = `${offer.from}:${offer.epoch}:${offer.timestamp}`
      if (this.processedOffers.has(processKey)) continue

      // Validate epoch
      const peerEpoch = this.peerEpochs.get(offer.from)
      if (peerEpoch && offer.epoch < peerEpoch) {
        this.events.onLog(`Ignoring stale offer from ${offer.from} (epoch ${offer.epoch} < ${peerEpoch})`, 'warning')
        continue
      }

      // Mark as processed
      this.processedOffers.add(processKey)

      this.events.onLog(`Received offer from ${offer.from}`, 'blockchain')
      await this.events.onOfferReceived(offer.from, offer.sdp, offer.epoch)
    }
  }

  /**
   * Poll for answers addressed to us
   */
  private async pollAnswers(): Promise<void> {
    const answers = await this.store.readAnswers()

    for (const [, value] of answers) {
      if (value.type !== 'answer') continue

      const answer = value as AnswerValue

      // Only process answers addressed to us
      if (answer.to !== this.peerId) continue

      // We should be the offerer (lower peerId)
      if (!isOfferer(this.peerId, answer.from)) continue

      // Check for duplicate processing
      const processKey = `${answer.from}:${answer.epoch}:${answer.timestamp}`
      if (this.processedAnswers.has(processKey)) continue

      // Validate epoch
      const peerEpoch = this.peerEpochs.get(answer.from)
      if (peerEpoch && answer.epoch < peerEpoch) {
        this.events.onLog(`Ignoring stale answer from ${answer.from} (epoch ${answer.epoch} < ${peerEpoch})`, 'warning')
        continue
      }

      // Mark as processed
      this.processedAnswers.add(processKey)

      this.events.onLog(`Received answer from ${answer.from}`, 'blockchain')
      await this.events.onAnswerReceived(answer.from, answer.sdp, answer.epoch)
    }
  }

  /**
   * Clear processed offers/answers for a peer (when their epoch changes)
   */
  private clearProcessedForPeer(peerId: string): void {
    const toRemove: string[] = []

    for (const key of this.processedOffers) {
      if (key.startsWith(`${peerId}:`)) {
        toRemove.push(key)
      }
    }
    for (const key of toRemove) {
      this.processedOffers.delete(key)
    }

    toRemove.length = 0
    for (const key of this.processedAnswers) {
      if (key.startsWith(`${peerId}:`)) {
        toRemove.push(key)
      }
    }
    for (const key of toRemove) {
      this.processedAnswers.delete(key)
    }
  }
}
