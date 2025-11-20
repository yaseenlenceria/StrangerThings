import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { WSMessage } from "@shared/schema";

interface Client {
  id: string;
  ws: WebSocket;
  partnerId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Create WebSocket server on /ws path (distinct from Vite's HMR)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const clients = new Map<string, Client>();
  const waitingQueue: string[] = [];

  // Generate unique client ID
  const generateId = () => Math.random().toString(36).substring(2, 15);

  // Send message to client
  const sendToClient = (clientId: string, message: WSMessage) => {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  };

  // Pair two clients together
  const pairClients = (id1: string, id2: string) => {
    const client1 = clients.get(id1);
    const client2 = clients.get(id2);

    if (!client1 || !client2) return;

    client1.partnerId = id2;
    client2.partnerId = id1;

    // Notify both clients of the match
    // id1 (the one who just joined and matched) is the initiator
    sendToClient(id1, { type: "match", partnerId: id2, initiator: true });
    sendToClient(id2, { type: "match", partnerId: id1, initiator: false });
  };

  // Remove client from queue and partnerships
  const removeClient = (clientId: string) => {
    const client = clients.get(clientId);
    
    // Remove from waiting queue
    const queueIndex = waitingQueue.indexOf(clientId);
    if (queueIndex > -1) {
      waitingQueue.splice(queueIndex, 1);
    }

    // Notify partner if exists
    if (client?.partnerId) {
      const partner = clients.get(client.partnerId);
      if (partner) {
        partner.partnerId = undefined;
        sendToClient(partner.id, { type: "next" });
      }
    }

    clients.delete(clientId);
  };

  wss.on("connection", (ws: WebSocket) => {
    const clientId = generateId();
    const client: Client = { id: clientId, ws };
    clients.set(clientId, client);

    console.log(`Client connected: ${clientId}`);

    // Setup ping/pong keepalive to prevent timeout
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000); // Ping every 30 seconds

    ws.on("pong", () => {
      console.log(`Received pong from ${clientId}`);
    });

    ws.on("message", (data: string) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;

        switch (message.type) {
          case "match": {
            // Client wants to be matched
            if (waitingQueue.length > 0) {
              // Pair with first person in queue
              const partnerId = waitingQueue.shift()!;
              pairClients(clientId, partnerId);
            } else {
              // Add to queue
              if (!waitingQueue.includes(clientId)) {
                waitingQueue.push(clientId);
              }
            }
            break;
          }

          case "offer": {
            // Forward offer to partner
            if (client.partnerId) {
              sendToClient(client.partnerId, {
                type: "offer",
                sdp: message.sdp,
                from: clientId,
              });
            }
            break;
          }

          case "answer": {
            // Forward answer to partner
            if (client.partnerId) {
              sendToClient(client.partnerId, {
                type: "answer",
                sdp: message.sdp,
                from: clientId,
              });
            }
            break;
          }

          case "ice": {
            // Forward ICE candidate to partner
            if (client.partnerId) {
              sendToClient(client.partnerId, {
                type: "ice",
                candidate: message.candidate,
                from: clientId,
              });
            }
            break;
          }

          case "next": {
            // Client wants to find next partner
            if (client.partnerId) {
              const partner = clients.get(client.partnerId);
              if (partner) {
                partner.partnerId = undefined;
                sendToClient(partner.id, { type: "next" });
              }
              client.partnerId = undefined;
            }

            // Remove from queue if in it
            const queueIndex = waitingQueue.indexOf(clientId);
            if (queueIndex > -1) {
              waitingQueue.splice(queueIndex, 1);
            }

            // Try to match again
            if (waitingQueue.length > 0) {
              const partnerId = waitingQueue.shift()!;
              pairClients(clientId, partnerId);
            } else {
              waitingQueue.push(clientId);
            }
            break;
          }

          case "leave": {
            removeClient(clientId);
            break;
          }
        }
      } catch (error) {
        console.error("Error processing message:", error);
        sendToClient(clientId, {
          type: "error",
          message: "Invalid message format",
        });
      }
    });

    ws.on("close", () => {
      console.log(`Client disconnected: ${clientId}`);
      clearInterval(pingInterval);
      removeClient(clientId);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      clearInterval(pingInterval);
      removeClient(clientId);
    });
  });

  return httpServer;
}
