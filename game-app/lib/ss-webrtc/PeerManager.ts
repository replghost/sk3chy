/**
 * PeerManager: WebRTC peer connection management with non-trickle ICE
 *
 * Implements WebRTC connections where ICE candidates are embedded in the SDP.
 * This means we wait for ICE gathering to complete before sending offers/answers.
 *
 * Supports both data channels and media streams for video conferencing.
 */

import { TurnCredentials } from './TurnCredentials'
import type { LogType } from './types'

export interface PeerEvents {
  /** Called when a connection is established */
  onConnect: (peerId: string) => void
  /** Called when a connection is closed */
  onClose: (peerId: string) => void
  /** Called when an error occurs */
  onError: (peerId: string, error: Error) => void
  /** Called when data is received via data channel */
  onData: (peerId: string, data: Uint8Array) => void
  /** Called when a remote media stream is received */
  onStream: (peerId: string, stream: MediaStream) => void
  /** Called when an offer SDP is ready to send */
  onOfferReady: (peerId: string, sdp: string) => void
  /** Called when an answer SDP is ready to send */
  onAnswerReady: (peerId: string, sdp: string) => void
  /** Logging callback */
  onLog: (message: string, type: LogType) => void
}

interface PeerConnection {
  pc: RTCPeerConnection
  dc: RTCDataChannel | null
  role: 'offerer' | 'answerer'
  connected: boolean
  createdAt: number
  localStream?: MediaStream
  disconnectTimer?: ReturnType<typeof setTimeout>
}

/**
 * PeerManager handles WebRTC connections using non-trickle ICE.
 *
 * Non-trickle ICE means:
 * - ICE candidates are gathered before sending SDP
 * - Offers/answers contain all ICE candidates embedded
 * - SDP is sent exactly once per connection attempt
 */
export class PeerManager {
  private turnCredentials: TurnCredentials
  private events: PeerEvents

  // Active peer connections
  private peers: Map<string, PeerConnection> = new Map()

  // ICE gathering timeout (10 seconds - shorter to avoid stale connections)
  private readonly ICE_GATHERING_TIMEOUT = 10000

  constructor(turnCredentials: TurnCredentials, events: PeerEvents) {
    this.turnCredentials = turnCredentials
    this.events = events
  }

  /**
   * Get connected peer IDs
   */
  getConnectedPeers(): string[] {
    const connected: string[] = []
    for (const [peerId, conn] of this.peers) {
      if (conn.connected) {
        connected.push(peerId)
      }
    }
    return connected
  }

