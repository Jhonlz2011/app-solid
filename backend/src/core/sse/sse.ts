import { Elysia, t } from 'elysia';
import { auth } from '../../config/better-auth';
import {
    clients,
    addToRoomIndex,
    removeFromRoomIndex,
    removeClientFromAllRooms,
    type SseClient,
} from './events';

// --- SSE ROUTE PLUGIN ---
export const ssePlugin = (app: Elysia) =>
    app.group('/sse', (group) => group
        .get('/', async ({ request, query, set }) => {
            const headers = new Headers(request.headers);
            if (query.token && !headers.get('cookie')?.includes('better-auth.session_token')) {
                headers.set('authorization', `Bearer ${query.token}`);
            }

            const sessionData = await auth.api.getSession({
                headers,
            });

            if (!sessionData || !sessionData.user) {
                set.status = 401;
                return 'Sesión requerida';
            }

            const userId = sessionData.user.id;
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
                        clearInterval(existingClient.pingInterval);
                        try {
                            existingClient.controller.close();
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
                        clearInterval(client.pingInterval);
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
