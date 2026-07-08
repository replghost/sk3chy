/**
 * Derive the DotNS identifier the host bound this product under.
 * The host scopes product-account derivation and signing permission to the
 * binding identifier, which comes from the URL — a mismatch is rejected with
 * PermissionDenied. Mirrors host-playground's derivation (the dotli shell
 * takes the last two hostname segments as the registrable root, so the label
 * is everything before it; appending ".dot" gives the canonical identifier).
 *
 * Cases:
 *   - <name>.dot                          → use as-is
 *   - <sub>.<name>.dot                    → <name>.dot
 *   - <cid>.app.localhost / <cid>.app.dot → fallback identifier
 *   - <name>.<root>.<tld>                 → <name>.dot
 *   - <sub>.app.<root>.<tld>              → <sub>.dot (strip the `app` infra
 *                                           subdomain preview hosts insert)
 *   - localhost / 127.0.0.1 / *.localhost → host (with :port if any)
 *     (desktop dev mode binds local URLs under "localhost[:port]")
 *   - anything else                       → fallback identifier
 */
export const SK3CHY_DOTNS_FALLBACK = 'sk3chy.dot'

export function deriveSelfDotNs(input: { hostname: string; host: string }): string {
  const hostname = input.hostname.toLowerCase()
  if (hostname.endsWith('.app.localhost') || hostname.endsWith('.app.dot')) {
    return SK3CHY_DOTNS_FALLBACK
  }
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1'
  ) {
    return input.host.toLowerCase()
  }
  if (hostname.endsWith('.dot')) {
    const segments = hostname.split('.')
    return segments.length > 2 ? segments.slice(-2).join('.') : hostname
  }
  const segments = hostname.split('.')
  if (segments.length >= 3) {
    let label = segments.slice(0, -2)
    if (label[label.length - 1] === 'app') label = label.slice(0, -1)
    if (label.length > 0) return `${label.join('.')}.dot`
  }
  return SK3CHY_DOTNS_FALLBACK
}

export function getSelfDotNs(): string {
  if (typeof window === 'undefined') return SK3CHY_DOTNS_FALLBACK
  return deriveSelfDotNs({
    hostname: window.location.hostname,
    host: window.location.host,
  })
}
