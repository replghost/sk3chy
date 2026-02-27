/**
 * StatementStore: Low-level read/write operations for the statement store
 *
 * This module supports two statement-store RPC shapes:
 * - Legacy (dump/getStatements style)
 * - Subscription-first (submit + subscribeStatement)
 */

import { withPolkadotSdkCompat } from '@polkadot-api/polkadot-sdk-compat'
import {
  createStatementSdk,
  getStatementSigner,
  stringToTopic
} from '@polkadot-api/sdk-statement'
import { createClient } from '@polkadot-api/substrate-client'
import { getWsProvider } from '@polkadot-api/ws-provider'
import { cryptoWaitReady, decodeAddress, randomAsU8a, sr25519PairFromSeed, sr25519Sign } from '@polkadot/util-crypto'
import { hexToU8a, u8aToHex } from '@polkadot/util'
import { sr25519CreateDerive } from '@polkadot-labs/hdkd'
import { mnemonicToMiniSecret } from '@polkadot-labs/hdkd-helpers'

import type { InjectedPolkadotAccount } from 'polkadot-api/pjs-signer'
import type { ChannelValue, LogType, KeypairType, StatementStoreSigningMode, ExternalSigner } from './types'

export interface StatementStoreConfig {
  endpoint: string
  documentId: string
  account?: InjectedPolkadotAccount
  keyType?: KeypairType
  signingMode?: StatementStoreSigningMode
  mnemonic?: string
  externalSigner?: ExternalSigner
  onLog?: (message: string, type: LogType) => void
}

interface V2StatementFields {
  expirationTimestamp: number
  sequenceNumber: number
  decryptionKey?: Uint8Array
  channel?: Uint8Array
  topic1?: Uint8Array
  topic2?: Uint8Array
  data?: Uint8Array
}

interface DecodedV2Statement {
  decryptionKey?: Uint8Array
  data?: Uint8Array
}

function resolvePublicKey(account: InjectedPolkadotAccount): Uint8Array {
  const asAny = account as any
  if (asAny?.publicKey instanceof Uint8Array) {
    return asAny.publicKey as Uint8Array
  }
  if (typeof asAny?.publicKeyHex === 'string') {
    return hexToU8a(asAny.publicKeyHex)
  }
  return decodeAddress(account.address)
}

function encodeCompact(value: number): Uint8Array {
  if (value < 64) {
    return new Uint8Array([value << 2])
  }
  if (value < 0x4000) {
    return new Uint8Array([(value << 2) | 1, value >> 6])
  }
  if (value < 0x40000000) {
    return new Uint8Array([
      (value << 2) | 2,
      value >> 6,
      value >> 14,
      value >> 22,
    ])
  }
  throw new Error('Value too large for compact encoding')
}

function decodeCompact(bytes: Uint8Array, offset: number): [number, number] {
  const mode = bytes[offset] & 0x03
  if (mode === 0) {
    return [bytes[offset] >> 2, 1]
  }
  if (mode === 1) {
    return [((bytes[offset] >> 2) | (bytes[offset + 1] << 6)), 2]
  }
  if (mode === 2) {
    return [
      (bytes[offset] >> 2) |
      (bytes[offset + 1] << 6) |
      (bytes[offset + 2] << 14) |
      (bytes[offset + 3] << 22),
      4
    ]
  }
  throw new Error('Unsupported compact encoding mode')
}

