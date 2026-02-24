import { Elysia } from 'elysia';
import { encode, decode } from '@msgpack/msgpack';
import { validateSession } from '../services/auth.service';

// --- TYPES ---
interface WsClient {
    ws: { send(data: string | ArrayBuffer | ArrayBufferView): void; close(code?: number, reason?: string): void };
    rooms: Set<string>;
    userId: number | null;
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
            // Extract session token from cookie header (sent automatically by browser on WS upgrade)
            let sessionToken: string | null = null;
            try {
                const request = (ws as any).data?.request;
                const cookieHeader = request?.headers?.get?.('cookie') || '';
                const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
                if (match) {
                    sessionToken = match[1];
                }

                // Fallback: check query param (for cross-origin setups)
                if (!sessionToken) {
                    const rawUrl = request?.url || (ws as any).data?.url || '';
                    if (rawUrl) {
                        const url = new URL(rawUrl, 'http://localhost');
                        sessionToken = url.searchParams.get('token');
                    }
                }
            } catch {
                // Parse failed
            }

            if (!sessionToken) {
                ws.close(4001, 'Session requerida');
                return;
            }

            // Validate session against DB
            const result = await validateSession(sessionToken);
            if (!result) {
                ws.close(4001, 'Sesión inválida o expirada');
                return;
            }

            const userId = result.session.user_id;

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
                // Elysia auto-parses JSON messages to objects
                if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
                    data = decode(message instanceof ArrayBuffer ? new Uint8Array(message) : message);
                } else if (typeof message === 'string') {
                    data = JSON.parse(message);
                } else {
                    // Elysia auto-parsed JSON → already an object
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
                    ws.send(JSON.stringify({ type: 'subscribed', room: data.room }));
                } else if (data.type === 'unsubscribe' && data.room) {
                    if (client.rooms.has(data.room)) {
                        client.rooms.delete(data.room);
                        removeFromRoomIndex(clientId, data.room);
                    }
                    ws.send(JSON.stringify({ type: 'unsubscribed', room: data.room }));
                }
            } catch (e) {
                console.error('WS message parse error:', e);
            }
        },

        close(ws) {
            const clientId = (ws as any).clientId;
            const client = clients.get(clientId);

            if (client) {
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
            if (format === 'msgpack') {
                broadcastLocalBinary(event, data, room);
            } else {
                broadcastLocalJSON(event, data, room);
            }
        } catch (e) {
            console.error('Redis WS message parse error:', e);
        }
    });

    console.log('✅ Redis WebSocket Adapter Initialized');
}

// --- BROADCAST ---

/**
 * Broadcast event via Redis Pub/Sub using MessagePack (binary).
 * Smaller payload, faster parsing on the client.
 * 
 * NOTE: Elysia's ws.send() requires Buffer.from() for binary data.
 * Raw Uint8Array from encode() gets JSON-stringified by Elysia's wrapper.
 */
export async function broadcast(event: string, data: unknown, room: string = '*'): Promise<void> {
    try {
        const payload = JSON.stringify({ event, data, room, format: 'msgpack' });
        await redis.publish('ws:events', payload);
    } catch (e) {
        console.error('❌ WS broadcast failed:', e);
    }
}

/**
 * Broadcast event via Redis Pub/Sub using JSON (text).
 * Used for session events where simplicity matters over performance.
 */
export async function broadcastJSON(event: string, data: unknown, room: string = '*'): Promise<void> {
    try {
        const payload = JSON.stringify({ event, data, room, format: 'json' });
        await redis.publish('ws:events', payload);
    } catch (e) {
        console.error('❌ WS broadcastJSON failed:', e);
    }
}

// --- BROADCAST INTERNALS ---

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
function sendToClients(targetIds: string[], message: Buffer | string): void {
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
 * Broadcast MessagePack binary to local clients.
 * Uses Buffer.from() because Elysia's ws.send() JSON-stringifies raw Uint8Array.
 */
function broadcastLocalBinary(event: string, data: unknown, room: string = '*'): void {
    const encoded = encode({ event, data, timestamp: Date.now() });
    // CRITICAL: Buffer.from() required — Elysia treats raw Uint8Array as object and JSON.stringifies it
    const message = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
    sendToClients(getTargetClientIds(room), message);
}

/**
 * Broadcast JSON to local clients.
 */
function broadcastLocalJSON(event: string, data: unknown, room: string = '*'): void {
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
