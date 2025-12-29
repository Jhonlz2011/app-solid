import { Elysia } from 'elysia';
import { encode, decode } from '@msgpack/msgpack';

// Store active connections with optional room subscriptions
interface WsClient {
    ws: any;
    rooms: Set<string>;
}

const clients = new Map<string, WsClient>();

/**
 * Generate unique client ID
 */
function generateClientId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * WebSocket plugin with MessagePack support and room-based subscriptions
 */
export const wsPlugin = (app: Elysia) =>
    app.ws('/ws', {
        open(ws) {
            const clientId = generateClientId();
            (ws as any).clientId = clientId;
            clients.set(clientId, { ws, rooms: new Set(['*']) }); // Subscribe to all by default
            console.log(`🔌 WS Connected: ${clientId} (Total: ${clients.size})`);
        },

        message(ws, message) {
            try {
                // Try to decode as MessagePack first, fallback to JSON
                let data: any;
                if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
                    data = decode(message instanceof ArrayBuffer ? new Uint8Array(message) : message);
                } else if (typeof message === 'string') {
                    data = JSON.parse(message);
                } else {
                    data = message;
                }

                // Handle subscription commands
                if (data.type === 'subscribe' && data.room) {
                    const clientId = (ws as any).clientId;
                    const client = clients.get(clientId);
                    if (client) {
                        client.rooms.add(data.room);
                        ws.send(encode({ type: 'subscribed', room: data.room }));
                    }
                } else if (data.type === 'unsubscribe' && data.room) {
                    const clientId = (ws as any).clientId;
                    const client = clients.get(clientId);
                    if (client) {
                        client.rooms.delete(data.room);
                        ws.send(encode({ type: 'unsubscribed', room: data.room }));
                    }
                }
            } catch (e) {
                console.error('WS message parse error:', e);
            }
        },

        close(ws) {
            const clientId = (ws as any).clientId;
            clients.delete(clientId);
            console.log(`🔌 WS Disconnected: ${clientId} (Total: ${clients.size})`);
        },
    });

/**
 * Broadcast to all clients or specific room using MessagePack (binary)
 * @param event - Event name
 * @param data - Data to send
 * @param room - Optional room (default: broadcast to all)
 */
export function broadcast(event: string, data: any, room: string = '*'): void {
    // Use Buffer.from() for Bun WebSocket to properly send as binary
    const encoded = encode({ event, data, timestamp: Date.now() });
    const message = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);

    for (const [clientId, client] of clients) {
        // Send if client is subscribed to this room or to '*' (all)
        if (client.rooms.has(room) || client.rooms.has('*') || room === '*') {
            try {
                client.ws.send(message);
            } catch (e) {
                console.error(`Error broadcasting to ${clientId}:`, e);
                clients.delete(clientId);
            }
        }
    }
}

/**
 * Broadcast JSON (for backward compatibility)
 */
export function broadcastJSON(event: string, data: any, room: string = '*'): void {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });

    for (const [clientId, client] of clients) {
        if (client.rooms.has(room) || client.rooms.has('*') || room === '*') {
            try {
                client.ws.send(message);
            } catch (e) {
                console.error(`Error broadcasting JSON to ${clientId}:`, e);
                clients.delete(clientId);
            }
        }
    }
}

/**
 * Get connected clients count
 */
export function getConnectedCount(): number {
    return clients.size;
}

/**
 * Get clients in a specific room
 */
export function getRoomClients(room: string): number {
    let count = 0;
    for (const client of clients.values()) {
        if (client.rooms.has(room)) count++;
    }
    return count;
}
