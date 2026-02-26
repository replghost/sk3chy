# Testing the Signaling Server

## Quick Start

### 1. Start the Signaling Server

```bash
cd signaling-server
bun run dev
```

You should see:
```
🚀 Signaling server started on port 4444
```

### 2. Start the Game App

In a new terminal:
```bash
cd game-app
bun run dev
```

### 3. Test the Connection

Open your browser and visit:
- **Test Page**: http://localhost:3000/test-signaling
- **Game Rooms**: http://localhost:3000/game/1

## Testing Scenarios

### Scenario 1: Direct Signaling Server Test

1. Open `signaling-server/example-client.html` in multiple browser tabs
2. Click "Connect" in each tab
3. Enter the same room ID (e.g., "test-room")
4. Click "Join Room" in each tab
5. You should see peers appear in each tab

### Scenario 2: Game App Test

1. Visit http://localhost:3000/test-signaling
2. Click "Connect" - you should see "Connected" status
3. Enter a room ID and click "Join Room"
4. Open another browser tab/window
5. Repeat steps 2-3 with the same room ID
6. Both tabs should show each other as peers

### Scenario 3: Actual Game Test

1. Visit http://localhost:3000/game/1 in two browser tabs
2. Enter your name in both tabs
3. In the first tab (host), click "Start Game"
4. Both tabs should sync and show the same game state
5. The host can draw, and the drawing should appear in both tabs

## Troubleshooting

### Signaling Server Not Connecting

- Check that the signaling server is running on port 4444
- Check browser console for WebSocket errors
- Verify `NUXT_PUBLIC_SIGNALING_SERVER` is set correctly (default: ws://localhost:4444)

### Peers Not Connecting

- Ensure both clients are in the same room
- Check browser console for WebRTC errors
- Verify STUN server is accessible (stun.l.google.com:19302)
- Try opening in different browser windows (not just tabs) to test across different contexts

### Game State Not Syncing

- Verify both peers are connected (check the test page)
- Check browser console for Yjs errors
- Ensure IndexedDB is enabled in your browser

## Logs to Watch

### Signaling Server Logs
```
✅ Client connected: abc123
👥 Client abc123 joined room game-1. Room size: 1
👥 Client def456 joined room game-1. Room size: 2
```

### Browser Console Logs
```
[DrawingGame] Starting room: game-1
[DrawingGame] Provider status: connected
[DrawingGame] Connected peers: ['abc123']
```

## Configuration

### Change Signaling Server URL

Create `game-app/.env`:
```
NUXT_PUBLIC_SIGNALING_SERVER=ws://localhost:4444
```

For production, use WSS:
```
NUXT_PUBLIC_SIGNALING_SERVER=wss://your-signaling-server.com
```

## Statement Store Signaling (No Server)

1. Start the game app:
```
cd game-app
bun run dev
```
2. Visit http://localhost:3000/test-ss-signaling
3. Connect a Substrate wallet and join the same room in another tab

Optional override in `game-app/.env`:
```
NUXT_PUBLIC_STATEMENT_STORE_WS=wss://pop-testnet.parity-lab.parity.io:443/9910
NUXT_PUBLIC_STATEMENT_STORE_SIGNING=ephemeral
```
