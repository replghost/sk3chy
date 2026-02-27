/**
 * StatementStore: Low-level read/write operations for the statement store
 *
 * This module handles the blockchain communication layer, providing a clean
 * abstraction for reading and writing to single-writer channels.
 */

import { withPolkadotSdkCompat } from '@polkadot-api/polkadot-sdk-compat'
import {
  createStatementSdk,
  getStatementSigner,
  stringToTopic
} from '@polkadot-api/sdk-statement'
import { Binary } from '@polkadot-api/substrate-bindings'
import { createClient } from '@polkadot-api/substrate-client'
import { getWsProvider } from '@polkadot-api/ws-provider'
import { cryptoWaitReady, decodeAddress, randomAsU8a, sr25519PairFromSeed, sr25519Sign } from '@polkadot/util-crypto'
import { hexToU8a, u8aToHex } from '@polkadot/util'
import { sr25519CreateDerive } from '@polkadot-labs/hdkd'
import { mnemonicToMiniSecret } from '@polkadot-labs/hdkd-helpers'

import type { InjectedPolkadotAccount } from 'polkadot-api/pjs-signer'
import type { ChannelValue, LogType, KeypairType, StatementStoreSigningMode } from './types'

export interface StatementStoreConfig {
  endpoint: string
  documentId: string
  account?: InjectedPolkadotAccount
  keyType?: KeypairType
  signingMode?: StatementStoreSigningMode
  mnemonic?: string
  spektrSignRaw?: (hexMessage: string) => Promise<string>
  spektrAddress?: string
  onLog?: (message: string, type: LogType) => void
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

/**
 * StatementStore provides read/write access to the blockchain statement store.
 *
 * Key properties:
 * - Each channel stores exactly one value (last-write-wins)
 * - Writes overwrite previous values based on timestamp/priority
 * - Channels are identified by a unique string name
 */
export class StatementStore {
  private endpoint: string
  private documentId: string
  private account: InjectedPolkadotAccount | null
  private mnemonic: string | null
  private spektrSignRaw: ((hexMessage: string) => Promise<string>) | null
  private spektrAddress: string | null
  private keyType: KeypairType
  private signingMode: StatementStoreSigningMode
  private onLog: (message: string, type: LogType) => void

  private client: ReturnType<typeof createClient> | null = null
  private sdk: ReturnType<typeof createStatementSdk> | null = null
  private signer: ReturnType<typeof getStatementSigner> | null = null
  private publicKeyHex: string = ''

  constructor(config: StatementStoreConfig) {
    this.endpoint = config.endpoint
    this.documentId = config.documentId
    this.account = config.account ?? null
    this.mnemonic = config.mnemonic ?? null
    this.spektrSignRaw = config.spektrSignRaw ?? null
    this.spektrAddress = config.spektrAddress ?? null
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
      // Derive a unique keypair per session so multiple tabs don't collide
      const sessionSuffix = Math.random().toString(36).substring(2, 10)
      const keyPair = derive(`//signaling//${sessionSuffix}`)
      publicKey = keyPair.publicKey
      this.keyType = 'sr25519'
      sign = async (payload: Uint8Array) => keyPair.sign(payload)
      this.onLog(`Using mnemonic-derived signer for statement store (session: ${sessionSuffix})`, 'info')
    } else if (this.signingMode === 'ephemeral') {
      await cryptoWaitReady()
      const seed = randomAsU8a(32)
      const pair = sr25519PairFromSeed(seed)
      publicKey = pair.publicKey
      this.keyType = 'sr25519'
      sign = async (payload: Uint8Array) => sr25519Sign(pair.publicKey, pair.secretKey, payload)
      this.onLog('Using ephemeral signer for statement store (no wallet prompts)', 'info')
    } else if (this.signingMode === 'spektr') {
      if (!this.spektrSignRaw || !this.spektrAddress) {
        throw new Error('Spektr signing requires spektrSignRaw and spektrAddress')
      }
      publicKey = decodeAddress(this.spektrAddress)
      this.keyType = 'sr25519'
      const signRaw = this.spektrSignRaw
      sign = async (payload: Uint8Array) => {
        const hexPayload = u8aToHex(payload)
        const hexSig = await signRaw(hexPayload)
        return hexToU8a(hexSig)
      }
      this.onLog('Using Spektr host signer for statement store', 'info')
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

    this.publicKeyHex = u8aToHex(publicKey)
    this.signer = getStatementSigner(publicKey, this.keyType, sign)

    const provider = getWsProvider(this.endpoint)
    this.client = createClient(withPolkadotSdkCompat(provider))
    this.sdk = createStatementSdk(this.client.request)

    this.onLog(`Connected to: ${this.endpoint}`, 'blockchain')
    this.onLog(`Public Key: ${this.publicKeyHex.substring(0, 20)}...`, 'blockchain')
  }

  /**
   * Disconnect from the Substrate node
   */
  disconnect(): void {
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
    this.sdk = null
    this.signer = null
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.sdk !== null && this.signer !== null
  }

  /**
   * Get the public key hex
   */
  getPublicKeyHex(): string {
    return this.publicKeyHex
  }

  /**
   * Write a value to a channel
   *
   * Single-writer rule: Only the owner of a channel should write to it.
   * The caller is responsible for ensuring this invariant.
   */
  async write(channel: string, value: ChannelValue): Promise<boolean> {
    if (!this.sdk || !this.signer) {
      throw new Error('Not connected to Substrate')
    }

    const json = JSON.stringify(value)

    try {
      const bytes = new TextEncoder().encode(json)
      const statement = {
        decryptionKey: stringToTopic(this.documentId),
        priority: value.timestamp,
        channel: stringToTopic(channel),
        topics: [stringToTopic('ss-webrtc'), stringToTopic(value.type)],
        data: Binary.fromBytes(bytes)
      }

      const signedStatement = await this.signer.sign(statement)
      await this.sdk.submit(signedStatement)

      this.onLog(`Written to ${channel.split('/').pop()}`, 'blockchain')
      return true
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      this.onLog(`Failed to write to ${channel}: ${msg}`, 'error')
      return false
    }
  }

  /**
   * Read all values from channels matching a topic filter
   *
   * Returns parsed channel values with their channel names.
   */
  async readAll(topicFilter?: string): Promise<Map<string, ChannelValue>> {
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
          const bytes = stmt.data.asBytes()
          if (bytes.length === 0) continue

          const json = new TextDecoder().decode(bytes)
          const value = JSON.parse(json) as ChannelValue

          // Use a composite key based on value type and identifiers
          const key = this.getChannelKey(value)
          if (key) {
            // Only keep the newest value for each channel (last-write-wins)
            const existing = results.get(key)
            if (!existing || value.timestamp > existing.timestamp) {
              results.set(key, value)
            }
          }
        } catch {
          // Skip malformed messages
          continue
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      this.onLog(`Failed to read statements: ${msg}`, 'error')
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
}
