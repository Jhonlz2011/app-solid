import { Elysia } from 'elysia';
import { encode, decode } from '@msgpack/msgpack';

// --- TYPES ---
interface WsClient {
    ws: any;
    rooms: Set<string>;
}

// --- STATE ---
// Main client storage
const clients = new Map<string, WsClient>();

// Room-based index for O(1) broadcast lookups
const roomIndex = new Map<string, Set<string>>();

// --- HELPERS ---

function generateClientId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Add client to room index
 */
function addToRoomIndex(clientId: string, room: string): void {
    let roomClients = roomIndex.get(room);
    if (!roomClients) {
        roomClients = new Set();
        roomIndex.set(room, roomClients);
    }
    roomClients.add(clientId);
}

/**
 * Remove client from room index
 */
function removeFromRoomIndex(clientId: string, room: string): void {
    const roomClients = roomIndex.get(room);
    if (roomClients) {
        roomClients.delete(clientId);
        // Clean up empty rooms
        if (roomClients.size === 0) {
            roomIndex.delete(room);
        }
    }
}

/**
 * Remove client from all rooms in index
 */
function removeClientFromAllRooms(clientId: string, rooms: Set<string>): void {
    for (const room of rooms) {
        removeFromRoomIndex(clientId, room);
    }
}

// --- WEBSOCKET PLUGIN ---

export const wsPlugin = (app: Elysia) =>
    app.ws('/ws', {
        open(ws) {
            const clientId = generateClientId();
            (ws as any).clientId = clientId;

            // Initialize with wildcard subscription
            const rooms = new Set(['*']);
            clients.set(clientId, { ws, rooms });

            // Add to room index
            addToRoomIndex(clientId, '*');

            console.log(`🔌 WS Connected: ${clientId} (Total: ${clients.size})`);
        },

        message(ws, message) {
            try {
                let data: any;

                // Decode message (MessagePack or JSON)
                if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
                    data = decode(message instanceof ArrayBuffer ? new Uint8Array(message) : message);
                } else if (typeof message === 'string') {
                    data = JSON.parse(message);
                } else {
                    data = message;
                }

                const clientId = (ws as any).clientId;
                const client = clients.get(clientId);
                if (!client) return;

                // Handle subscription commands
                if (data.type === 'subscribe' && data.room) {
                    if (!client.rooms.has(data.room)) {
                        client.rooms.add(data.room);
                        addToRoomIndex(clientId, data.room);
                    }
                    ws.send(encode({ type: 'subscribed', room: data.room }));
                } else if (data.type === 'unsubscribe' && data.room) {
                    if (client.rooms.has(data.room)) {
                        client.rooms.delete(data.room);
                        removeFromRoomIndex(clientId, data.room);
                    }
                    ws.send(encode({ type: 'unsubscribed', room: data.room }));
                }
            } catch (e) {
                console.error('WS message parse error:', e);
            }
        },

        close(ws) {
            const clientId = (ws as any).clientId;
            const client = clients.get(clientId);

            if (client) {
                // Clean up room index
                removeClientFromAllRooms(clientId, client.rooms);
                clients.delete(clientId);
            }

            console.log(`🔌 WS Disconnected: ${clientId} (Total: ${clients.size})`);
        },
    });

// --- BROADCAST FUNCTIONS ---

/**
 * Broadcast to all clients or specific room using MessagePack (binary)
 * Optimized with room indexing for O(1) lookups
 */
export function broadcast(event: string, data: any, room: string = '*'): void {
    // Encode message once
    const encoded = encode({ event, data, timestamp: Date.now() });
    const message = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);

    // Collect target clients (avoid duplicates when broadcasting to '*')
    const targetClients = new Set<string>();

    if (room === '*') {
        // Broadcast to everyone
        for (const clientId of clients.keys()) {
            targetClients.add(clientId);
        }
    } else {
        // Get clients subscribed to this specific room
        const roomClients = roomIndex.get(room);
        if (roomClients) {
            for (const clientId of roomClients) {
                targetClients.add(clientId);
            }
        }

        // Also include clients subscribed to wildcard '*'
        const wildcardClients = roomIndex.get('*');
        if (wildcardClients) {
            for (const clientId of wildcardClients) {
                targetClients.add(clientId);
            }
        }
    }

    // Send to all target clients
    for (const clientId of targetClients) {
        const client = clients.get(clientId);
        if (client) {
            try {
                client.ws.send(message);
            } catch (e) {
                console.error(`Error broadcasting to ${clientId}:`, e);
                // Clean up failed connection
                removeClientFromAllRooms(clientId, client.rooms);
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

    const targetClients = new Set<string>();

    if (room === '*') {
        for (const clientId of clients.keys()) {
            targetClients.add(clientId);
        }
    } else {
        const roomClients = roomIndex.get(room);
        if (roomClients) {
            for (const clientId of roomClients) {
                targetClients.add(clientId);
            }
        }
        const wildcardClients = roomIndex.get('*');
        if (wildcardClients) {
            for (const clientId of wildcardClients) {
                targetClients.add(clientId);
            }
        }
    }

    for (const clientId of targetClients) {
        const client = clients.get(clientId);
        if (client) {
            try {
                client.ws.send(message);
            } catch (e) {
                console.error(`Error broadcasting JSON to ${clientId}:`, e);
                removeClientFromAllRooms(clientId, client.rooms);
                clients.delete(clientId);
            }
        }
    }
}

// --- STATS ---

export function getConnectedCount(): number {
    return clients.size;
}

export function getRoomClients(room: string): number {
    return roomIndex.get(room)?.size || 0;
}

export function getRoomStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [room, clientSet] of roomIndex) {
        stats[room] = clientSet.size;
    }
    return stats;
}
