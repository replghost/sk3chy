import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { createStatementSdk, getStatementSigner, stringToTopic, type Statement } from '@polkadot-api/sdk-statement'
import { getStatementStore, type HostStatementStore, type SignedStatement as HostSignedStatement, type Statement as HostStatement } from '@parity/product-sdk-host'

type ProviderEvent = 'status' | 'peers'
type EventHandler = (event: any) => void

type DirectSigner = {
  publicKey: Uint8Array
  sign: (payload: Uint8Array) => Uint8Array | Promise<Uint8Array>
}

export interface StatementStoreCrdtProviderConfig {
  statementStoreEndpoint?: string
  pollInterval?: number
  presenceTtl?: number
  localSigner?: DirectSigner | null
  onLog?: (message: string, type: string) => void
}

type CrdtEnvelope =
  | {
      protocol: 'sk3chy-crdt'
      version: 1
      roomId: string
      type: 'update'
      senderId: string
      seq: number
      timestamp: number
      updateBase64: string
    }
  | {
      protocol: 'sk3chy-crdt'
      version: 1
      roomId: string
      type: 'awareness'
      senderId: string
      seq: number
      timestamp: number
      clientId: number
      state: Record<string, unknown>
    }

type StatementLike = {
  proof?: unknown
  topics?: string[]
  data?: string | Uint8Array
}

const PROVIDER_ORIGIN = Symbol('statement-store-crdt-provider')
const PROTOCOL = 'sk3chy-crdt'
const VERSION = 1
const DEFAULT_POLL_INTERVAL_MS = 1_000
const DEFAULT_PRESENCE_TTL_MS = 30_000
const HEARTBEAT_MS = 10_000

function randomId() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function encodeEnvelope(envelope: CrdtEnvelope): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelope))
}

function decodeEnvelope(data: string | Uint8Array | undefined): CrdtEnvelope | null {
  if (!data) return null

  const bytes = typeof data === 'string' ? hexToBytes(data) : data
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<CrdtEnvelope>
    if (parsed.protocol !== PROTOCOL || parsed.version !== VERSION) return null
    if (parsed.type !== 'update' && parsed.type !== 'awareness') return null
    if (!parsed.roomId || !parsed.senderId) return null
    return parsed as CrdtEnvelope
  } catch {
    return null
  }
}

function statementId(statement: StatementLike): string {
  const proof = JSON.stringify(statement.proof ?? null)
  const data = typeof statement.data === 'string' ? statement.data : uint8ArrayToBase64(statement.data ?? new Uint8Array())
  return `${proof}:${data}`
}

class JsonRpcWsClient {
  private ws: WebSocket | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>()
  private connectPromise: Promise<void> | null = null

  constructor(private readonly url: string) {}

  async request<T = any>(method: string, params: any[] = []): Promise<T> {
    await this.connect()
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Statement Store WebSocket is not connected')
    }

    const id = this.nextId++
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    return promise
  }

  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    for (const { reject } of this.pending.values()) {
      reject(new Error('Statement Store WebSocket closed'))
    }
    this.pending.clear()
    this.connectPromise = null
  }

  private connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve()
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url)
      this.ws = ws

      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('Statement Store WebSocket connection failed'))
      ws.onclose = () => {
        this.ws = null
        this.connectPromise = null
      }
      ws.onmessage = (event) => {
        let msg: any
        try {
          msg = JSON.parse(String(event.data))
        } catch {
          return
        }
        if (typeof msg.id !== 'number') return
        const pending = this.pending.get(msg.id)
        if (!pending) return
        this.pending.delete(msg.id)
        if (msg.error) {
          pending.reject(new Error(msg.error.message ?? 'Statement Store RPC error'))
          return
        }
        pending.resolve(msg.result)
      }
    })

    return this.connectPromise
  }
}

export class StatementStoreCrdtProvider {
  readonly doc: Y.Doc
  readonly awareness: Awareness

