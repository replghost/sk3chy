import { describe, it, expect, vi } from 'vitest'

/**
 * Tests the stale peer cleanup logic extracted from useDrawingGame.ts.
 * We test the algorithm in isolation since the composable has heavy deps.
 */

// Minimal awareness mock
function createMockAwareness(states: Map<number, any>) {
  const removedIds: number[][] = []
  const removedOrigins: any[] = []
  return {
    getStates: () => states,
    removeAwarenessStates(awareness: any, clientIds: number[], origin: any) {
      removedIds.push(clientIds)
      removedOrigins.push(origin)
      for (const id of clientIds) {
        states.delete(id)
      }
    },
    _removedIds: removedIds,
    _removedOrigins: removedOrigins,
  }
}

/**
 * Extracted stale peer cleanup logic (mirrors useDrawingGame.ts updatePeers)
 */
function runStalePeerCleanup(opts: {
  states: Map<number, any>
  localClientId: number
  connectedPeerIds: Set<string>
  peerClientMap: Map<string, number>
  peerLastSeen: Map<number, number>
  stalePeerMs: number
  now: number
  removeAwarenessStates: (awareness: any, clientIds: number[], origin: string) => void
}) {
  const { states, localClientId, connectedPeerIds, peerClientMap, peerLastSeen, stalePeerMs, now, removeAwarenessStates } = opts

  const connectedClientIds = new Set<number>([localClientId])
  for (const [peerId, clientId] of peerClientMap) {
    if (connectedPeerIds.has(peerId)) {
      connectedClientIds.add(clientId)
    }
  }

  const staleClientIds: number[] = []
  const peerMap = new Map<string, any>()

  states.forEach((peer: any, clientId: number) => {
    if (!peer.id) return

    if (connectedClientIds.has(clientId)) {
      peerLastSeen.set(clientId, now)
    }

    if (!connectedClientIds.has(clientId)) {
      const lastSeen = peerLastSeen.get(clientId) || 0
      if (now - lastSeen > stalePeerMs) {
        staleClientIds.push(clientId)
        peerLastSeen.delete(clientId)
        return
      }
    }

    const existing = peerMap.get(peer.id)
    if (!existing || clientId > existing.clientId) {
      peerMap.set(peer.id, { ...peer, clientId })
    }
  })

  if (staleClientIds.length > 0) {
    removeAwarenessStates(null, staleClientIds, 'stale-cleanup')
  }

  return { peers: Array.from(peerMap.values()), staleClientIds }
}

describe('stalePeerCleanup', () => {
  it('removes stale peers in a single batch after iteration', () => {
    const states = new Map<number, any>([
      [1, { id: 'user-a' }],
      [2, { id: 'user-b' }],
      [3, { id: 'user-c' }],
    ])

    const mock = createMockAwareness(states)
    const peerLastSeen = new Map<number, number>()

    const result = runStalePeerCleanup({
      states,
      localClientId: 1,
      connectedPeerIds: new Set(),
      peerClientMap: new Map(),
      peerLastSeen,
      stalePeerMs: 30_000,
      now: 50_000,
      removeAwarenessStates: mock.removeAwarenessStates.bind(mock),
    })

    // clientId 1 is local so it's always connected
    // clientIds 2 and 3 have no WebRTC connection and no lastSeen → stale
    expect(result.staleClientIds).toContain(2)
    expect(result.staleClientIds).toContain(3)
    // Should be a single batch call, not multiple
    expect(mock._removedIds.length).toBe(1)
    expect(mock._removedIds[0]).toEqual(expect.arrayContaining([2, 3]))
    expect(mock._removedOrigins[0]).toBe('stale-cleanup')
  })

  it('keeps peers that have been recently seen', () => {
    const now = 50_000
    const states = new Map<number, any>([
      [1, { id: 'user-a' }],
      [2, { id: 'user-b' }],
    ])

    const peerLastSeen = new Map<number, number>([
      [2, now - 10_000], // Seen 10s ago, within 30s threshold
    ])

    const result = runStalePeerCleanup({
      states,
      localClientId: 1,
      connectedPeerIds: new Set(),
      peerClientMap: new Map(),
      peerLastSeen,
      stalePeerMs: 30_000,
      now,
      removeAwarenessStates: vi.fn(),
    })

    expect(result.staleClientIds).toEqual([])
    expect(result.peers).toHaveLength(2)
  })

  it('keeps connected WebRTC peers and updates their lastSeen', () => {
    const now = 100_000
    const states = new Map<number, any>([
      [1, { id: 'user-a' }],
      [5, { id: 'user-b' }],
    ])

    const peerLastSeen = new Map<number, number>()

    const result = runStalePeerCleanup({
      states,
      localClientId: 1,
      connectedPeerIds: new Set(['peer-x']),
      peerClientMap: new Map([['peer-x', 5]]),
      peerLastSeen,
      stalePeerMs: 30_000,
      now,
      removeAwarenessStates: vi.fn(),
    })

    expect(result.staleClientIds).toEqual([])
    expect(result.peers).toHaveLength(2)
    expect(peerLastSeen.get(5)).toBe(now)
  })

  it('deduplicates peers by user ID keeping higher clientId', () => {
    const states = new Map<number, any>([
      [1, { id: 'user-a' }],
      [10, { id: 'user-a' }], // Duplicate with higher clientId
    ])

    const result = runStalePeerCleanup({
      states,
      localClientId: 1,
      connectedPeerIds: new Set(),
      peerClientMap: new Map(),
      peerLastSeen: new Map([[10, Date.now()]]),
      stalePeerMs: 30_000,
      now: Date.now(),
      removeAwarenessStates: vi.fn(),
    })

    expect(result.peers).toHaveLength(1)
    expect(result.peers[0].clientId).toBe(10)
  })

  it('cleans peerLastSeen entries for stale peers', () => {
    const states = new Map<number, any>([
      [1, { id: 'user-a' }],
      [2, { id: 'user-b' }],
    ])

    const peerLastSeen = new Map<number, number>([
      [2, 0], // Very old
    ])

    runStalePeerCleanup({
      states,
      localClientId: 1,
      connectedPeerIds: new Set(),
      peerClientMap: new Map(),
      peerLastSeen,
      stalePeerMs: 30_000,
      now: 50_000,
      removeAwarenessStates: vi.fn(),
    })

    expect(peerLastSeen.has(2)).toBe(false)
  })
})
