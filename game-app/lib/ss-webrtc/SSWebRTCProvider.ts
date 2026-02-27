/**
 * SSWebRTCProvider: Main orchestrator for WebRTC signaling via Statement Store
 *
 * This is the primary interface for the ss-webrtc library. It coordinates:
 * - StatementStore: Blockchain read/write operations
 * - SignalingManager: Peer discovery and offer/answer exchange
 * - PeerManager: WebRTC connection management with audio/video
 *
 * Usage:
 *   const provider = new SSWebRTCProvider('room-id', config)
 *   await provider.connect()
 *   provider.broadcast(data)
 *   await provider.disconnect()
 */

import { PeerManager } from './PeerManager'
import { SignalingManager } from './SignalingManager'
import { StatementStore } from './StatementStore'
import { TurnCredentials } from './TurnCredentials'
import {
  isOfferer,
  type ConnectionStatus,
  type LogType,
  type SSWebRTCConfig
} from './types'

export class SSWebRTCProvider {
  private documentId: string
  private peerId: string
  private config: SSWebRTCConfig

  private store: StatementStore
  private signaling: SignalingManager
  private peerManager: PeerManager
  private turnCredentials: TurnCredentials

  private status: ConnectionStatus = 'disconnected'

  // Local media stream for video conferencing
  private localStream: MediaStream | null = null

  // Track peers we're currently connecting to (to avoid duplicate attempts)
  private connectingPeers: Set<string> = new Set()

