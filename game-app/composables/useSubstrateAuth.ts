import { cryptoWaitReady, signatureVerify } from '@polkadot/util-crypto'
import { hexToU8a, stringToU8a, u8aToHex } from '@polkadot/util'
import type { InjectedPolkadotAccount } from 'polkadot-api/pjs-signer'

export interface SubstrateAuthData {
  address: string
  signature: string
  message: string
  timestamp: number
  nonce: string
  roomId: string
  chainId: string
}

let cryptoReady: Promise<boolean> | null = null

function ensureCryptoReady() {
  if (!cryptoReady) cryptoReady = cryptoWaitReady()
  return cryptoReady
}

function buildMessage(params: {
  address: string
  roomId: string
  nonce: string
  chainId: string
  issuedAt: string
}) {
  return `sk3tchy wants you to sign in with your Substrate account:
${params.address}

Statement: Sign in to sk3tchy to verify you control this wallet.

URI: ${window.location.origin}
Chain: ${params.chainId}
Room: ${params.roomId}
Nonce: ${params.nonce}
Issued At: ${params.issuedAt}`
}

export function useSubstrateAuth(yroom: any, chainId: string) {
  const roomId = yroom.doc.guid
  const usedNonces = new Set<string>()
  const signInMessage = ref<string | null>(null)
  let pendingPayload: { address: string; nonce: string; issuedAt: string; message: string } | null = null

  const existingUsers = yroom.doc.getMap('users')
  existingUsers.forEach((userData: SubstrateAuthData) => {
    if (userData.nonce) usedNonces.add(userData.nonce)
  })

  function createUniqueNonce() {
    let nonce = crypto.randomUUID()
    let attempts = 0
    while (usedNonces.has(nonce) && attempts < 3) {
      nonce = crypto.randomUUID()
      attempts += 1
    }
    if (usedNonces.has(nonce)) {
      throw new Error('Nonce already used (replay detected)')
    }
    return nonce
  }

  function prepareSignInMessage(address: string) {
    const nonce = createUniqueNonce()
    const issuedAt = new Date().toISOString()
    const message = buildMessage({ address, roomId, nonce, chainId, issuedAt })
    pendingPayload = { address, nonce, issuedAt, message }
    signInMessage.value = message
    return message
  }

  async function signIn(account: InjectedPolkadotAccount) {
    await ensureCryptoReady()

    const payload =
      pendingPayload && pendingPayload.address === account.address
        ? pendingPayload
        : {
            address: account.address,
            nonce: createUniqueNonce(),
            issuedAt: new Date().toISOString(),
            message: ''
          }
    if (!payload.message) {
      payload.message = buildMessage({
        address: payload.address,
        roomId,
        nonce: payload.nonce,
        chainId,
        issuedAt: payload.issuedAt
      })
    }
    pendingPayload = null
    signInMessage.value = payload.message
    const message = payload.message
    const messageBytes = stringToU8a(message)
    const signatureBytes = await account.polkadotSigner.signBytes(messageBytes)
    const signatureHex = typeof signatureBytes === 'string' ? signatureBytes : u8aToHex(signatureBytes)

    const verification = signatureVerify(messageBytes, hexToU8a(signatureHex), account.address)
    if (!verification.isValid) {
      throw new Error('Signature verification failed')
    }

    const authData: SubstrateAuthData = {
      address: account.address,
      signature: signatureHex,
      message,
      timestamp: Date.now(),
      nonce: payload.nonce,
      roomId,
      chainId
    }

    usedNonces.add(payload.nonce)
    yroom.doc.getMap('users').set(account.address, authData)

    console.log('[SubstrateAuth] Signed in:', account.address)
    return authData
  }

  async function verifyPeer(peerData: SubstrateAuthData): Promise<boolean> {
    await ensureCryptoReady()

    const { message, signature, timestamp, address, nonce, roomId: peerRoomId, chainId: peerChainId } = peerData

    if (peerRoomId && peerRoomId !== roomId) {
      console.warn('[SubstrateAuth] Signature from different room:', address, peerRoomId)
      return false
    }

    if (peerChainId && peerChainId !== chainId) {
      console.warn('[SubstrateAuth] Signature from different chain:', address, peerChainId)
      return false
    }

    if (usedNonces.has(nonce)) {
      const existingUser = yroom.doc.getMap('users').get(address)
      if (existingUser?.nonce !== nonce) {
        console.warn('[SubstrateAuth] Nonce already used (replay detected):', address)
        return false
      }
    }

    const maxAge = 60 * 60 * 1000
    if (Date.now() - timestamp > maxAge) {
      console.warn('[SubstrateAuth] Peer signature expired:', address)
      return false
    }

    try {
      const messageBytes = stringToU8a(message)
      const signatureBytes = hexToU8a(signature)
      const verification = signatureVerify(messageBytes, signatureBytes, address)
      if (!verification.isValid) {
        console.warn('[SubstrateAuth] Peer signature invalid:', address)
        return false
      }
      console.log('[SubstrateAuth] Peer verified:', address)
      return true
    } catch (error) {
      console.error('[SubstrateAuth] Verification error:', error)
      return false
    }
  }

  function getVerifiedUsers(): Map<string, SubstrateAuthData> {
    return yroom.doc.getMap('users') as Map<string, SubstrateAuthData>
  }

  async function isAddressVerified(address: string): Promise<boolean> {
    const users = getVerifiedUsers()
    const userData = users.get(address)
    if (!userData) return false
    return await verifyPeer(userData)
  }

  async function isUserActive(address: string, awarenessStates: Map<number, any>): Promise<boolean> {
    const isVerified = await isAddressVerified(address)
    if (!isVerified) return false

    const states = Array.from(awarenessStates.values())
    const peer = states.find((p) => p.address === address)
    return peer?.walletConnected === true
  }

  function clearSignature(address: string) {
    yroom.doc.getMap('users').delete(address)
    console.log('[SubstrateAuth] Cleared signature for:', address)
  }

  return {
    signIn,
    signInMessage,
    prepareSignInMessage,
    verifyPeer,
    getVerifiedUsers,
    isAddressVerified,
    isUserActive,
    clearSignature
  }
}
