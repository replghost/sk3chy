# Local Testing Guide

## Prerequisites
- Node.js 18+ installed
- Bun installed (for game-app)

## Step-by-Step Testing

### 1. Start the Signaling Server

```bash
cd signaling-server
npm install
npm run dev
```

**Expected output:**
```
Signaling server running on localhost: 4444
```

### 2. Start the Game App

In a new terminal:

```bash
cd game-app
bun run dev
```

**Expected output:**
```
Nuxt 3.x.x
➜ Local:    http://localhost:3000/
```

### 3. Test Signaling Connection

**Option A: Use the Test Page**

1. Open http://localhost:3000/test-signaling in **two browser windows** (not tabs)
2. In both windows:
   - Click "Connect" button
   - You should see "Connected" status
   - Enter the same room ID (e.g., "test-room")
   - Click "Join Room"
3. **Expected result:** Both windows should show each other as peers

**Option B: Test the Actual Game**

1. Open http://localhost:3000/game/1 in **two browser windows**
2. In both windows, enter your name
3. In the first window (host):
   - Click "Start Game"
   - Select a word
   - Start drawing
4. **Expected result:** 
   - Both windows should show the same game state
   - Drawing should appear in both windows
   - Guesses should sync between windows

### 4. Check Browser Console

Open DevTools (F12) and check console for:

**Good signs:**
```
[DrawingGame] Starting room: game-1
[DrawingGame] Provider status: connected
[DrawingGame] Connected peers: [...]
```

**Bad signs:**
```
WebSocket connection failed
Failed to connect to signaling server
```

### 5. Check Signaling Server Logs

In the signaling server terminal, you should see:
```
📢 Client subscribed to topic: game-1. Topic size: 1
📢 Client subscribed to topic: game-1. Topic size: 2
```

## Troubleshooting

### Signaling Server Won't Start

**Error:** `Cannot find module 'lib0'`
```bash
cd signaling-server
npm install
```

### Peers Not Connecting

1. **Check .env file** in game-app:
   ```bash
   cat game-app/.env
   ```
   Should show: `NUXT_PUBLIC_SIGNALING_SERVER=ws://localhost:4444`

2. **Restart both servers** after changing .env

3. **Use different browser windows** (not tabs) - some browsers restrict WebRTC in tabs

4. **Check firewall** - make sure port 4444 is not blocked

### Game State Not Syncing

1. **Hard refresh** both browsers (Cmd+Shift+R or Ctrl+Shift+R)
2. **Clear IndexedDB**:
   - Open DevTools → Application → IndexedDB
   - Delete all `yjs-*` databases
3. **Check that both clients are in the same room** (same URL)

## Success Criteria

✅ Signaling server running on port 4444
✅ Game app running on port 3000
✅ Test page shows "Connected" status
✅ Both clients see each other as peers
✅ Game state syncs between windows
✅ Drawing appears in both windows

## Next Steps

Once local testing works:
1. Commit and push changes to GitHub
2. Railway will auto-deploy the updated signaling server
3. Test with the production Railway URL
