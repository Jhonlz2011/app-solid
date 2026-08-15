import { Elysia } from 'elysia';
import { Webhook } from 'svix';
import { env } from '../../config/env';
import { db } from '../../core/db';
import { emailLogs } from '@app/schema/tables';

// Singleton: instanciar una sola vez al cargar el módulo
const wh = env.RESEND_WEBHOOK_SECRET ? new Webhook(env.RESEND_WEBHOOK_SECRET) : null;

export const webhooksRoutes = new Elysia({ prefix: '/webhooks' })
  .post('/resend', async ({ request, set }) => {
    if (!wh) {
      console.error('❌ RESEND_WEBHOOK_SECRET no está configurado en .env');
      set.status = 500;
      return { error: 'Configuración del servidor incompleta' };
    }

    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      set.status = 400;
      return { error: 'Faltan cabeceras de firma Svix' };
    }

    let rawBody: string;
    try {
      rawBody = await request.clone().text();
    } catch {
      set.status = 400;
      return { error: 'No se pudo leer el cuerpo de la petición' };
    }

    let event: { type: string; data: Record<string, any> };
    try {
      event = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as typeof event;
    } catch (err) {
      console.error('❌ Firma de webhook inválida:', err);
      set.status = 400;
      return { error: 'Firma inválida' };
    }

    try {
      const { type, data } = event;
      const resendId = data.email_id as string | undefined;
      const toEmail = Array.isArray(data.to) ? data.to[0] : 'unknown';
      const status = type.split('.')[1] || 'unknown';

      await db
        .insert(emailLogs)
        .values({
          toEmail,
          subject: (data.subject as string) || 'unknown',
          status,
          eventType: type,
          resendId: resendId || null,
          metadata: data,
        })
        .onConflictDoUpdate({
          target: [emailLogs.resendId, emailLogs.eventType],
          set: {
            metadata: data,
            updatedAt: new Date(),
          },
        });

      if (env.NODE_ENV !== 'production') {
        console.log(`📩 Webhook procesado: ${type} → ${toEmail}`);
      }

      if (type === 'email.bounced' || type === 'email.complained') {
        console.warn(`⚠️ Alerta de entregabilidad: ${toEmail} (${type})`);
      }

      set.status = 200;
      return { success: true };
    } catch (dbError) {
      console.error('❌ Error procesando evento de webhook en BD:', dbError);
      set.status = 500;
      return { error: 'Error interno procesando webhook' };
    }
  });
