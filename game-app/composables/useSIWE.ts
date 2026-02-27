import { verifyMessage, type Address } from 'viem'

export interface SIWEData {
  address: string
  signature: string
  message: string
  timestamp: number
  nonce: string
  roomId: string
}

export function useSIWE(yroom: any) {
  const roomId = yroom.doc.guid // Use Yjs document GUID as room identifier
  const usedNonces = new Set<string>() // Track used nonces in this session
  
  // Load existing nonces from room to prevent replay
  const existingUsers = yroom.doc.getMap('users')
  existingUsers.forEach((userData: SIWEData) => {
    if (userData.nonce) {
      usedNonces.add(userData.nonce)
    }
  })
  
  /**
   * Sign in with Ethereum - client-side SIWE implementation
   * @param address - User's Ethereum address
   * @param signMessageFn - Function to sign the message (from wallet)
   */
  async function signIn(address: string, signMessageFn: (message: string) => Promise<string>) {
    // Client generates nonce
    const nonce = crypto.randomUUID()
    const issuedAt = new Date().toISOString()
    
    // Check if nonce already used (replay protection)
    if (usedNonces.has(nonce)) {
      throw new Error('Nonce already used (replay detected)')
    }
    
    // Create SIWE message (EIP-4361 format) with room-specific statement
    const message = `${window.location.host} wants you to sign in with your Ethereum account:
${address}

Sign in to sk3chy room: ${roomId}

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
      nonce,
      roomId
    }
    
    // Track nonce as used
    usedNonces.add(nonce)
    
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
    const { message, signature, timestamp, address, nonce, roomId: peerRoomId } = peerData
    
    // Check room binding (prevent cross-room replay)
    if (peerRoomId && peerRoomId !== roomId) {
      console.warn('[SIWE] Signature from different room:', address, peerRoomId)
      return false
    }
    
    // Check nonce uniqueness (prevent replay in same room)
    if (usedNonces.has(nonce)) {
      const existingUser = yroom.doc.getMap('users').get(address)
      // Allow if it's the same user's existing signature
      if (existingUser?.nonce !== nonce) {
        console.warn('[SIWE] Nonce already used (replay detected):', address)
        return false
      }
    }
    
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
