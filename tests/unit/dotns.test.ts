import { describe, it, expect } from 'vitest'
import { deriveSelfDotNs, SK3CHY_DOTNS_FALLBACK } from '../../utils/dotns'

describe('deriveSelfDotNs', () => {
  it('uses a .dot hostname as-is', () => {
    expect(deriveSelfDotNs({ hostname: 'sk3chy.dot', host: 'sk3chy.dot' }))
      .toBe('sk3chy.dot')
  })

  it('strips subdomains down to the registrable .dot root', () => {
    expect(deriveSelfDotNs({ hostname: 'app.sk3chy.dot', host: 'app.sk3chy.dot' }))
      .toBe('sk3chy.dot')
  })

  it('falls back for cid.app.localhost and cid.app.dot origins', () => {
    expect(deriveSelfDotNs({ hostname: 'bafy123.app.localhost', host: 'bafy123.app.localhost:5173' }))
      .toBe(SK3CHY_DOTNS_FALLBACK)
    expect(deriveSelfDotNs({ hostname: 'bafy123.app.dot', host: 'bafy123.app.dot' }))
      .toBe(SK3CHY_DOTNS_FALLBACK)
  })

  it('uses host with port for local development', () => {
    expect(deriveSelfDotNs({ hostname: 'localhost', host: 'localhost:3000' }))
      .toBe('localhost:3000')
    expect(deriveSelfDotNs({ hostname: '127.0.0.1', host: '127.0.0.1:3000' }))
      .toBe('127.0.0.1:3000')
    expect(deriveSelfDotNs({ hostname: 'sk3chy.localhost', host: 'sk3chy.localhost:5173' }))
      .toBe('sk3chy.localhost:5173')
  })

  it('maps shell-deployed hostnames to the label + .dot', () => {
    expect(deriveSelfDotNs({ hostname: 'sk3chy.paseo.li', host: 'sk3chy.paseo.li' }))
      .toBe('sk3chy.dot')
    expect(deriveSelfDotNs({ hostname: 'sk3chy.app.paseo.li', host: 'sk3chy.app.paseo.li' }))
      .toBe('sk3chy.dot')
  })

  it('falls back for two-segment non-.dot hosts', () => {
    expect(deriveSelfDotNs({ hostname: 'example.com', host: 'example.com' }))
      .toBe(SK3CHY_DOTNS_FALLBACK)
  })
})