  private listeners = new Map<ProviderEvent, Set<EventHandler>>()
  private connectedPeerIds = new Set<string>()
  private peerClientIds = new Map<string, number>()
  private lastSeen = new Map<string, number>()
  private seenStatements = new Set<string>()
  private senderId = randomId()
  private seq = 0
  private roomTopic: `0x${string}`
  private destroyed = false
  private hostStore: HostStatementStore | null = null
  private hostSubscription: { unsubscribe(): void } | null = null
  private rpcClient: JsonRpcWsClient | null = null
  private directSdk: ReturnType<typeof createStatementSdk> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private expiryTimer: ReturnType<typeof setInterval> | null = null
  private updateHandler: ((update: Uint8Array, origin: any) => void) | null = null
  private awarenessHandler: ((changes: { added: number[]; updated: number[]; removed: number[] }, origin: any) => void) | null = null
  private directSigner: ReturnType<typeof getStatementSigner> | null = null
  private pollInterval: number
  private presenceTtl: number
  private connectPromise: Promise<void>

  get connectedPeers(): ReadonlySet<string> {
    return this.connectedPeerIds
  }

  get peerClientIdMap(): ReadonlyMap<string, number> {
    return this.peerClientIds
  }

  constructor(doc: Y.Doc, private readonly roomId: string, private readonly config: StatementStoreCrdtProviderConfig = {}) {
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.roomTopic = stringToTopic(`sk3chy:crdt:${roomId}`) as `0x${string}`
    this.pollInterval = config.pollInterval ?? DEFAULT_POLL_INTERVAL_MS
    this.presenceTtl = config.presenceTtl ?? DEFAULT_PRESENCE_TTL_MS

    if (config.localSigner) {
      this.directSigner = getStatementSigner(config.localSigner.publicKey, 'sr25519', config.localSigner.sign)
    }

    this.bindDocUpdates()
    this.bindAwarenessUpdates()
    this.startHeartbeat()
    this.startExpiryCheck()

    this.connectPromise = this.connect()
  }

