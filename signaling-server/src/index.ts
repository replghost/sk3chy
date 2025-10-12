import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4444;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

interface YWebRTCMessage {
  type: 'subscribe' | 'unsubscribe' | 'publish' | 'ping' | 'pong';
  topics?: string[];
  topic?: string;
  clients?: number[];
  [key: string]: any;
}

interface Client {
  ws: WebSocket;
  topics: Set<string>;
  isAlive: boolean;
}

class YWebRTCSignalingServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, Client> = new Map();
  private topics: Map<string, Set<WebSocket>> = new Map();
  private heartbeatInterval: Timer | null = null;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    console.log(`🚀 y-webrtc signaling server started on port ${port}`);
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    this.startHeartbeat();
  }

  private handleConnection(ws: WebSocket) {
    const client: Client = {
      ws,
      topics: new Set(),
      isAlive: true,
    };

    this.clients.set(ws, client);
    console.log(`✅ Client connected. Total clients: ${this.clients.size}`);

    ws.on('message', (data: Buffer) => {
      try {
        const message: YWebRTCMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('pong', () => {
      const client = this.clients.get(ws);
      if (client) {
        client.isAlive = true;
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnect(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: YWebRTCMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(ws, message.topics || []);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(ws, message.topics || []);
        break;

      case 'publish':
        this.handlePublish(ws, message);
        break;

      case 'ping':
        this.send(ws, { type: 'pong' });
        break;
    }
  }

  private handleSubscribe(ws: WebSocket, topics: string[]) {
    const client = this.clients.get(ws);
    if (!client) return;

    topics.forEach(topic => {
      // Add client to topic
      client.topics.add(topic);
      
      if (!this.topics.has(topic)) {
        this.topics.set(topic, new Set());
      }
      
      const topicClients = this.topics.get(topic)!;
      topicClients.add(ws);

      console.log(`📢 Client subscribed to topic: ${topic}. Topic size: ${topicClients.size}`);

      // Notify client about existing peers in this topic
      const existingClients = Array.from(topicClients)
        .filter(c => c !== ws)
        .map((_, index) => index);

      if (existingClients.length > 0) {
        this.send(ws, {
          type: 'publish',
          topic,
          clients: existingClients,
        });
      }
    });
  }

  private handleUnsubscribe(ws: WebSocket, topics: string[]) {
    const client = this.clients.get(ws);
    if (!client) return;

    topics.forEach(topic => {
      client.topics.delete(topic);
      
      const topicClients = this.topics.get(topic);
      if (topicClients) {
        topicClients.delete(ws);
        
        // Clean up empty topics
        if (topicClients.size === 0) {
          this.topics.delete(topic);
        }
        
        console.log(`📢 Client unsubscribed from topic: ${topic}`);
      }
    });
  }

  private handlePublish(ws: WebSocket, message: YWebRTCMessage) {
    const topic = message.topic;
    if (!topic) return;

    const topicClients = this.topics.get(topic);
    if (!topicClients) return;

    // Broadcast message to all clients in the topic except sender
    topicClients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        this.send(client, message);
      }
    });
  }

  private handleDisconnect(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Remove client from all topics
    client.topics.forEach(topic => {
      const topicClients = this.topics.get(topic);
      if (topicClients) {
        topicClients.delete(ws);
        
        // Clean up empty topics
        if (topicClients.size === 0) {
          this.topics.delete(topic);
        }
      }
    });

    this.clients.delete(ws);
    console.log(`❌ Client disconnected. Total clients: ${this.clients.size}`);
  }

  private send(ws: WebSocket, message: YWebRTCMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, ws) => {
        if (!client.isAlive) {
          console.log('💀 Client failed heartbeat, terminating');
          ws.terminate();
          this.handleDisconnect(ws);
          return;
        }

        client.isAlive = false;
        ws.ping();
      });
    }, HEARTBEAT_INTERVAL);
  }

  public getStats() {
    return {
      clients: this.clients.size,
      topics: this.topics.size,
      topicDetails: Array.from(this.topics.entries()).map(([topic, clients]) => ({
        topic,
        clients: clients.size,
      })),
    };
  }
}

// Start the server
const server = new YWebRTCSignalingServer(PORT);

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
