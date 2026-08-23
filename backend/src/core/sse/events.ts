import { publishToChannel, subscribeToChannel } from '../cache/redis';

// --- TYPES ---
export interface SseClient {
    controller: ReadableStreamDefaultController<string>;
    rooms: Set<string>;
    userId: string | null;
    companyId: number | null;
    pingInterval: ReturnType<typeof setInterval>;
}

// --- STATE ---
export const clients = new Map<string, SseClient>();
export const roomIndex = new Map<string, Set<string>>();

// --- HELPERS ---
export function addToRoomIndex(clientId: string, room: string): void {
    let roomClients = roomIndex.get(room);
    if (!roomClients) {
        roomClients = new Set();
        roomIndex.set(room, roomClients);
    }
    roomClients.add(clientId);
}

export function removeFromRoomIndex(clientId: string, room: string): void {
    const roomClients = roomIndex.get(room);
    if (roomClients) {
        roomClients.delete(clientId);
        if (roomClients.size === 0) {
            roomIndex.delete(room);
        }
    }
}

export function removeClientFromAllRooms(clientId: string, rooms: Set<string>): void {
    for (const room of rooms) {
        removeFromRoomIndex(clientId, room);
    }
}

// --- REDIS ADAPTER ---

export async function initSSERedisAdapter(): Promise<void> {
    await subscribeToChannel('sse:events', (message) => {
        try {
            const parsed = JSON.parse(message);
            const { event, data, room } = parsed;
            broadcastLocal(event, data, room);
        } catch (e) {
            console.error('Redis SSE message parse error:', e);
        }
    });
    console.log('✅ Redis SSE Adapter Initialized');
}

// --- BROADCAST ---

export async function broadcast(event: string, data: unknown, room: string = '*'): Promise<void> {
    try {
        const payload = JSON.stringify({ event, data, room });
        await publishToChannel('sse:events', payload);
    } catch (e) {
        console.error('❌ SSE broadcast failed:', e);
    }
}

function getTargetClientIds(room: string): string[] {
    const targets = new Set<string>();
    if (room === '*') {
        for (const id of clients.keys()) targets.add(id);
    } else {
        roomIndex.get(room)?.forEach(id => targets.add(id));
    }
    return Array.from(targets);
}

export function broadcastLocal(event: string, data: unknown, room: string = '*'): void {
    const payloadString = typeof data === 'string' ? data : JSON.stringify(data);
    const sseMessage = `event: ${event}\ndata: ${payloadString}\n\n`;

    const targetIds = getTargetClientIds(room);

    for (const clientId of targetIds) {
        const client = clients.get(clientId);
        if (!client) continue;
        try {
            client.controller.enqueue(sseMessage);
        } catch (e) {
            clearInterval(client.pingInterval);
            removeClientFromAllRooms(clientId, client.rooms);
            clients.delete(clientId);
        }
    }
}

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