function encodeU64LE(value: bigint): Uint8Array {
  const buffer = new Uint8Array(8)
  for (let i = 0; i < 8; i++) {
    buffer[i] = Number((value >> BigInt(i * 8)) & BigInt(0xff))
  }
  return buffer
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

function extractStatementHexes(payload: unknown): string[] {
  if (!payload) return []
  if (typeof payload === 'string') {
    return payload.startsWith('0x') ? [payload] : []
  }
  if (Array.isArray(payload)) {
    return payload.flatMap(extractStatementHexes)
  }
  if (typeof payload !== 'object') {
    return []
  }

  const asAny = payload as any
  const notifications = asAny?.result?.data?.statements
  if (Array.isArray(notifications)) {
    return notifications.filter((x: unknown) => typeof x === 'string' && x.startsWith('0x'))
  }

  const directData = asAny?.data?.statements
  if (Array.isArray(directData)) {
    return directData.filter((x: unknown) => typeof x === 'string' && x.startsWith('0x'))
  }

  if (typeof asAny?.statement === 'string' && asAny.statement.startsWith('0x')) {
    return [asAny.statement]
  }

  return []
}

/**
 * StatementStore provides read/write access to the blockchain statement store.
 */
export class StatementStore {
  private endpoint: string
  private documentId: string
  private account: InjectedPolkadotAccount | null
  private mnemonic: string | null
  private externalSigner: ExternalSigner | null
  private keyType: KeypairType
  private signingMode: StatementStoreSigningMode
  private onLog: (message: string, type: LogType) => void

  private client: ReturnType<typeof createClient> | null = null
  private sdk: ReturnType<typeof createStatementSdk> | null = null
  private signer: ReturnType<typeof getStatementSigner> | null = null
  private publicKey: Uint8Array | null = null
  private signRaw: ((payload: Uint8Array) => Promise<Uint8Array>) | null = null
  private publicKeyHex: string = ''
  private loggedReadMethodNotFound: boolean = false

  private supportsSubscription: boolean = false
  private supportsLegacyRead: boolean = false
  private subscriptionUnsub: (() => void) | null = null
  private statementCache: Map<string, ChannelValue> = new Map()
  private channelMinPriority: Map<string, bigint> = new Map()

  constructor(config: StatementStoreConfig) {
    this.endpoint = config.endpoint
    this.documentId = config.documentId
    this.account = config.account ?? null
    this.mnemonic = config.mnemonic ?? null
    this.externalSigner = config.externalSigner ?? null
    this.keyType = config.keyType || 'sr25519'
    this.signingMode = config.signingMode || (this.mnemonic ? 'mnemonic' : this.account ? 'wallet' : 'ephemeral')
    this.onLog = config.onLog || (() => {})
  }

  /**
   * Connect to the Substrate node
   */
  async connect(): Promise<void> {
    this.onLog('Connecting to Substrate node...', 'info')

    let publicKey: Uint8Array
    let sign: (payload: Uint8Array) => Promise<Uint8Array>

    if (this.signingMode === 'mnemonic') {
      if (!this.mnemonic) {
        throw new Error('Mnemonic signing selected but no mnemonic provided')
      }
      const miniSecret = mnemonicToMiniSecret(this.mnemonic)
      const derive = sr25519CreateDerive(miniSecret)
      // Must match the registered wallet identity that has statement allowance.
      const keyPair = derive('//wallet')
      publicKey = keyPair.publicKey
      this.keyType = 'sr25519'
      sign = async (payload: Uint8Array) => keyPair.sign(payload)
      this.onLog('Using mnemonic wallet signer for statement store (//wallet)', 'info')
    } else if (this.signingMode === 'ephemeral') {
      await cryptoWaitReady()
      const seed = randomAsU8a(32)
      const pair = sr25519PairFromSeed(seed)
      publicKey = pair.publicKey
      this.keyType = 'sr25519'
      sign = async (payload: Uint8Array) => sr25519Sign(payload, pair)
      this.onLog('Using ephemeral signer for statement store (no wallet prompts)', 'info')
    } else if (this.signingMode === 'external') {
      if (!this.externalSigner) {
        throw new Error('External signing mode requires an externalSigner')
      }
      publicKey = decodeAddress(this.externalSigner.address)
      this.keyType = this.externalSigner.keyType || 'sr25519'
      const extSign = this.externalSigner.sign
      sign = async (payload: Uint8Array) => {
        const hexPayload = u8aToHex(payload)
        const hexSig = await extSign(hexPayload)
        return hexToU8a(hexSig)
      }
      this.onLog('Using external signer for statement store', 'info')
    } else {
      if (!this.account) {
        throw new Error('Wallet signing selected but no account provided')
      }
      publicKey = resolvePublicKey(this.account)
      sign = async (payload: Uint8Array): Promise<Uint8Array> => {
        const signature = await this.account!.polkadotSigner.signBytes(payload)
        if (typeof signature === 'string') {
          return hexToU8a(signature)
        }
        return signature
      }
    }

    this.publicKey = publicKey
    this.signRaw = sign
    this.publicKeyHex = u8aToHex(publicKey)
    this.signer = getStatementSigner(publicKey, this.keyType, sign)

    const provider = getWsProvider(this.endpoint)
    this.client = createClient(withPolkadotSdkCompat(provider))
    this.sdk = createStatementSdk(this.client.request)

    await this.withTimeout(this.client.request('system_chain', []), 8000, 'system_chain')

    const rpcMethods = await this.withTimeout(this.client.request('rpc_methods', []), 8000, 'rpc_methods') as any
    const methods = Array.isArray(rpcMethods?.methods) ? rpcMethods.methods as string[] : []
    const statementMethods = methods.filter((m) => m.startsWith('statement_'))

    if (!statementMethods.includes('statement_submit')) {
      throw new Error(`Statement-store RPC not available on ${this.endpoint} (missing statement_submit)`)
    }

    this.supportsSubscription = statementMethods.includes('statement_subscribeStatement') && typeof (this.client as any)._request === 'function'
    this.supportsLegacyRead = statementMethods.includes('statement_dump') || statementMethods.includes('statement_postedStatement') || statementMethods.includes('statement_broadcastsStatement')

    this.onLog(`Statement RPC methods: ${statementMethods.join(', ') || '(none)'}`, 'blockchain')

    if (this.supportsSubscription) {
      await this.startSubscription()
    }

    if (!this.supportsSubscription && !this.supportsLegacyRead) {
      throw new Error(`Statement-store read RPC not available on ${this.endpoint}`)
    }

    this.onLog(`Connected to: ${this.endpoint}`, 'blockchain')
    this.onLog(`Public Key: ${this.publicKeyHex.substring(0, 20)}...`, 'blockchain')
  }

  /**
   * Disconnect from the Substrate node
   */
  disconnect(): void {
    this.stopSubscription()

    if (this.client) {
      this.client.destroy()
      this.client = null
    }

    this.sdk = null
    this.signer = null
    this.publicKey = null
    this.signRaw = null
    this.statementCache.clear()
    this.channelMinPriority.clear()
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.signRaw !== null
  }

  /**
   * Get the public key hex
   */
  getPublicKeyHex(): string {
    return this.publicKeyHex
  }

  /**
   * Write a value to a channel
   */
  async write(channel: string, value: ChannelValue): Promise<boolean> {
    if (!this.client || !this.signRaw || !this.publicKey) {
      throw new Error('Not connected to Substrate')
    }

    try {
      const v2Result = await this.writeV2(channel, value)
      if (v2Result.ok) {
        return true
      }

      if (!v2Result.allowLegacyFallback) {
        return false
      }

      if (!this.sdk || !this.signer) {
        return false
      }

      return await this.writeLegacy(channel, value)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (msg.includes('statement-store allowance')) {
        throw new Error(msg)
      }
      this.onLog(`Failed to write to ${channel}: ${msg}`, 'error')
      return false
    }
  }

  private async writeLegacy(channel: string, value: ChannelValue): Promise<boolean> {
    if (!this.sdk || !this.signer) return false

    const json = JSON.stringify(value)
    const bytes = new TextEncoder().encode(json)

    const statement = {
      decryptionKey: stringToTopic(this.documentId),
      priority: value.timestamp,
      channel: stringToTopic(channel),
      topics: [stringToTopic('ss-webrtc'), stringToTopic(value.type)],
      data: bytes
    }

    const signedStatement = await this.signer.sign(statement)
    const result = await this.sdk.submit(signedStatement)
    const status = (result as any)?.status

    if (status === 'new' || status === 'known' || result === 'new' || result === 'known') {
      this.onLog(`Written to ${channel.split('/').pop()}`, 'blockchain')
      return true
    }

    this.onLog(`Legacy write rejected: ${JSON.stringify(result)}`, 'error')
    return false
  }

  private async writeV2(channel: string, value: ChannelValue): Promise<{ ok: boolean; allowLegacyFallback: boolean }> {
    if (!this.client || !this.signRaw || !this.publicKey) {
      return { ok: false, allowLegacyFallback: true }
    }

    const data = new TextEncoder().encode(JSON.stringify(value))
    const nowSec = Math.floor(Date.now() / 1000)
    const ttlSec = Math.max(Math.ceil((value as any).ttl ? (value as any).ttl / 1000 : 30), 5)
    const basePriority = (BigInt(nowSec + ttlSec) << BigInt(32)) | BigInt(Date.now() >>> 0)
    const knownMin = this.channelMinPriority.get(channel) ?? 0n
    const initialPriority = basePriority > knownMin ? basePriority : knownMin + 1n

    const fields: V2StatementFields = {
      expirationTimestamp: Number(initialPriority >> 32n),
      sequenceNumber: Number(initialPriority & 0xffffffffn),
      decryptionKey: hexToU8a(stringToTopic(this.documentId)),
      channel: hexToU8a(stringToTopic(channel)),
      topic1: hexToU8a(stringToTopic('ss-webrtc')),
      topic2: hexToU8a(stringToTopic(this.documentId)),
      data
    }

    const submit = async (activeFields: V2StatementFields): Promise<any> => {
      const signatureMaterial = this.createSignatureMaterial(activeFields)
      const signature = await this.signRaw!(signatureMaterial)
      const statement = this.createV2Statement(activeFields, this.publicKey!, signature)
      return this.client!.request('statement_submit', [u8aToHex(statement)])
    }

    const currentPriority = () =>
      (BigInt(fields.expirationTimestamp) << 32n) | BigInt(fields.sequenceNumber)

    let result = await submit(fields) as any
    let status = result?.status ?? result

    if (status === 'new' || status === 'known') {
      this.channelMinPriority.set(channel, currentPriority())
      this.onLog(`Written to ${channel.split('/').pop()}`, 'blockchain')
      return { ok: true, allowLegacyFallback: false }
    }

    if (result?.reason === 'channelPriorityTooLow' && result?.min_expiry !== undefined) {
      try {
        const minPriority = BigInt(String(result.min_expiry))
        this.channelMinPriority.set(channel, minPriority)
        const retryPriority = minPriority + 1n
        fields.expirationTimestamp = Number(retryPriority >> 32n)
        fields.sequenceNumber = Number(retryPriority & 0xffffffffn)
        result = await submit(fields) as any
        status = result?.status ?? result

        if (status === 'new' || status === 'known') {
          this.channelMinPriority.set(channel, currentPriority())
          this.onLog(`Written to ${channel.split('/').pop()}`, 'blockchain')
          return { ok: true, allowLegacyFallback: false }
        }
      } catch {
        // Continue with standard error handling below.
      }
    }

    // If endpoint expects legacy format, we can still fallback to legacy submit.
    const serialized = JSON.stringify(result)
    if (serialized.includes('Field::Expiry') || serialized.includes('alreadyExpired') || serialized.includes('variant')) {
      this.onLog(`V2 write rejected: ${serialized}`, 'warning')
      return { ok: false, allowLegacyFallback: true }
    }

    if (serialized.includes('noAllowance')) {
      throw new Error('account has no statement-store allowance on this chain')
    }

    this.onLog(`Write rejected: ${serialized}`, 'error')
    return { ok: false, allowLegacyFallback: false }
  }

  private createSignatureMaterial(fields: V2StatementFields): Uint8Array {
    const parts: Uint8Array[] = []

    const expiry = (BigInt(fields.expirationTimestamp) << BigInt(32)) | BigInt(fields.sequenceNumber)
    parts.push(new Uint8Array([2]))
    parts.push(encodeU64LE(expiry))

    if (fields.decryptionKey) {
      parts.push(new Uint8Array([3]))
      parts.push(fields.decryptionKey)
    }

    if (fields.topic1) {
      parts.push(new Uint8Array([4]))
      parts.push(fields.topic1)
    }

    if (fields.topic2) {
      parts.push(new Uint8Array([5]))
      parts.push(fields.topic2)
    }

    if (fields.channel) {
      parts.push(new Uint8Array([6]))
      parts.push(fields.channel)
    }

    if (fields.data) {
      parts.push(new Uint8Array([8]))
      parts.push(encodeCompact(fields.data.length))
      parts.push(fields.data)
    }

    return concatBytes(...parts)
  }

  private createV2Statement(fields: V2StatementFields, signer: Uint8Array, signature: Uint8Array): Uint8Array {
    const fieldArrays: Uint8Array[] = []

    fieldArrays.push(concatBytes(
      new Uint8Array([0, 0]),
      signature,
      signer
    ))

    const expiry = (BigInt(fields.expirationTimestamp) << BigInt(32)) | BigInt(fields.sequenceNumber)
    fieldArrays.push(concatBytes(new Uint8Array([2]), encodeU64LE(expiry)))

    if (fields.decryptionKey) {
      fieldArrays.push(concatBytes(new Uint8Array([3]), fields.decryptionKey))
    }
    if (fields.topic1) {
      fieldArrays.push(concatBytes(new Uint8Array([4]), fields.topic1))
    }
    if (fields.topic2) {
      fieldArrays.push(concatBytes(new Uint8Array([5]), fields.topic2))
    }
    if (fields.channel) {
      fieldArrays.push(concatBytes(new Uint8Array([6]), fields.channel))
    }
    if (fields.data) {
      fieldArrays.push(concatBytes(new Uint8Array([8]), encodeCompact(fields.data.length), fields.data))
    }

    return concatBytes(encodeCompact(fieldArrays.length), concatBytes(...fieldArrays))
  }

  private async startSubscription(): Promise<void> {
    if (!this.client || !this.supportsSubscription) return

    try {
      const ssWebrtcTopic = stringToTopic('ss-webrtc')
      const roomTopic = stringToTopic(this.documentId)
      const topicFilter = { matchAll: [ssWebrtcTopic, roomTopic] }

      const clientAny = this.client as any
      this.subscriptionUnsub = clientAny._request<any, any>(
        'statement_subscribeStatement',
        [topicFilter],
        {
          onSuccess: (subscriptionId: string, followSubscription: any) => {
            this.onLog('Statement subscription active', 'blockchain')
            followSubscription(subscriptionId, {
              next: (payload: unknown) => {
                const statementHexes = extractStatementHexes(payload)
                for (const hex of statementHexes) {
                  this.handleSubscribedStatement(hex)
                }
              },
              error: (e: Error) => {
                this.onLog(`Subscription stream error: ${e.message}`, 'error')
              }
            })
          },
          onError: (e: Error) => {
            this.onLog(`Subscription not available: ${e.message}`, 'warning')
          }
        }
      )

      this.onLog('Subscription started', 'blockchain')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      this.onLog(`Failed to start subscription: ${msg}`, 'warning')
    }
  }

  private stopSubscription(): void {
    if (this.subscriptionUnsub) {
      try {
        this.subscriptionUnsub()
      } catch {}
      this.subscriptionUnsub = null
    }
  }

  private decodeV2Statement(hex: string): DecodedV2Statement {
    const bytes = hexToU8a(hex)
    const result: DecodedV2Statement = {}

    let offset = 0
    const [fieldCount, countBytes] = decodeCompact(bytes, offset)
    offset += countBytes

    for (let i = 0; i < fieldCount; i++) {
      const tag = bytes[offset]
      offset += 1

      switch (tag) {
        case 0:
          offset += 1 + 64 + 32
          break
        case 2:
          offset += 8
          break
        case 3:
          result.decryptionKey = bytes.slice(offset, offset + 32)
          offset += 32
          break
        case 4:
        case 5:
        case 6:
          offset += 32
          break
        case 8: {
          const [dataLen, lenBytes] = decodeCompact(bytes, offset)
          offset += lenBytes
          result.data = bytes.slice(offset, offset + dataLen)
          offset += dataLen
          break
        }
        default:
          throw new Error(`Unknown statement field tag: ${tag}`)
      }
    }

    return result
  }

  private handleSubscribedStatement(statementHex: string): void {
    try {
      const decoded = this.decodeV2Statement(statementHex)
      if (!decoded.data) return

      const docTopicHex = stringToTopic(this.documentId).toLowerCase()
      if (decoded.decryptionKey && u8aToHex(decoded.decryptionKey).toLowerCase() !== docTopicHex) {
        return
      }

      const json = new TextDecoder().decode(decoded.data)
      const value = JSON.parse(json) as ChannelValue
      const key = this.getChannelKey(value)
      if (!key) return

      const existing = this.statementCache.get(key)
      if (!existing || value.timestamp > existing.timestamp) {
        this.statementCache.set(key, value)
      }
    } catch {
      // Ignore malformed statements from subscription stream
    }
  }

  /**
   * Read all values from channels matching a topic filter
   */
  async readAll(topicFilter?: string): Promise<Map<string, ChannelValue>> {
    if (this.supportsSubscription) {
      const results = new Map<string, ChannelValue>()
      for (const [key, value] of this.statementCache) {
        if (!topicFilter) {
          results.set(key, value)
          continue
        }
        if (topicFilter === value.type || key.startsWith(`${topicFilter}/`)) {
          results.set(key, value)
        }
      }
      return results
    }

    if (!this.sdk) {
      throw new Error('Not connected to Substrate')
    }

    const results = new Map<string, ChannelValue>()

    try {
      const topics = [stringToTopic('ss-webrtc')]
      if (topicFilter) {
        topics.push(stringToTopic(topicFilter))
      }

      const statements = await this.sdk.getStatements({
        dest: stringToTopic(this.documentId),
        topics
      })

      for (const stmt of statements) {
        if (!stmt.data) continue

        try {
          const bytes = this.getStatementDataBytes(stmt.data)
          if (bytes.length === 0) continue

          const json = new TextDecoder().decode(bytes)
          const value = JSON.parse(json) as ChannelValue

          const key = this.getChannelKey(value)
          if (key) {
            const existing = results.get(key)
            if (!existing || value.timestamp > existing.timestamp) {
              results.set(key, value)
            }
          }
        } catch {
          continue
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (msg.includes('Method not found')) {
        if (!this.loggedReadMethodNotFound) {
          this.loggedReadMethodNotFound = true
          this.onLog(`Failed to read statements: ${msg}`, 'error')
        }
      } else {
        this.onLog(`Failed to read statements: ${msg}`, 'error')
      }
    }

    return results
  }

  /**
   * Read presence values for all peers
   */
  async readPresences(): Promise<Map<string, ChannelValue>> {
    return this.readAll('presence')
  }

  /**
   * Read epoch values for all peers
   */
  async readEpochs(): Promise<Map<string, ChannelValue>> {
    return this.readAll('epoch')
  }

  /**
   * Read offer values
   */
  async readOffers(): Promise<Map<string, ChannelValue>> {
    return this.readAll('offer')
  }

  /**
   * Read answer values
   */
  async readAnswers(): Promise<Map<string, ChannelValue>> {
    return this.readAll('answer')
  }

  /**
   * Get a unique key for a channel value based on its type
   */
  private getChannelKey(value: ChannelValue): string | null {
    switch (value.type) {
      case 'presence':
        return `presence/${value.peerId}`
      case 'epoch':
        return `epoch/${value.peerId}`
      case 'offer':
        return `offer/${value.from}->${value.to}`
      case 'answer':
        return `answer/${value.from}->${value.to}`
      default:
        return null
    }
  }

  private getStatementDataBytes(data: unknown): Uint8Array {
    if (data instanceof Uint8Array) {
      return data
    }
    if (data && typeof data === 'object' && 'asBytes' in data) {
      const asBytes = (data as { asBytes?: () => Uint8Array }).asBytes
      if (typeof asBytes === 'function') {
        return asBytes.call(data as any)
      }
    }
    return new Uint8Array()
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
        })
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
