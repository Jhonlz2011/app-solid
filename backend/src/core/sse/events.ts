import { publishToChannel, subscribeToChannel, subscribeToPattern } from '../cache/redis';
import { getTenantRoom, getCompanyRoom, getUserRoom } from '@app/schema/realtime-events';

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
    const handleIncoming = (message: string) => {
        try {
            const parsed = JSON.parse(message);
            const { event, data, room } = parsed;
            broadcastLocal(event, data, room);
        } catch (e) {
            console.error('Redis SSE message parse error:', e);
        }
    };

    // 1. Canal global
    await subscribeToChannel('sse:events', handleIncoming);

    // 2. Canales sharded de tenants (sse:c:*)
    await subscribeToPattern('sse:c:*', (_pattern, _channel, message) => {
        handleIncoming(message);
    });

    // 3. Canales sharded de usuarios (sse:u:*)
    await subscribeToPattern('sse:u:*', (_pattern, _channel, message) => {
        handleIncoming(message);
    });

    console.log('✅ Redis SSE Adapter Initialized (Global + Tenant/User Patterns)');
}

// --- BROADCAST HELPERS ---

/**
 * Emite un evento canónico para un tenant.
 * Publica en el canal sharded de Redis 'sse:c:{companyId}'.
 * Entrega a la sala subRoom (ej: 'company:5:products') y a los clientes de la sala raíz 'company:5'.
 */
export async function broadcastToTenant(
    companyId: number,
    event: string,
    data: unknown,
    subRoom?: string
): Promise<void> {
    const canonicalRoom = subRoom ? getTenantRoom(companyId, subRoom) : getCompanyRoom(companyId);
    const channel = `sse:c:${companyId}`;
    try {
        const payload = JSON.stringify({ event, data, room: canonicalRoom, companyId });
        await publishToChannel(channel, payload);
    } catch (e) {
        console.error(`❌ SSE broadcastToTenant failed for company ${companyId}:`, e);
    }
}

/**
 * Emite un evento personal para un usuario específico.
 * Publica en el canal sharded de Redis 'sse:u:{userId}' y sala 'user:{userId}'.
 */
export async function broadcastToUser(
    userId: string | number,
    event: string,
    data: unknown
): Promise<void> {
    const canonicalRoom = getUserRoom(userId);
    const channel = `sse:u:${userId}`;
    try {
        const payload = JSON.stringify({ event, data, room: canonicalRoom, userId });
        await publishToChannel(channel, payload);
    } catch (e) {
        console.error(`❌ SSE broadcastToUser failed for user ${userId}:`, e);
    }
}

/**
 * Emisión general (fallback global)
 */
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
        // Clientes suscritos exactamente a esta sala
        roomIndex.get(room)?.forEach(id => targets.add(id));

        // Si es una subsala de tenant (ej: 'company:123:products'),
        // incluir también a los clientes en la sala raíz 'company:123'
        if (room.startsWith('company:')) {
            const parts = room.split(':');
            if (parts.length >= 3) {
                const rootCompanyRoom = `company:${parts[1]}`;
                roomIndex.get(rootCompanyRoom)?.forEach(id => targets.add(id));
            }
        }
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
