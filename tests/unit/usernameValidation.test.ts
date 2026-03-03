import { describe, it, expect, vi } from 'vitest'

// Mock heavy crypto deps
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
vi.mock('~/lib/blockchainClient', () => ({
  checkLitePersonExists: vi.fn(),
  checkUsernamesOnChain: vi.fn(),
  registerUserOnPreview: vi.fn(),
}))

import { validateUsername, USERNAME_REGEX } from '~/lib/usernameRegistration'

describe('validateUsername', () => {
  it('accepts valid lowercase usernames with 7+ characters', () => {
    expect(validateUsername('abcdefg')).toEqual({ valid: true })
    expect(validateUsername('longusername')).toEqual({ valid: true })
    expect(validateUsername('aaaaaaa')).toEqual({ valid: true })
  })

  it('rejects empty username', () => {
    const result = validateUsername('')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('required')
  })

  it('rejects usernames shorter than 7 characters', () => {
    expect(validateUsername('abcdef').valid).toBe(false)
    expect(validateUsername('abc').valid).toBe(false)
    expect(validateUsername('a').valid).toBe(false)
  })

  it('rejects usernames with uppercase letters', () => {
    expect(validateUsername('Abcdefg').valid).toBe(false)
    expect(validateUsername('ABCDEFG').valid).toBe(false)
    expect(validateUsername('abcdefG').valid).toBe(false)
  })

  it('rejects usernames with numbers', () => {
    expect(validateUsername('abcdef1').valid).toBe(false)
    expect(validateUsername('1234567').valid).toBe(false)
  })

  it('rejects usernames with special characters', () => {
    expect(validateUsername('abcdef!').valid).toBe(false)
    expect(validateUsername('abc-def').valid).toBe(false)
    expect(validateUsername('abc_defg').valid).toBe(false)
    expect(validateUsername('abc.defg').valid).toBe(false)
  })

  it('rejects usernames with spaces', () => {
    expect(validateUsername('abc defg').valid).toBe(false)
    expect(validateUsername(' abcdefg').valid).toBe(false)
  })
})

describe('USERNAME_REGEX', () => {
  it('matches exactly 7+ lowercase letters', () => {
    expect(USERNAME_REGEX.test('abcdefg')).toBe(true)
    expect(USERNAME_REGEX.test('abcdefgh')).toBe(true)
  })

  it('does not match partial strings', () => {
    expect(USERNAME_REGEX.test('abc')).toBe(false)
    expect(USERNAME_REGEX.test('')).toBe(false)
  })
})
