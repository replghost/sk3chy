# Signaling Server

A WebSocket-based signaling server for WebRTC peer-to-peer connections. This server manages room-based peer discovery and WebRTC signal exchange.

## Features

- 🔄 **Room-based peer management** - Clients can join/leave rooms
- 🤝 **WebRTC signaling** - Relay SDP offers/answers and ICE candidates between peers
- 💓 **Heartbeat monitoring** - Automatic detection and cleanup of dead connections
- 📊 **Stats logging** - Periodic logging of server statistics
- 🐳 **Docker ready** - Easy deployment with Docker and Docker Compose

## Quick Start

### Local Development

```bash
# Install dependencies
bun install

# Run in development mode (with auto-reload)
bun dev

# Run in production mode
bun start
```

The server will start on port `4444` by default.

### Using Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down
```

### Using Docker directly

```bash
# Build the image
docker build -t signaling-server .

# Run the container
docker run -p 4444:4444 signaling-server
```

## Configuration

Set the port via environment variable:

```bash
PORT=8080 bun start
```

Or create a `.env` file:

```
PORT=4444
```

## Protocol

The server uses WebSocket with JSON messages.

### Message Types

#### Client → Server

**Join a room:**
```json
{
  "type": "join",
  "room": "room-id"
}
```

**Leave current room:**
```json
{
  "type": "leave"
}
```

**Send WebRTC signal to peer:**
```json
{
  "type": "signal",
  "to": "peer-id",
  "signal": {
    "type": "offer|answer|candidate",
    "sdp": "...",
    "candidate": "..."
  }
}
```

**Ping (keep-alive):**
```json
{
  "type": "ping"
}
```

#### Server → Client

**Announce peer ID and existing peers:**
```json
{
  "type": "announce",
  "peerId": "your-peer-id",
  "peers": ["peer-1", "peer-2"]
}
```

**Peer left the room:**
```json
{
  "type": "leave",
  "peerId": "peer-id"
}
```

**Receive WebRTC signal from peer:**
```json
{
  "type": "signal",
  "from": "peer-id",
  "signal": {
    "type": "offer|answer|candidate",
    "sdp": "...",
    "candidate": "..."
  }
}
```

**Pong response:**
```json
{
  "type": "pong"
}
```

## Deployment

### Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Set the root directory to `signaling-server`
4. Railway will auto-detect the Dockerfile
5. Set environment variable `PORT` if needed (Railway provides one by default)

### Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Set the root directory to `signaling-server`
4. Docker will be auto-detected
5. Set environment variable `PORT=4444`

### DigitalOcean App Platform

1. Create a new App on [DigitalOcean](https://www.digitalocean.com/products/app-platform)
2. Connect your GitHub repository
3. Set the source directory to `signaling-server`
4. Select Dockerfile as the build method
5. Configure port `4444`

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch app (from signaling-server directory)
cd signaling-server
flyctl launch

# Deploy
flyctl deploy
```

## Health Monitoring

The server logs statistics every minute:

```
📊 Server stats: {
  clients: 5,
  rooms: 2,
  roomDetails: [
    { room: 'game-1', peers: 3 },
    { room: 'game-2', peers: 2 }
  ]
}
```

## Security Considerations

For production deployments:

1. **Use WSS (WebSocket Secure)** - Deploy behind a reverse proxy with SSL/TLS
2. **Rate limiting** - Add rate limiting to prevent abuse
3. **Authentication** - Add token-based authentication if needed
4. **CORS** - Configure appropriate CORS policies
5. **Monitoring** - Set up logging and monitoring (e.g., Sentry, DataDog)

## License

MIT
