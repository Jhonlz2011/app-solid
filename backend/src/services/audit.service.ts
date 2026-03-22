import { sql, inArray } from '@app/schema';
import { db, listener } from '../db';
import { auditQueue, auditLogs, actionEnum } from '@app/schema/tables';

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
    operation: (tx: any) => Promise<T>
): Promise<T> {
    return await db.transaction(async (tx) => {
        // Enforce the lifespan of the context to the current transaction (IS_LOCAL = true)
        if (context?.userId) {
            await tx.execute(sql`SELECT set_config('app.user_id', ${context.userId.toString()}, true)`);
        }
        if (context?.ipAddress) {
            await tx.execute(sql`SELECT set_config('app.ip_address', ${context.ipAddress}, true)`);
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
            const pendingLogs = await db.select().from(auditQueue).limit(BATCH_SIZE);
            
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
                    userId: log.userId ? parseInt(log.userId, 10) : null,
                    ipAddress: log.ipAddress || null,
                    createdAt: log.createdAt,
                };
            });

            // 3. ACID transaction to move the batch safely
            await db.transaction(async (tx) => {
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

export function startAuditWorker() {
    // Escuchar notificaciones de Postgres para procesar la cola reactivamente (Wake-Up Pattern)
    listener.listen('audit_queue_channel', () => {
        // Debouncer para agrupar múltiples notificaciones rápidas en un solo procesamiento
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(() => {
            processAuditQueue();
        }, 250);
    });

    console.log(`✅ Audit Worker Event Listener started in background (Wake-Up Pattern)`);
    
    // Procesar cualquier registro que haya quedado huérfano antes que reviviera el servidor
    processAuditQueue();
}

export function stopAuditWorker() {
    if (debounceTimeout) {
        clearTimeout(debounceTimeout);
    }
    console.log("⏹️ Audit Worker suspended (connection closes with server)");
}
