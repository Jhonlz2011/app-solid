import { Elysia, t } from 'elysia';
import { validateSession } from '../services/auth.service';
import { publishToChannel, subscribeToChannel } from '../config/redis';

// --- TYPES ---
interface SseClient {
    controller: ReadableStreamDefaultController<string>;
    rooms: Set<string>;
    userId: number | null;
    pingInterval: ReturnType<typeof setInterval>;
}

// --- STATE ---
const clients = new Map<string, SseClient>();
const roomIndex = new Map<string, Set<string>>();

// --- HELPERS ---
function addToRoomIndex(clientId: string, room: string): void {
    let roomClients = roomIndex.get(room);
    if (!roomClients) {
        roomClients = new Set();
        roomIndex.set(room, roomClients);
    }
    roomClients.add(clientId);
}

function removeFromRoomIndex(clientId: string, room: string): void {
    const roomClients = roomIndex.get(room);
    if (roomClients) {
        roomClients.delete(clientId);
        if (roomClients.size === 0) {
            roomIndex.delete(room);
        }
    }
}

function removeClientFromAllRooms(clientId: string, rooms: Set<string>): void {
    for (const room of rooms) {
        removeFromRoomIndex(clientId, room);
    }
}

// --- SSE PLUGIN ---
export const ssePlugin = (app: Elysia) =>
    app.group('/sse', (group) => group
        .get('/', async ({ request, query, set, cookie }) => {
            let sessionToken: string | null = (cookie?.session?.value as string) || null;

            if (!sessionToken && query.token) {
                sessionToken = query.token;
            }

            if (!sessionToken) {
                set.status = 401;
                return 'Session requerida';
            }

            const result = await validateSession(sessionToken);
            if (!result) {
                set.status = 401;
                return 'Sesión inválida o expirada';
            }

            const userId = result.session.user_id;
            const clientId = query.clientId || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

            const stream = new ReadableStream({
                start(controller) {
                    const rooms = new Set<string>(['*']);
                    if (userId) {
                        rooms.add(`user:${userId}`);
                    }

                    const pingInterval = setInterval(() => {
                        try {
                            controller.enqueue(":\n\n");
                        } catch (e) {
                            clearInterval(pingInterval);
                        }
                    }, 25000);

                    const clientObj: SseClient = { controller, rooms, userId, pingInterval };

                    // Close existing if reconnecting with same ID
                    const existingClient = clients.get(clientId);
                    if (existingClient) {
                        clearInterval(existingClient.pingInterval); // Matamos el intervalo viejo
                        try {
                            existingClient.controller.close(); // Cerramos el stream viejo
                        } catch (e) { }
                    }

                    clients.set(clientId, clientObj);

                    for (const room of rooms) {
                        addToRoomIndex(clientId, room);
                    }

                    console.log("🔌 SSE Connected: " + clientId + " (userId: " + (userId ?? "anonymous") + ", Total: " + clients.size + ")");

                    const connectPayload = JSON.stringify(clientId);
                    controller.enqueue(`event: connected\ndata: ${connectPayload}\n\n`);
                },
                cancel() {
                    const client = clients.get(clientId);
                    if (client) {
                        clearInterval(client.pingInterval); // Matamos el intervalo
                        removeClientFromAllRooms(clientId, client.rooms);
                    }
                    clients.delete(clientId);
                    console.log("🔌 SSE Disconnected: " + clientId + " (Total: " + clients.size + ")");
                }
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                }
            });
        }, {
            query: t.Object({
                clientId: t.Optional(t.String()),
                token: t.Optional(t.String())
            })
        })
        .post('/join', ({ body, set }) => {
            const client = clients.get(body.clientId);
            if (!client) {
                set.status = 404;
                return { error: 'Client not found or disconnected' };
            }
            if (!client.rooms.has(body.room)) {
                client.rooms.add(body.room);
                addToRoomIndex(body.clientId, body.room);
            }
            return { success: true, room: body.room };
        }, {
            body: t.Object({
                clientId: t.String(),
                room: t.String()
            })
        })
        .post('/leave', ({ body, set }) => {
            const client = clients.get(body.clientId);
            if (!client) {
                set.status = 404;
                return { error: 'Client not found or disconnected' };
            }
            if (client.rooms.has(body.room)) {
                client.rooms.delete(body.room);
                removeFromRoomIndex(body.clientId, body.room);
            }
            return { success: true, room: body.room };
        }, {
            body: t.Object({
                clientId: t.String(),
                room: t.String()
            })
        })
    );

// --- REDIS ADAPTER ---

export async function initSSERedisAdapter() {
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
        roomIndex.get('*')?.forEach(id => targets.add(id));
    }
    return Array.from(targets);
}

function broadcastLocal(event: string, data: unknown, room: string = '*'): void {
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
