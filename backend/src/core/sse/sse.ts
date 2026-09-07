import { Elysia, t } from 'elysia';
import { auth, resolveCompanyIdFromOrg } from '../../config/better-auth';
import { adminDb } from '../db';
import { companies, member, session as sessionTable, user as schemaUser } from '@app/schema/tables';
import { eq, and, or, sql } from '@app/schema';
import { resolveSlugFromHost } from '@app/schema/utils';
import {
    clients,
    addToRoomIndex,
    removeClientFromAllRooms,
    type SseClient,
} from './events';
import { getUserRoom, getCompanyRoom } from '@app/schema/realtime-events';

// --- SSE ROUTE PLUGIN ---
export const ssePlugin = (app: Elysia) =>
    app.group('/sse', (group) => group
        .get('/', async ({ request, query, set }) => {
            const headers = new Headers(request.headers);
            if (query.token && !headers.get('cookie')?.includes('better-auth.session_token')) {
                headers.set('authorization', `Bearer ${query.token}`);
            }

            let sessionData = await auth.api.getSession({
                headers,
            }).catch(() => null);

            // Resilient Session Fallback: If cookie/Bearer wasn't resolved by Better-Auth,
            // check if query.token matches a valid session ID or session token in DB
            if (!sessionData && query.token) {
                const [dbSession] = await adminDb
                    .select({
                        id: sessionTable.id,
                        userId: sessionTable.userId,
                        token: sessionTable.token,
                        activeOrganizationId: sessionTable.activeOrganizationId,
                        expiresAt: sessionTable.expiresAt,
                    })
                    .from(sessionTable)
                    .where(
                        and(
                            or(eq(sessionTable.id, query.token), eq(sessionTable.token, query.token)),
                            sql`${sessionTable.expiresAt} > NOW()`
                        )
                    )
                    .limit(1);

                if (dbSession) {
                    const [dbUser] = await adminDb
                        .select()
                        .from(schemaUser)
                        .where(eq(schemaUser.id, dbSession.userId))
                        .limit(1);

                    if (dbUser) {
                        sessionData = {
                            user: dbUser as any,
                            session: dbSession as any,
                        };
                    }
                }
            }

            if (!sessionData || !sessionData.user) {
                set.status = 401;
                return 'Sesión requerida';
            }

            const userId = sessionData.user.id;
            const clientId = query.clientId || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

            // Resolve company context for this SSE connection
            let companyId: number | null = null;
            const activeOrgId = sessionData.session.activeOrganizationId;
            if (activeOrgId) {
                companyId = await resolveCompanyIdFromOrg(activeOrgId);
            }

            // Align with host subdomain if present
            const host = request.headers.get('x-original-host') || request.headers.get('origin') || request.headers.get('host') || '';
            const slug = query.slug || request.headers.get('x-tenant-slug') || resolveSlugFromHost(host);
            if (slug) {
                const [hostCompany] = await adminDb
                    .select({ id: companies.id, organization_id: companies.organization_id })
                    .from(companies)
                    .where(eq(companies.slug, slug))
                    .limit(1);

                if (hostCompany?.organization_id) {
                    const [memberRow] = await adminDb
                        .select({ id: member.id })
                        .from(member)
                        .where(and(
                            eq(member.userId, userId),
                            eq(member.organizationId, hostCompany.organization_id)
                        ))
                        .limit(1);
                    if (memberRow) {
                        companyId = hostCompany.id;
                    }
                }
            }

            if (!companyId) {
                const rawUser = sessionData.user as typeof sessionData.user & { companyId?: number; company_id?: number };
                companyId = rawUser.companyId || rawUser.company_id || null;
            }

            const stream = new ReadableStream({
                start(controller) {
                    const rooms = new Set<string>();
                    if (userId) {
                        rooms.add(getUserRoom(userId));
                    }
                    if (companyId) {
                        rooms.add(getCompanyRoom(companyId));
                    }

                    const pingInterval = setInterval(() => {
                        try {
                            controller.enqueue(`event: heartbeat\ndata: ${Date.now()}\n\n`);
                        } catch (e) {
                            clearInterval(pingInterval);
                        }
                    }, 25000);

                    const clientObj: SseClient = { controller, rooms, userId, companyId, pingInterval };

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

                    console.log(`🔌 SSE Connected: ${clientId} (userId: ${userId}, companyId: ${companyId ?? 'none'}, Total: ${clients.size})`);

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
                    console.log(`🔌 SSE Disconnected: ${clientId} (Total: ${clients.size})`);
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
                token: t.Optional(t.String()),
                slug: t.Optional(t.String()),
            })
        })
    );
