/**
 * TurnCredentials: Manages ICE server configuration for WebRTC
 *
 * Supports Cloudflare TURN credentials with fallback to public STUN servers.
 */

interface CloudflareIceServer {
  urls: string[]
  username?: string
  credential?: string
}

interface CloudflareCredentialsResponse {
  iceServers: CloudflareIceServer[]
}

interface TurnCredentialsOptions {
  turnKeyId?: string
  apiToken?: string
  turnUsername?: string
  turnCredential?: string
}

export class TurnCredentials {
  private readonly turnKeyId: string
  private readonly apiToken: string
  private readonly turnUsername: string
  private readonly turnCredential: string
  private cachedCredentials: RTCIceServer[] | null = null
  private cacheExpiry: number = 0

  constructor(options: TurnCredentialsOptions = {}) {
    this.turnKeyId = options.turnKeyId || ''
    this.apiToken = options.apiToken || ''
    this.turnUsername = options.turnUsername || ''
    this.turnCredential = options.turnCredential || ''
  }

  /**
   * Get ICE servers configuration for WebRTC
   * Includes STUN and TURN servers
   */
  async getIceServers(): Promise<RTCIceServer[]> {
    // Return cached credentials if still valid (with 1 hour buffer before expiry)
    const now = Date.now()
    if (this.cachedCredentials && this.cacheExpiry > now + 3600000) {
      return this.cachedCredentials
    }

    // Prefer static TURN credentials when configured (e.g. Metered).
    // This keeps ICE config aligned across all peers.
    if (this.turnUsername && this.turnCredential) {
      const servers = this.getStaticTurnIceServers()
      this.cachedCredentials = servers
      this.cacheExpiry = now + 86400000
      return servers
    }

    // If no Cloudflare credentials configured, fall back to STUN-only.
    if (!this.turnKeyId || !this.apiToken) {
      return this.getStunOnlyIceServers()
    }

    try {
      const response = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${this.turnKeyId}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ttl: 86400 })
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch TURN credentials: ${response.status}`)
      }

      const data: CloudflareCredentialsResponse = await response.json()

      // Cache for 24 hours (matching the TTL)
      this.cacheExpiry = now + 86400000

      // Map Cloudflare response to RTCIceServer format
      this.cachedCredentials = data.iceServers.map((server) => ({
        urls: server.urls,
        ...(server.username && { username: server.username }),
        ...(server.credential && { credential: server.credential })
      }))

      return this.cachedCredentials
    } catch (error) {
      console.error('Failed to fetch Cloudflare TURN credentials:', error)
      return this.getStunOnlyIceServers()
    }
  }

  private getStunOnlyIceServers(): RTCIceServer[] {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  }

  private getStaticTurnIceServers(): RTCIceServer[] {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: [
          'turn:a.relay.metered.ca:443',
          'turn:a.relay.metered.ca:443?transport=tcp'
        ],
        username: this.turnUsername,
        credential: this.turnCredential
      }
    ]
  }
}
