import { Elysia } from 'elysia';
import { encode, decode } from '@msgpack/msgpack';
import { jwtVerify } from 'jose';

// --- TYPES ---
interface WsClient {
    ws: any;
    rooms: Set<string>;
    userId: number | null;
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

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
        async open(ws) {
            // Extract token from the raw request URL
            // Bun's ServerWebSocket stores the original request in ws.data
            let token: string | null = null;
            try {
                const rawUrl = (ws as any).data?.request?.url
                    || (ws as any).data?.url
                    || '';
                if (rawUrl) {
                    const url = new URL(rawUrl, 'http://localhost');
                    token = url.searchParams.get('token');
                }
            } catch {
                // URL parsing failed, continue without token
            }

            let userId: number | null = null;

            if (token) {
                try {
                    const { payload } = await jwtVerify(token, JWT_SECRET, {
                        algorithms: ['HS256'],
                    });
                    userId = Number(payload.userId) || null;
                } catch {
                    ws.close(4001, 'Token inválido o expirado');
                    return;
                }
            } else {
                ws.close(4001, 'Token requerido');
                return;
            }

            const clientId = generateClientId();
            (ws as any).clientId = clientId;

            // Initialize with wildcard subscription
            const rooms = new Set(['*']);
            clients.set(clientId, { ws, rooms, userId });

            // Add to room index
            addToRoomIndex(clientId, '*');

            // Auto-subscribe to user's personal room
            if (userId) {
                const userRoom = `user:${userId}`;
                rooms.add(userRoom);
                addToRoomIndex(clientId, userRoom);
            }

            console.log(`🔌 WS Connected: ${clientId} (userId: ${userId ?? 'anonymous'}, Total: ${clients.size})`);
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

// --- REDIS ADAPTER ---
import { redis, subscribeToChannel } from '../config/redis';

export async function initWsRedisAdapter() {
    await subscribeToChannel('ws:events', (message) => {
        try {
            const { event, data, room, format } = JSON.parse(message);

            if (format === 'json') {
                localBroadcastJSON(event, data, room);
            } else {
                localBroadcast(event, data, room);
            }
        } catch (e) {
            console.error('Redis WS message parse error:', e);
        }
    });

    console.log('✅ Redis WebSocket Adapter Initialized');
}

// --- BROADCAST FUNCTIONS ---

/**
 * Broadcast to all clients or specific room via Redis Pub/Sub
 * This ensures scaling across multiple instances
 */
export async function broadcast(event: string, data: any, room: string = '*'): Promise<void> {
    const payload = JSON.stringify({ event, data, room, format: 'msgpack' });
    await redis.publish('ws:events', payload);
}

/**
 * Broadcast JSON via Redis Pub/Sub
 */
export async function broadcastJSON(event: string, data: any, room: string = '*'): Promise<void> {
    const payload = JSON.stringify({ event, data, room, format: 'json' });
    await redis.publish('ws:events', payload);
}

// --- BROADCAST INTERNALS (Shared) ---

/**
 * Resolve target client IDs for a room (including wildcard subscribers)
 */
function getTargetClientIds(room: string): string[] {
    const targets = new Set<string>();
    if (room === '*') {
        for (const id of clients.keys()) targets.add(id);
    } else {
        roomIndex.get(room)?.forEach(id => targets.add(id));
        roomIndex.get('*')?.forEach(id => targets.add(id));
    }
    return Array.from(targets);
}

/**
 * Send a pre-encoded message to a list of client IDs
 */
function sendToClients(targetIds: string[], message: ArrayBuffer | string): void {
    for (const clientId of targetIds) {
        const client = clients.get(clientId);
        if (!client) continue;
        try {
            client.ws.send(message);
        } catch {
            removeClientFromAllRooms(clientId, client.rooms);
            clients.delete(clientId);
        }
    }
}

/**
 * INTERNAL: Broadcast MessagePack (binary) to local clients
 */
function localBroadcast(event: string, data: any, room: string = '*'): void {
    const encoded = encode({ event, data, timestamp: Date.now() });
    const message = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
    sendToClients(getTargetClientIds(room), message);
}

/**
 * INTERNAL: Broadcast JSON to local clients
 */
function localBroadcastJSON(event: string, data: any, room: string = '*'): void {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    sendToClients(getTargetClientIds(room), message);
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
