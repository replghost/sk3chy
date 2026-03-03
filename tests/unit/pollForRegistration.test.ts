import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pollForRegistration } from '~/lib/usernameRegistration'

// Mock the blockchain client
vi.mock('~/lib/blockchainClient', () => ({
  checkLitePersonExists: vi.fn(),
  checkUsernamesOnChain: vi.fn(),
  registerUserOnPreview: vi.fn(),
}))

// Mock heavy crypto deps that aren't needed for polling tests
vi.mock('@polkadot-labs/hdkd-helpers', () => ({
  ss58Decode: vi.fn(),
  ss58Encode: vi.fn(),
  mnemonicToEntropy: vi.fn(),
  blake2b256: vi.fn(),
  mnemonicToMiniSecret: vi.fn(() => new Uint8Array(32)),
  DEV_PHRASE: 'test',
}))
vi.mock('@polkadot-labs/hdkd', () => ({
  sr25519CreateDerive: vi.fn(() => () => ({ publicKey: new Uint8Array(32), sign: vi.fn() })),
}))
vi.mock('@noble/curves/nist.js', () => ({ p256: { getPublicKey: vi.fn() } }))
vi.mock('@polkadot/util-crypto', () => ({
  cryptoWaitReady: vi.fn(async () => true),
  sr25519PairFromSeed: vi.fn(() => ({ publicKey: new Uint8Array(32), secretKey: new Uint8Array(64) })),
  blake2AsU8a: vi.fn(() => new Uint8Array(64)),
}))
vi.mock('@polkadot/util', () => ({ stringToU8a: vi.fn() }))
vi.mock('verifiablejs/bundler', () => ({
  member_from_entropy: vi.fn(() => new Uint8Array(32)),
  sign: vi.fn(() => new Uint8Array(64)),
}))

import { checkLitePersonExists } from '~/lib/blockchainClient'

const mockCheck = vi.mocked(checkLitePersonExists)

describe('pollForRegistration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockCheck.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves immediately when checkLitePersonExists returns true on first attempt', async () => {
    mockCheck.mockResolvedValueOnce(true)

    const promise = pollForRegistration('alice.42', '5Gtest', 5)
    await vi.advanceTimersByTimeAsync(0)

    const result = await promise
    expect(result).toEqual({
      username: 'alice.42',
      candidateAccountId: '5Gtest',
      status: 'ASSIGNED',
    })
    expect(mockCheck).toHaveBeenCalledTimes(1)
  })

  it('polls multiple times until success', async () => {
    mockCheck
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    const onAttempt = vi.fn()
    const promise = pollForRegistration('alice.42', '5Gtest', 10, onAttempt)

    // First poll
    await vi.advanceTimersByTimeAsync(0)
    // Second poll (after 2s delay)
    await vi.advanceTimersByTimeAsync(2000)
    // Third poll (after another 2s delay)
    await vi.advanceTimersByTimeAsync(2000)

    const result = await promise
    expect(result.status).toBe('ASSIGNED')
    expect(mockCheck).toHaveBeenCalledTimes(3)
    expect(onAttempt).toHaveBeenCalledTimes(3)
  })

  it('rejects after maxAttempts exceeded', async () => {
    mockCheck.mockResolvedValue(false)

    const controller = new AbortController()
    const promise = pollForRegistration('alice.42', '5Gtest', 2, undefined, controller.signal)

    // Attach rejection handler eagerly so it doesn't become unhandled
    let rejection: Error | undefined
    promise.catch((err) => { rejection = err })

    // Attempt 1
    await vi.advanceTimersByTimeAsync(0)
    // Attempt 2
    await vi.advanceTimersByTimeAsync(2000)
    // Attempt 3 → exceeds maxAttempts
    await vi.advanceTimersByTimeAsync(2000)
    // Let microtasks settle
    await vi.advanceTimersByTimeAsync(0)

    expect(rejection).toBeDefined()
    expect(rejection!.message).toMatch(/polling timeout/)
    // Abort to stop any dangling timers
    controller.abort()
  })

  it('stops polling when AbortSignal is triggered', async () => {
    mockCheck.mockResolvedValue(false)
    const controller = new AbortController()

    const promise = pollForRegistration('alice.42', '5Gtest', 100, undefined, controller.signal)

    // First poll
    await vi.advanceTimersByTimeAsync(0)
    expect(mockCheck).toHaveBeenCalledTimes(1)

    // Abort before next poll
    controller.abort(new Error('Timed out'))

    await expect(promise).rejects.toThrow('Timed out')
    // No more polls should happen
    await vi.advanceTimersByTimeAsync(5000)
    expect(mockCheck).toHaveBeenCalledTimes(1)
  })

  it('continues polling after transient query errors', async () => {
    mockCheck
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(true)

    const promise = pollForRegistration('alice.42', '5Gtest', 5)

    // First attempt: error
    await vi.advanceTimersByTimeAsync(0)
    // Second attempt after 2s: success
    await vi.advanceTimersByTimeAsync(2000)

    const result = await promise
    expect(result.status).toBe('ASSIGNED')
    expect(mockCheck).toHaveBeenCalledTimes(2)
  })

  it('clears per-query timer when query resolves before timeout', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    mockCheck.mockResolvedValueOnce(true)

    const promise = pollForRegistration('alice.42', '5Gtest', 5)
    await vi.advanceTimersByTimeAsync(0)

    await promise
    // The .finally() should have cleared the 10s query timer
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