  /**
   * Check if we have a connection with a peer
   */
  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId)
  }

  /**
   * Check if a peer is connected
   */
  isConnected(peerId: string): boolean {
    const conn = this.peers.get(peerId)
    return conn?.connected ?? false
  }

  /**
   * Get a peer connection
   */
  getPeer(peerId: string): PeerConnection | undefined {
    return this.peers.get(peerId)
  }

  /**
   * Create an offer for a peer (we are the offerer)
   *
   * This implements the Offer Creation Algorithm:
   * 1. Create RTCPeerConnection with STUN+TURN config
   * 2. Add local media tracks (if provided)
   * 3. Create data channel
   * 4. Create offer and set local description
   * 5. Wait for ICE gathering to complete
   * 6. Return the complete SDP with embedded ICE candidates
   */
  async createOffer(peerId: string, localStream?: MediaStream, forceRelay: boolean = false): Promise<void> {
    if (this.peers.has(peerId)) {
      this.events.onLog(`Connection to ${peerId} already exists`, 'warning')
      return
    }

    if (forceRelay) {
      this.events.onLog(`Creating offer for ${peerId} (TURN relay mode)`, 'info')
    } else {
      this.events.onLog(`Creating offer for ${peerId}`, 'info')
    }

    const iceServers = await this.turnCredentials.getIceServers()

    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
      ...(forceRelay && { iceTransportPolicy: 'relay' })
    })

    // Add local media tracks if provided
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream)
        this.events.onLog(`Added ${track.kind} track to offer`, 'info')
      })
    }

    // Create data channel (offerer creates the channel)
    const dc = pc.createDataChannel('data', {
      ordered: true
    })

    const conn: PeerConnection = {
      pc,
      dc,
      role: 'offerer',
      connected: false,
      createdAt: Date.now(),
      localStream
    }

    this.peers.set(peerId, conn)
    this.setupPeerConnectionEvents(peerId, pc)
    this.setupDataChannelEvents(peerId, dc)

    try {
      // Create and set local description
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering to complete
      const completeSdp = await this.waitForIceGathering(pc)

      this.events.onLog(`Offer ready for ${peerId}`, 'success')
      this.events.onOfferReady(peerId, completeSdp)
    } catch (error) {
      this.events.onLog(`Failed to create offer for ${peerId}: ${error}`, 'error')
      this.cleanupPeer(peerId)
      throw error
    }
  }

  /**
   * Handle an incoming offer and create an answer (we are the answerer)
   *
   * This implements the Answer Creation Algorithm:
   * 1. Create RTCPeerConnection with STUN+TURN config
   * 2. Add local media tracks (if provided)
   * 3. Set remote description with the offer SDP
   * 4. Create answer and set local description
   * 5. Wait for ICE gathering to complete
   * 6. Return the complete SDP with embedded ICE candidates
   */
  async handleOffer(peerId: string, offerSdp: string, localStream?: MediaStream, forceRelay: boolean = false): Promise<void> {
    // If we already have a connection, ignore
    if (this.peers.has(peerId)) {
      const existing = this.peers.get(peerId)!
      if (existing.connected) {
        this.events.onLog(`Already connected to ${peerId}, ignoring offer`, 'info')
        return
      }
      // If we have a pending connection, clean it up and accept the new offer
      this.cleanupPeer(peerId)
    }

    if (forceRelay) {
      this.events.onLog(`Handling offer from ${peerId} (TURN relay mode)`, 'info')
    } else {
      this.events.onLog(`Handling offer from ${peerId}`, 'info')
    }

    const iceServers = await this.turnCredentials.getIceServers()

    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
      ...(forceRelay && { iceTransportPolicy: 'relay' })
    })

    // Add local media tracks if provided
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream)
        this.events.onLog(`Added ${track.kind} track to answer`, 'info')
      })
    }

    const conn: PeerConnection = {
      pc,
      dc: null, // Will be set when data channel is received
      role: 'answerer',
      connected: false,
      createdAt: Date.now(),
      localStream
    }

    this.peers.set(peerId, conn)
    this.setupPeerConnectionEvents(peerId, pc)

    // Answerer receives data channel from offerer
    pc.ondatachannel = (event) => {
      const dc = event.channel
      conn.dc = dc
      this.setupDataChannelEvents(peerId, dc)
    }

    try {
      // Set remote description (the offer)
      await pc.setRemoteDescription({
        type: 'offer',
        sdp: offerSdp
      })

      // Create and set local description (the answer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      // Wait for ICE gathering to complete
      const completeSdp = await this.waitForIceGathering(pc)

      this.events.onLog(`Answer ready for ${peerId}`, 'success')
      this.events.onAnswerReady(peerId, completeSdp)
    } catch (error) {
      this.events.onLog(`Failed to handle offer from ${peerId}: ${error}`, 'error')
      this.cleanupPeer(peerId)
      throw error
    }
  }

  /**
   * Handle an incoming answer (we are the offerer)
   */
  async handleAnswer(peerId: string, answerSdp: string): Promise<void> {
    const conn = this.peers.get(peerId)
    if (!conn || conn.role !== 'offerer') {
      this.events.onLog(`No offerer connection found for ${peerId}`, 'warning')
      return
    }

    if (conn.pc.signalingState !== 'have-local-offer') {
      this.events.onLog(
        `Ignoring answer from ${peerId}: signaling state is ${conn.pc.signalingState}`,
        'warning'
      )
      return
    }

    try {
      await conn.pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      })

      this.events.onLog(`Answer applied for ${peerId}`, 'success')
    } catch (error: any) {
      const msg = error?.message || String(error)
      if (msg.includes('Peer connection is closed')) {
        this.events.onLog(`Ignoring answer from ${peerId}: peer connection already closed`, 'warning')
        this.cleanupPeer(peerId)
        return
      }
      this.events.onLog(`Failed to apply answer from ${peerId}: ${error}`, 'error')
      this.cleanupPeer(peerId)
      throw error
    }
  }

  /**
   * Send data to a peer via data channel
   */
  send(peerId: string, data: Uint8Array | string): boolean {
    const conn = this.peers.get(peerId)
    if (!conn || !conn.dc || conn.dc.readyState !== 'open') {
      return false
    }

    try {
      conn.dc.send(data)
      return true
    } catch (error) {
      this.events.onLog(`Failed to send data to ${peerId}: ${error}`, 'error')
      return false
    }
  }

  /**
   * Broadcast data to all connected peers via data channel
   */
  broadcast(data: Uint8Array | string): void {
    for (const [peerId, conn] of this.peers) {
      if (conn.dc && conn.dc.readyState === 'open') {
        try {
          conn.dc.send(data)
        } catch (error) {
          this.events.onLog(`Failed to broadcast to ${peerId}: ${error}`, 'warning')
        }
      }
    }
  }

  /**
   * Close connection to a peer
   */
  closePeer(peerId: string): void {
    this.cleanupPeer(peerId)
  }

  /**
   * Close all peer connections
   */
  closeAll(): void {
    for (const [peerId] of this.peers) {
      this.cleanupPeer(peerId)
    }
    this.peers.clear()
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  /**
   * Wait for ICE gathering to complete and return the full SDP
   */
  private waitForIceGathering(pc: RTCPeerConnection): Promise<string> {
    return new Promise((resolve, reject) => {
      let resolved = false
      let candidateCount = 0

      const finish = (reason: string) => {
        if (resolved) return
        resolved = true
        clearTimeout(quickTimeout)
        clearTimeout(fullTimeout)
        pc.removeEventListener('icegatheringstatechange', onGatheringState)
        pc.removeEventListener('icecandidate', onIceCandidate)

        const sdp = pc.localDescription?.sdp
        if (!sdp) {
          reject(new Error('ICE gathering failed - no local description'))
          return
        }

        this.events.onLog(`ICE gathering finished (${reason}) with ${candidateCount} candidates`, 'info')
        resolve(sdp)
      }

      // Already complete: return immediately.
      if (pc.iceGatheringState === 'complete') {
        finish('already complete')
        return
      }

      // If we have candidates quickly, proceed without waiting full timeout.
      const quickTimeout = setTimeout(() => {
        if (candidateCount > 0) {
          finish('quick timeout with candidates')
        }
      }, 3000)

      // Full timeout fallback: send best-effort SDP instead of failing hard.
      const fullTimeout = setTimeout(() => {
        finish('full timeout')
      }, this.ICE_GATHERING_TIMEOUT)

      const onGatheringState = () => {
        if (pc.iceGatheringState === 'complete') {
          finish('gathering complete')
        }
      }

      const onIceCandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          candidateCount++
          return
        }
        // Null candidate = end of gathering.
        finish('null candidate')
      }

      pc.addEventListener('icegatheringstatechange', onGatheringState)
      pc.addEventListener('icecandidate', onIceCandidate)
    })
  }

  /**
   * Setup event handlers for RTCPeerConnection
   */
  private setupPeerConnectionEvents(peerId: string, pc: RTCPeerConnection): void {
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      this.events.onLog(`ICE connection state for ${peerId}: ${state}`, 'info')

      if (state === 'failed') {
        this.handleConnectionFailure(peerId, state)
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      this.events.onLog(`Connection state for ${peerId}: ${state}`, 'info')

      if (state === 'failed' || state === 'closed') {
        this.handleConnectionFailure(peerId, state)
      }
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) {
        this.events.onStream(peerId, stream)
      }
    }
  }

  /**
   * Setup event handlers for RTCDataChannel
   */
  private setupDataChannelEvents(peerId: string, dc: RTCDataChannel): void {
    dc.onopen = () => {
      this.events.onLog(`DataChannel opened with ${peerId}`, 'success')

      const conn = this.peers.get(peerId)
      if (conn && !conn.connected) {
        conn.connected = true
        this.events.onConnect(peerId)
      }
    }

    dc.onclose = () => {
      this.events.onLog(`DataChannel closed with ${peerId}`, 'warning')
      this.handleConnectionFailure(peerId, 'datachannel-closed')
    }

    dc.onerror = () => {
      this.events.onLog(`DataChannel error with ${peerId}`, 'error')
      this.events.onError(peerId, new Error('DataChannel error'))
    }

    dc.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.events.onData(peerId, new Uint8Array(event.data))
      } else if (typeof event.data === 'string') {
        this.events.onData(peerId, new TextEncoder().encode(event.data))
      }
    }

    // Set binary type
    dc.binaryType = 'arraybuffer'
  }

  /**
   * Handle connection failure
   */
  private handleConnectionFailure(peerId: string, _reason: string): void {
    const conn = this.peers.get(peerId)
    if (!conn) return

    const wasConnected = conn.connected

    this.cleanupPeer(peerId)

    if (wasConnected) {
      this.events.onClose(peerId)
    }
  }

  /**
   * Cleanup a peer connection
   */
  private cleanupPeer(peerId: string): void {
    const conn = this.peers.get(peerId)
    if (!conn) return

    if (conn.disconnectTimer) {
      clearTimeout(conn.disconnectTimer)
      conn.disconnectTimer = undefined
    }

    try {
      conn.dc?.close()
      conn.pc.close()
    } catch {
      // ignore close errors
    }

    this.peers.delete(peerId)
  }
}
