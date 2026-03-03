import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for SSYjsProvider awareness origin filtering and peerClientIds getter.
 * We import the real class but mock the WebRTC layer.
 */

// Mock the WebRTC provider using a class so `new SSWebRTCProvider()` works
vi.mock('~/lib/ss-webrtc', () => {
  class MockSSWebRTCProvider {
    connect = vi.fn(async () => {})
    disconnect = vi.fn(async () => {})
    send = vi.fn()
    broadcast = vi.fn()
    constructor(_roomId: string, config: any) {
      setTimeout(() => config.onStatus?.('connected'), 0)
    }
  }
  return { SSWebRTCProvider: MockSSWebRTCProvider }
})

import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import { SSYjsProvider } from '~/lib/ss-yjs-provider'

describe('SSYjsProvider', () => {
  let doc: Y.Doc
  let provider: SSYjsProvider

  beforeEach(() => {
    doc = new Y.Doc()
    // Cast to any since we fully mock SSWebRTCProvider and don't need real config fields
    provider = new SSYjsProvider('test-room', doc, {
      substrateEndpoint: 'ws://localhost:9944',
      peerId: 'test-peer',
      documentId: 'test-room',
    } as any)
  })

  describe('peerClientIdMap getter', () => {
    it('returns a ReadonlyMap', () => {
      const map = provider.peerClientIdMap
      expect(map).toBeInstanceOf(Map)
      expect(map.size).toBe(0)
    })

    it('reflects internal peerClientIds state', () => {
      // Simulate receiving a peer ID message by accessing internal state
      // (we can't easily trigger the full message flow with mocked WebRTC)
      const internalMap = (provider as any).peerClientIds as Map<string, number>
      internalMap.set('peer-1', 42)
      internalMap.set('peer-2', 99)

      const publicMap = provider.peerClientIdMap
      expect(publicMap.get('peer-1')).toBe(42)
      expect(publicMap.get('peer-2')).toBe(99)
      expect(publicMap.size).toBe(2)
    })
  })

  describe('awareness origin filtering', () => {
    it('broadcasts awareness updates with origin "local"', () => {
      const webrtcBroadcast = (provider as any).webrtc.broadcast

      // Setting local state triggers an awareness update with origin 'local'
      provider.awareness.setLocalStateField('test', 'value')

      expect(webrtcBroadcast).toHaveBeenCalled()
    })

    it('does not re-broadcast awareness updates from remote peers', () => {
      const webrtcBroadcast = (provider as any).webrtc.broadcast
      webrtcBroadcast.mockClear()

      // Simulate a remote awareness update (origin = peerId string)
      const remoteDoc = new Y.Doc()
      const remoteAwareness = new awarenessProtocol.Awareness(remoteDoc)
      remoteAwareness.setLocalState({ test: 'remote' })
      const update = awarenessProtocol.encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID])

      // Apply with peerId as origin (simulates receiving from a peer)
      awarenessProtocol.applyAwarenessUpdate(provider.awareness, update, 'remote-peer-id')

      expect(webrtcBroadcast).not.toHaveBeenCalled()

      remoteAwareness.destroy()
      remoteDoc.destroy()
    })

    it('broadcasts awareness updates with origin "stale-cleanup"', () => {
      const webrtcBroadcast = (provider as any).webrtc.broadcast

      // First, add a fake awareness state to remove
      const remoteDoc = new Y.Doc()
      const remoteAwareness = new awarenessProtocol.Awareness(remoteDoc)
      remoteAwareness.setLocalState({ id: 'stale-user' })
      const update = awarenessProtocol.encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID])
      awarenessProtocol.applyAwarenessUpdate(provider.awareness, update, 'some-peer')

      webrtcBroadcast.mockClear()

      // Now remove with stale-cleanup origin
      awarenessProtocol.removeAwarenessStates(provider.awareness, [remoteDoc.clientID], 'stale-cleanup')

      expect(webrtcBroadcast).toHaveBeenCalled()

      remoteAwareness.destroy()
      remoteDoc.destroy()
    })
  })

  describe('connectedPeers', () => {
    it('starts empty', () => {
      expect(provider.connectedPeers.size).toBe(0)
    })
  })
})
