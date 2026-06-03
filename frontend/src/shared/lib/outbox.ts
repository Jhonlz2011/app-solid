import { get, set } from 'idb-keyval';

export interface PendingTransaction {
  id: string;
  entity: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  payload: any;
  headers?: Record<string, string>;
  createdAt: number;
}

/**
 * Encola una transacción en la bandeja de salida offline y registra el evento Sync.
 */
export async function queueOfflineTransaction(transaction: Omit<PendingTransaction, 'id' | 'createdAt'>) {
  const newTx: PendingTransaction = {
    ...transaction,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  };

  // 1. Guardar en IndexedDB
  const outbox: PendingTransaction[] = (await get('zelys-offline-outbox')) || [];
  outbox.push(newTx);
  await set('zelys-offline-outbox', outbox);

  console.log(`📦 Outbox: Encolado localmente para sincronización [${newTx.entity}]`, newTx);

  // 2. Registrar el Background Sync en el Service Worker si está soportado
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      // Registramos la etiqueta de sincronización
      await (reg as any).sync.register('sync-transactions');
      console.log('📡 Outbox: Background Sync registrado con éxito para "sync-transactions"');
    } catch (e) {
      console.warn('⚠️ Outbox: SyncManager falló al registrar. Se sincronizará en la próxima recarga del Service Worker.', e);
    }
  } else {
    console.log('⚠️ Outbox: Background Sync no está soportado en este navegador. Se usará sincronización por ciclo de vida alternativo.');
  }
}
