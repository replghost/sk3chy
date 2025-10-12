import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4444;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

interface Client {
  ws: WebSocket;
  id: string;
  room: string | null;
  isAlive: boolean;
}

interface SignalMessage {
  type: 'join' | 'leave' | 'signal' | 'announce' | 'ping' | 'pong';
  room?: string;
  peerId?: string;
  from?: string;
  to?: string;
  signal?: any;
  peers?: string[];
}

class SignalingServer {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private heartbeatInterval: Timer | null = null;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    console.log(`🚀 Signaling server started on port ${port}`);
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    this.startHeartbeat();
  }

  private handleConnection(ws: WebSocket) {
    const clientId = this.generateId();
    const client: Client = {
      ws,
      id: clientId,
      room: null,
      isAlive: true,
    };

    this.clients.set(clientId, client);
    console.log(`✅ Client connected: ${clientId}`);

    // Send client their ID
    this.send(ws, {
      type: 'announce',
      peerId: clientId,
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message: SignalMessage = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error(`Error for client ${clientId}:`, error);
      this.handleDisconnect(clientId);
    });
  }

  private handleMessage(clientId: string, message: SignalMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'join':
        this.handleJoin(clientId, message.room!);
        break;

      case 'leave':
        this.handleLeave(clientId);
        break;

      case 'signal':
        this.handleSignal(clientId, message);
        break;

      case 'ping':
        this.send(client.ws, { type: 'pong' });
        break;
    }
  }

  private handleJoin(clientId: string, roomId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Leave current room if in one
    if (client.room) {
      this.handleLeave(clientId);
    }

    // Join new room
    client.room = roomId;
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    const room = this.rooms.get(roomId)!;
    const existingPeers = Array.from(room);
    
    room.add(clientId);

    console.log(`👥 Client ${clientId} joined room ${roomId}. Room size: ${room.size}`);

    // Notify the joining client about existing peers
    this.send(client.ws, {
      type: 'announce',
      peerId: clientId,
      peers: existingPeers,
    });

    // Notify existing peers about the new peer
    existingPeers.forEach(peerId => {
      const peer = this.clients.get(peerId);
      if (peer) {
        this.send(peer.ws, {
          type: 'announce',
          peerId: clientId,
        });
      }
    });
  }

  private handleLeave(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client || !client.room) return;

    const room = this.rooms.get(client.room);
    if (room) {
      room.delete(clientId);
      
      // Notify other peers in the room
      room.forEach(peerId => {
        const peer = this.clients.get(peerId);
        if (peer) {
          this.send(peer.ws, {
            type: 'leave',
            peerId: clientId,
          });
        }
      });

      // Clean up empty rooms
      if (room.size === 0) {
        this.rooms.delete(client.room);
      }

      console.log(`👋 Client ${clientId} left room ${client.room}`);
    }

    client.room = null;
  }

  private handleSignal(clientId: string, message: SignalMessage) {
    if (!message.to) {
      console.error('Signal message missing "to" field');
      return;
    }

    const targetClient = this.clients.get(message.to);
    if (!targetClient) {
      console.error(`Target client ${message.to} not found`);
      return;
    }

    // Forward the signal to the target peer
    this.send(targetClient.ws, {
      type: 'signal',
      from: clientId,
      signal: message.signal,
    });
  }

  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.handleLeave(clientId);
    this.clients.delete(clientId);

    console.log(`❌ Client disconnected: ${clientId}. Total clients: ${this.clients.size}`);
  }

  private send(ws: WebSocket, message: SignalMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          console.log(`💀 Client ${clientId} failed heartbeat, terminating`);
          client.ws.terminate();
          this.handleDisconnect(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, HEARTBEAT_INTERVAL);
  }

  public getStats() {
    return {
      clients: this.clients.size,
      rooms: this.rooms.size,
      roomDetails: Array.from(this.rooms.entries()).map(([room, peers]) => ({
        room,
        peers: peers.size,
      })),
    };
  }
}

// Start the server
const server = new SignalingServer(PORT);

// Log stats every minute
setInterval(() => {
  const stats = server.getStats();
  console.log('📊 Server stats:', stats);
}, 60000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});
