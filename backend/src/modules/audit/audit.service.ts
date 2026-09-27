import { sql, inArray } from '@app/schema';
import { db, adminDb, listener, tenantStorage, type Tx } from '../../core/db';
import { auditQueue, auditLogs } from '@app/schema/tables';

export interface AuditContext {
    userId?: number | string | null;
    ipAddress?: string | null;
    clientId?: string | null;
}

/**
 * Executes a transaction injecting user and IP context using PostgreSQL set_config.
 * This ensures the triggers spawned within the transaction have access to this context.
 */
export async function withAuditTransaction<T>(
    context: AuditContext | undefined,
    operation: (tx: Tx) => Promise<T>
): Promise<T> {
    return await db.transaction(async (tx: Tx) => {
        // Tenant context (company_id) is now auto-injected by the db proxy
        // from AsyncLocalStorage when the transaction starts.
        // We only need to set user_id and ip_address here for audit triggers.
        const store = tenantStorage.getStore();
        const userId = context?.userId || store?.userId;
        const ipAddress = context?.ipAddress || store?.ipAddress;

        if (userId) {
            await tx.execute(sql`SELECT set_config('app.user_id', ${userId.toString()}, true)`);
        }
        if (ipAddress) {
            await tx.execute(sql`SELECT set_config('app.ip_address', ${ipAddress}, true)`);
        }

        return await operation(tx);
    });
}

/**
 * Removes sensitive data (like password hashes or tokens) from the audit logs
 */
function scrubData(data: any): any {
    if (!data) return null;
    const cloned = { ...data };
    
    // Lista negra de propiedades
    const sensitiveKeys = ['password_hash', 'token', 'secret'];
    
    for (const key of sensitiveKeys) {
        if (key in cloned) {
            delete cloned[key];
        }
    }
    
    return cloned;
}

const BATCH_SIZE = 500;
let isProcessing = false;

/**
 * Background worker to move audit trails from the RAM-optimized queue mapping to the target log table
 */
export async function processAuditQueue() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        let hasMore = true;
        while (hasMore) {
            // 1. Take a batch of up to 500 rows from the lightweight queue
            // Use adminDb to bypass RLS — this worker processes ALL tenants' audit logs
            const pendingLogs = await adminDb.select().from(auditQueue).limit(BATCH_SIZE);
            
            if (pendingLogs.length === 0) {
                hasMore = false;
                break;
            }

            const idsToDelete = pendingLogs.map(log => log.id);

            // 2. Format and scrub the payload for the final destination table
            const formattedLogs = pendingLogs.map(log => {
                // Validate the action against the enum
                const actionString = log.action.toUpperCase();
                
                return {
                    tableName: log.tableName,
                    recordId: log.recordId,
                    action: actionString as any, // Cast exactly to 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT'
                    oldData: scrubData(log.oldData),
                    newData: scrubData(log.newData),
                    userId: log.userId || null,
                    company_id: log.company_id || null,
                    ipAddress: log.ipAddress || null,
                    createdAt: log.createdAt,
                };
            });

            // 3. ACID transaction to move the batch safely
            // Use adminDb to bypass RLS — audit logs span all tenants
            await adminDb.transaction(async (tx) => {
                // Insert into the heavy, indexed destination table
                await tx.insert(auditLogs).values(formattedLogs);
                
                // Delete from the queue
                await tx.delete(auditQueue).where(inArray(auditQueue.id, idsToDelete));
            });

            console.log(`[Audit Worker] ${formattedLogs.length} logs successfully processed and scrubbed.`);
            
            // Wait for next cycle to release Event Loop slightly if many records are being dumped
            hasMore = pendingLogs.length === BATCH_SIZE;
            if (hasMore) {
                await new Promise(r => setTimeout(r, 50)); 
            }
        }

    } catch (error) {
        console.error("[Audit Worker] Error processing the audit queue:", error);
    } finally {
        isProcessing = false;
    }
}

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let listenerRetryTimeout: ReturnType<typeof setTimeout> | null = null;
let listenerRetryAttempt = 0;
let listenerConnecting = false;
let auditWorkerStarted = false;

const LISTENER_RETRY_BASE_MS = 1_000;
const LISTENER_RETRY_MAX_MS = 30_000;

function connectAuditListener() {
    if (listenerConnecting || listenerRetryTimeout) return;

    listenerConnecting = true;
    void listener.listen('audit_queue_channel', () => {
        // Debouncer para agrupar múltiples notificaciones rápidas en un solo procesamiento
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(() => {
            void processAuditQueue();
        }, 250);
    }).then(() => {
        listenerConnecting = false;
        listenerRetryAttempt = 0;
        console.log('✅ Audit Worker PostgreSQL listener connected');

        // Procesa cualquier registro pendiente al recuperar la conexión.
        void processAuditQueue();
    }).catch((error: unknown) => {
        listenerConnecting = false;
        const retryDelay = Math.min(
            LISTENER_RETRY_BASE_MS * 2 ** listenerRetryAttempt,
            LISTENER_RETRY_MAX_MS,
        );
        listenerRetryAttempt += 1;

        console.error(
            `[Audit Worker] PostgreSQL listener unavailable; retrying in ${retryDelay}ms`,
            error,
        );

        listenerRetryTimeout = setTimeout(() => {
            listenerRetryTimeout = null;
            connectAuditListener();
        }, retryDelay);
    });
}

export function startAuditWorker() {
    if (auditWorkerStarted) return;
    auditWorkerStarted = true;

    // PostgreSQL is a dependency of the worker, not a reason to crash the API process.
    connectAuditListener();

    // Procesar cualquier registro que haya quedado huérfano antes que reviviera el servidor
    void processAuditQueue();
}

export function stopAuditWorker() {
    if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
    }
    if (listenerRetryTimeout) {
        clearTimeout(listenerRetryTimeout);
        listenerRetryTimeout = null;
    }
    auditWorkerStarted = false;
    console.log("⏹️ Audit Worker suspended (connection closes with server)");
}