  // Retry management
  private readonly MAX_RETRIES = 3
  private retryAttempts: Map<string, number> = new Map()
  private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  constructor(documentId: string, config: SSWebRTCConfig) {
    this.documentId = documentId
    this.peerId = config.peerId
    this.config = config

    const onLog = config.onLog || (() => {})

    // Initialize TURN credentials
    this.turnCredentials = new TurnCredentials(
      config.turnKeyId || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_TURN_KEY_ID : '') || '',
      config.turnApiToken || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_TURN_API_TOKEN : '') || ''
    )

    // Initialize statement store
    this.store = new StatementStore({
      endpoint: config.substrateEndpoint,
      documentId,
      account: config.account,
      keyType: config.keyType,
      signingMode: config.signingMode,
      mnemonic: config.mnemonic,
      externalSigner: config.externalSigner,
      onLog
    })

    // Initialize peer manager
    this.peerManager = new PeerManager(this.turnCredentials, {
      onConnect: this.handlePeerConnect.bind(this),
      onClose: this.handlePeerClose.bind(this),
      onError: this.handlePeerError.bind(this),
      onData: this.handlePeerData.bind(this),
      onStream: this.handlePeerStream.bind(this),
      onOfferReady: this.handleOfferReady.bind(this),
      onAnswerReady: this.handleAnswerReady.bind(this),
      onLog
    })

    // Initialize signaling manager
    this.signaling = new SignalingManager({
      store: this.store,
      documentId,
      peerId: this.peerId,
      username: config.username,
      presenceTtl: config.presenceTtl || 5000,
      pollInterval: config.pollInterval || 100,
      events: {
        onPeerDiscovered: this.handlePeerDiscovered.bind(this),
        onPeerExpired: this.handlePeerExpired.bind(this),
        onOfferReceived: this.handleOfferReceived.bind(this),
        onAnswerReceived: this.handleAnswerReceived.bind(this),
        onLog
      }
    })
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status
  }

  /**
   * Get peer ID
   */
  getPeerId(): string {
    return this.peerId
  }

  /**
   * Get room ID
   */
  getDocumentId(): string {
    return this.documentId
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): string[] {
    return this.peerManager.getConnectedPeers()
  }

  /**
   * Get current epoch
   */
  getEpoch(): number {
    return this.signaling.getEpoch()
  }

  /**
   * Get the peer manager for direct access
   */
  getPeerManager(): PeerManager {
    return this.peerManager
  }

  /**
   * Set local media stream for video conferencing
   * Call this before connect() to include media in initial offers
   */
  setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream
    this.log(`Local stream ${stream ? 'set' : 'cleared'}`, 'info')
  }

  /**
   * Get local media stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /**
   * Connect to the network
   */
  async connect(): Promise<void> {
    if (this.status !== 'disconnected') {
      throw new Error('Already connected or connecting')
    }

    this.setStatus('connecting', 'Connecting to Substrate...')

    try {
      // Connect to blockchain
      await this.store.connect()

      // Start signaling (presence, polling)
      await this.signaling.start()

      this.setStatus('connected', `Connected as ${this.peerId}`)
      this.log(`Connected to room: ${this.documentId}`, 'success')
    } catch (error) {
      this.setStatus('disconnected', 'Connection failed')
      throw error
    }
  }

  /**
   * Disconnect from the network
   */
  async disconnect(): Promise<void> {
    this.log('Disconnecting...', 'info')

    // Clear retry timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer)
    }
    this.retryTimers.clear()
    this.retryAttempts.clear()
    this.connectingPeers.clear()

    // Stop signaling
    this.signaling.stop()

    // Close all peer connections
    this.peerManager.closeAll()

    // Disconnect from blockchain
    this.store.disconnect()

    this.setStatus('disconnected', 'Disconnected')
  }

  /**
   * Send data to a specific peer via data channel
   */
  send(peerId: string, data: Uint8Array | string): boolean {
    return this.peerManager.send(peerId, data)
  }

  /**
   * Broadcast data to all connected peers via data channel
   */
  broadcast(data: Uint8Array | string): void {
    this.peerManager.broadcast(data)
  }

  // ============================================================================
  // Signaling Event Handlers
  // ============================================================================

  /**
   * Handle peer discovery via presence channel
   */
  private async handlePeerDiscovered(peerId: string, username?: string): Promise<void> {
    this.log(`Peer discovered: ${username || peerId}`, 'info')

    // Skip if already connected or connecting
    if (this.peerManager.hasPeer(peerId) || this.connectingPeers.has(peerId)) {
      return
    }

    // Determine who should create the offer
    if (isOfferer(this.peerId, peerId)) {
      this.log(`We are offerer for ${peerId}`, 'info')
      await this.createOffer(peerId)
    } else {
      this.log(`Waiting for offer from ${peerId}`, 'info')
    }
  }

  /**
   * Handle peer expiration
   */
  private handlePeerExpired(peerId: string): void {
    this.log(`Peer expired: ${peerId}`, 'warning')
    this.connectingPeers.delete(peerId)
    const timer = this.retryTimers.get(peerId)
    if (timer) {
      clearTimeout(timer)
      this.retryTimers.delete(peerId)
    }
    this.retryAttempts.delete(peerId)

    if (this.peerManager.hasPeer(peerId)) {
      this.peerManager.closePeer(peerId)
    }
    this.config.onPeerExpired?.(peerId)
  }

  /**
   * Handle incoming offer
   */
  private async handleOfferReceived(from: string, sdp: string, _epoch: number): Promise<void> {
    this.log(`Handling offer from ${from}`, 'info')

    // Accept the offer and create an answer
    await this.peerManager.handleOffer(from, sdp, this.localStream, this.config.forceRelay)
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswerReceived(from: string, sdp: string, _epoch: number): Promise<void> {
    this.log(`Handling answer from ${from}`, 'info')
    await this.peerManager.handleAnswer(from, sdp)
  }

  /**
   * Create an offer for a peer
   */
  private async createOffer(peerId: string): Promise<void> {
    this.connectingPeers.add(peerId)

    try {
      await this.peerManager.createOffer(peerId, this.localStream, this.config.forceRelay)
    } catch (error) {
      this.log(`Offer creation failed for ${peerId}: ${error}`, 'error')
      this.handleConnectionFailure(peerId)
    }
  }

  /**
   * Handle connection failure and retry if needed
   */
  private handleConnectionFailure(peerId: string): void {
    const attempts = this.retryAttempts.get(peerId) || 0

    if (attempts < this.MAX_RETRIES) {
      this.retryAttempts.set(peerId, attempts + 1)
      this.log(`Retrying connection to ${peerId} (attempt ${attempts + 1})`, 'warning')

      const timer = setTimeout(() => {
        this.retryTimers.delete(peerId)
        this.createOffer(peerId)
      }, 2000)

      this.retryTimers.set(peerId, timer)
    } else {
      this.log(`Max retries reached for ${peerId}`, 'error')
      this.connectingPeers.delete(peerId)
      this.retryAttempts.delete(peerId)
    }
  }

  // ============================================================================
  // Peer Manager Event Handlers
  // ============================================================================

  private handlePeerConnect(peerId: string): void {
    this.log(`Connected to peer: ${peerId}`, 'success')
    this.connectingPeers.delete(peerId)
    this.retryAttempts.delete(peerId)
    this.config.onPeerConnect?.(peerId)
  }

  private handlePeerClose(peerId: string): void {
    this.log(`Peer connection closed: ${peerId}`, 'warning')
    this.connectingPeers.delete(peerId)
    this.retryAttempts.delete(peerId)
    this.config.onPeerDisconnect?.(peerId)
  }

  private handlePeerError(peerId: string, error: Error): void {
    this.log(`Peer error (${peerId}): ${error.message}`, 'error')
    this.handleConnectionFailure(peerId)
  }

  private handlePeerData(peerId: string, data: Uint8Array): void {
    this.config.onData?.(peerId, data)
  }

  private handlePeerStream(peerId: string, stream: MediaStream): void {
    this.config.onStream?.(peerId, stream)
  }

  private handleOfferReady(peerId: string, sdp: string): void {
    this.signaling.sendOffer(peerId, sdp)
  }

  private handleAnswerReady(peerId: string, sdp: string): void {
    this.signaling.sendAnswer(peerId, sdp)
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private setStatus(status: ConnectionStatus, message: string): void {
    this.status = status
    this.config.onStatus?.(status, message)
    this.log(message, status === 'connected' ? 'success' : 'info')
  }

  private log(message: string, type: LogType): void {
    this.config.onLog?.(message, type)
  }
}
