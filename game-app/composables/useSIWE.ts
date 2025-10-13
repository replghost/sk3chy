import { verifyMessage, type Address } from 'viem'

export interface SIWEData {
  address: string
  signature: string
  message: string
  timestamp: number
  nonce: string
}

export function useSIWE(yroom: any) {
  /**
   * Sign in with Ethereum - client-side SIWE implementation
   * @param address - User's Ethereum address
   * @param signMessageFn - Function to sign the message (from wallet)
   */
  async function signIn(address: string, signMessageFn: (message: string) => Promise<string>) {
    // Client generates nonce
    const nonce = crypto.randomUUID()
    const issuedAt = new Date().toISOString()
    
    // Create SIWE message (EIP-4361 format)
    const message = `${window.location.host} wants you to sign in with your Ethereum account:
${address}

Sign in to sk3tchy

URI: ${window.location.origin}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${issuedAt}`

    // Sign with wallet
    const signature = await signMessageFn(message)
    
    // Verify locally before storing
    const isValid = await verifyMessage({
      address: address as Address,
      message,
      signature: signature as `0x${string}`
    })
    
    if (!isValid) {
      throw new Error('Signature verification failed')
    }
    
    const siweData: SIWEData = {
      address,
      signature,
      message,
      timestamp: Date.now(),
      nonce
    }
    
    // Store in Yjs for peer verification
    yroom.doc.getMap('users').set(address, siweData)
    
    console.log('[SIWE] Signed in:', address)
    return siweData
  }
  
  /**
   * Verify a peer's SIWE signature
   * @param peerData - SIWE data from peer
   */
  async function verifyPeer(peerData: SIWEData): Promise<boolean> {
    const { message, signature, timestamp, address } = peerData
    
    // Check timestamp (reject if > 1 hour old)
    const maxAge = 60 * 60 * 1000 // 1 hour
    if (Date.now() - timestamp > maxAge) {
      console.warn('[SIWE] Peer signature expired:', address)
      return false
    }
    
    // Verify signature
    try {
      const isValid = await verifyMessage({
        address: address as Address,
        message,
        signature: signature as `0x${string}`
      })
      
      if (!isValid) {
        console.warn('[SIWE] Peer signature invalid:', address)
        return false
      }
      
      console.log('[SIWE] Peer verified:', address)
      return true
    } catch (error) {
      console.error('[SIWE] Verification error:', error)
      return false
    }
  }
  
  /**
   * Get all verified users in the room
   */
  function getVerifiedUsers(): Map<string, SIWEData> {
    return yroom.doc.getMap('users') as Map<string, SIWEData>
  }
  
  /**
   * Check if a specific address is verified in the room
   */
  async function isAddressVerified(address: string): Promise<boolean> {
    const users = getVerifiedUsers()
    const userData = users.get(address)
    
    if (!userData) {
      return false
    }
    
    return await verifyPeer(userData)
  }
  
  /**
   * Check if a user is both verified AND currently active (wallet connected)
   * @param address - User's Ethereum address
   * @param awarenessStates - Current awareness states from yroom.awareness.getStates()
   */
  async function isUserActive(address: string, awarenessStates: Map<number, any>): Promise<boolean> {
    // Check signature is valid
    const isVerified = await isAddressVerified(address)
    if (!isVerified) return false
    
    // Check if wallet is currently connected (via awareness)
    const states = Array.from(awarenessStates.values())
    const peer = states.find(p => p.address?.toLowerCase() === address.toLowerCase())
    return peer?.walletConnected === true
  }
  
  /**
   * Remove user's signature from the room (e.g., on disconnect)
   */
  function clearSignature(address: string) {
    yroom.doc.getMap('users').delete(address)
    console.log('[SIWE] Cleared signature for:', address)
  }
  
  return {
    signIn,
    verifyPeer,
    getVerifiedUsers,
    isAddressVerified,
    isUserActive,
    clearSignature
  }
}