  on(event: ProviderEvent, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: ProviderEvent, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler)
  }

  async destroy(): Promise<void> {
    this.destroyed = true

    if (this.updateHandler) {
      this.doc.off('update', this.updateHandler)
      this.updateHandler = null
    }
    if (this.awarenessHandler) {
      this.awareness.off('update', this.awarenessHandler)
      this.awarenessHandler = null
    }
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.expiryTimer) clearInterval(this.expiryTimer)
    this.hostSubscription?.unsubscribe()
    this.rpcClient?.close()

    this.listeners.clear()
    this.connectedPeerIds.clear()
    this.peerClientIds.clear()
    this.lastSeen.clear()
  }

  private emit(event: ProviderEvent, payload: any): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.forEach((handler) => handler(payload))
  }

  private log(message: string, type = 'info'): void {
    this.config.onLog?.(message, type)
    console.log(`[StatementStoreCrdtProvider] ${message}`)
  }

  private async connect(): Promise<void> {
    this.emit('status', { status: 'connecting', message: 'Connecting to Statement Store...' })

    try {
      this.hostStore = await getStatementStore().catch(() => null)

      if (this.hostStore) {
        this.log('Using product-sdk host Statement Store')
        this.hostSubscription = this.hostStore.subscribe({ matchAll: [this.roomTopic] }, (page) => {
          this.processStatements(page.statements)
        })
      } else {
        await this.connectDirect()
        await this.pollDirect()
        this.pollTimer = setInterval(() => void this.pollDirect(), this.pollInterval)
      }

      this.emit('status', { status: 'connected', message: 'Connected' })
      await this.publishAwareness()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.emit('status', { status: 'disconnected', message: msg })
      throw error
    }
  }

  private async connectDirect(): Promise<void> {
    const endpoint = this.config.statementStoreEndpoint
    if (!endpoint) {
      throw new Error('Host Statement Store unavailable and NUXT_PUBLIC_STATEMENT_STORE_WS is not configured.')
    }
    if (!this.directSigner) {
      throw new Error('Host Statement Store unavailable and no local Statement Store signer is configured.')
    }

    this.log(`Using direct Statement Store RPC: ${endpoint}`)
    this.rpcClient = new JsonRpcWsClient(endpoint)
    this.directSdk = createStatementSdk((method, params) => this.rpcClient!.request(method, params))
  }

  private bindDocUpdates(): void {
    this.updateHandler = (update: Uint8Array, origin: any) => {
      if (origin === PROVIDER_ORIGIN || this.destroyed) return
      void this.publish({
        protocol: PROTOCOL,
        version: VERSION,
        roomId: this.roomId,
        type: 'update',
        senderId: this.senderId,
        seq: ++this.seq,
        timestamp: Date.now(),
        updateBase64: uint8ArrayToBase64(update),
      })
    }
    this.doc.on('update', this.updateHandler)
  }

  private bindAwarenessUpdates(): void {
    this.awarenessHandler = (_changes, origin) => {
      if (origin === PROVIDER_ORIGIN || this.destroyed) return
      void this.publishAwareness()
    }
    this.awareness.on('update', this.awarenessHandler)
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.destroyed) void this.publishAwareness()
    }, HEARTBEAT_MS)
  }

  private startExpiryCheck(): void {
    this.expiryTimer = setInterval(() => {
      if (this.destroyed) return
      const now = Date.now()
      const removed: number[] = []

      for (const [peerId, seenAt] of this.lastSeen) {
        if (now - seenAt <= this.presenceTtl) continue
        this.lastSeen.delete(peerId)
        this.connectedPeerIds.delete(peerId)
        const clientId = this.peerClientIds.get(peerId)
        this.peerClientIds.delete(peerId)
        if (typeof clientId === 'number') {
          this.awareness.getStates().delete(clientId)
          removed.push(clientId)
        }
      }

      if (removed.length > 0) {
        this.awareness.emit('change', [{ added: [], updated: [], removed }, PROVIDER_ORIGIN])
        this.emit('peers', { webrtcPeers: Array.from(this.connectedPeerIds) })
      }
    }, 5_000)
  }

  private async publishAwareness(): Promise<void> {
    const state = this.awareness.getLocalState()
    if (!state) return

    await this.publish({
      protocol: PROTOCOL,
      version: VERSION,
      roomId: this.roomId,
      type: 'awareness',
      senderId: this.senderId,
      seq: ++this.seq,
      timestamp: Date.now(),
      clientId: this.doc.clientID,
      state: { ...state, _yjsClientId: this.doc.clientID },
    })
  }

  private async publish(envelope: CrdtEnvelope): Promise<void> {
    if (this.destroyed) return

    const bytes = encodeEnvelope(envelope)
    try {
      if (this.hostStore) {
        const statement: HostStatement = {
          topics: [this.roomTopic],
          data: bytesToHex(bytes),
        }
        const proof = await this.hostStore.createProofAuthorized(statement)
        await this.hostStore.submit({ ...statement, proof } as HostSignedStatement)
        return
      }

      if (!this.directSdk || !this.directSigner) return
      const statement: Statement = {
        topics: [this.roomTopic],
        data: bytes,
      }
      const signed = await this.directSigner.sign(statement)
      const result = await this.directSdk.submit(signed)
      if (result.status !== 'new' && result.status !== 'known') {
        throw new Error(`Statement Store submit ${result.status}`)
      }
    } catch (error) {
      this.log(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  private async pollDirect(): Promise<void> {
    if (!this.directSdk || this.destroyed) return
    try {
      const statements = await this.directSdk.getStatements({ topics: [this.roomTopic] })
      this.processStatements(statements)
    } catch (error) {
      this.log(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  private processStatements(statements: StatementLike[]): void {
    for (const statement of statements) {
      const id = statementId(statement)
      if (this.seenStatements.has(id)) continue
      this.seenStatements.add(id)

      const envelope = decodeEnvelope(statement.data)
      if (!envelope || envelope.roomId !== this.roomId || envelope.senderId === this.senderId) continue

      if (envelope.type === 'update') {
        Y.applyUpdate(this.doc, base64ToUint8Array(envelope.updateBase64), PROVIDER_ORIGIN)
      } else {
        this.applyRemoteAwareness(envelope)
      }
    }
  }

  private applyRemoteAwareness(envelope: Extract<CrdtEnvelope, { type: 'awareness' }>): void {
    const clientId = envelope.clientId
    if (clientId === this.doc.clientID) return

    const states = this.awareness.getStates()
    const wasPresent = states.has(clientId)
    states.set(clientId, envelope.state)

    this.connectedPeerIds.add(envelope.senderId)
    this.peerClientIds.set(envelope.senderId, clientId)
    this.lastSeen.set(envelope.senderId, Date.now())

    this.awareness.emit('change', [
      { added: wasPresent ? [] : [clientId], updated: wasPresent ? [clientId] : [], removed: [] },
      PROVIDER_ORIGIN,
    ])
    this.emit('peers', { webrtcPeers: Array.from(this.connectedPeerIds) })
  }
}
