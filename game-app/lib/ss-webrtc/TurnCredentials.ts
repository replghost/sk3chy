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

export class TurnCredentials {
  private readonly turnKeyId: string
  private readonly apiToken: string
  private cachedCredentials: RTCIceServer[] | null = null
  private cacheExpiry: number = 0

  constructor(turnKeyId: string, apiToken: string) {
    this.turnKeyId = turnKeyId
    this.apiToken = apiToken
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

    // If no Cloudflare credentials configured, use public servers
    if (!this.turnKeyId || !this.apiToken) {
      return this.getPublicIceServers()
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
      return this.getPublicIceServers()
    }
  }

  /**
   * Fallback public ICE servers
   */
  private getPublicIceServers(): RTCIceServer[] {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  }
}
