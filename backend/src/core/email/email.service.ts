import { Resend } from 'resend';
import { env } from '../../config/env';
import { adminDb } from '../db';
import { emailLogs } from '@app/schema/tables';

// Solo instanciamos si tenemos la API key, en desarrollo podríamos no tenerla configurada
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const SENDER_EMAIL = 'Zelys <no-reply@zelys.app>';

export const emailService = {
  /**
   * Envía un correo electrónico genérico a través de Resend y registra en email_logs.
   */
  sendEmail: async (to: string, subject: string, htmlContent: string) => {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY no configurada. Saltando envío de correo a:', to);
      return { id: 'mock-id' };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: SENDER_EMAIL,
        to: [to],
        subject: subject,
        html: htmlContent,
      });

      if (error) {
        console.error('❌ Error desde la API de Resend:', error);
        throw error;
      }

      if (data?.id) {
        await adminDb.insert(emailLogs).values({
          toEmail: to,
          subject: subject,
          status: 'sent',
          eventType: 'email.sent',
          resendId: data.id,
        }).catch((err) => console.warn('[EmailService] Failed to insert initial email log:', err));
      }

      if (env.NODE_ENV !== 'production') {
        console.log(`✉️ Correo enviado a ${to}. ID Resend: ${data?.id}`);
      }
      return data;
    } catch (error) {
      console.error('❌ Excepción enviando correo vía Resend:', error);
      throw error;
    }
  },

  /**
   * Envía la plantilla de verificación de cuenta.
   */
  sendVerificationEmail: async (toEmail: string, verificationLink: string, userName?: string) => {
    const displayName = (userName && userName !== 'undefined') ? userName : toEmail.split('@')[0];
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu cuenta en Zelys ERP</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f7fb;
            color: #1e293b;
            margin: 0;
            padding: 40px 10px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            padding: 40px 30px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
          }
          .logo-wrapper {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 26px;
            font-weight: 800;
            color: #2563eb;
            letter-spacing: -0.025em;
          }
          h1 {
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 16px;
            text-align: center;
          }
          p {
            font-size: 15px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 24px;
          }
          .btn-container {
            text-align: center;
            margin: 30px 0;
          }
          .btn {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 36px;
            font-weight: 600;
            font-size: 15px;
            border-radius: 10px;
            transition: background-color 0.15s ease;
          }
          .btn:hover {
            background-color: #1d4ed8;
          }
          .link-fallback {
            background-color: #f8fafc;
            border-radius: 8px;
            padding: 12px;
            font-size: 13px;
            word-break: break-all;
            color: #64748b;
            border: 1px solid #e2e8f0;
            margin-top: 24px;
          }
          .link-fallback a {
            color: #2563eb;
            text-decoration: none;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-wrapper">
            <span class="logo">Zelys<span style="color: #64748b;">ERP</span></span>
          </div>
          <h1>Verifica tu dirección de correo</h1>
          <p>Hola <strong>${displayName}</strong>,</p>
          <p>Gracias por registrar tu empresa en Zelys ERP. Para completar el registro y poder acceder a los módulos de gestión (inventario, facturación electrónica, proveedores), debes verificar tu dirección de correo electrónico haciendo clic en el siguiente botón:</p>
          
          <div class="btn-container">
            <a href="${verificationLink}" class="btn">Confirmar Correo Electrónico</a>
          </div>

          <p>Este enlace es de un solo uso y expirará en 24 horas por motivos de seguridad.</p>
          
          <p style="margin-bottom: 4px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
          <div class="link-fallback">
            <a href="${verificationLink}">${verificationLink}</a>
          </div>
          
          <div class="footer">
            Este es un correo automático, por favor no respondas a este mensaje.<br>
            © 2026 Zelys. Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    return await emailService.sendEmail(toEmail, 'Verifica tu cuenta en Zelys ERP', htmlContent);
  },

  /**
   * Envía la plantilla de restablecimiento de contraseña.
   */
  sendPasswordResetEmail: async (toEmail: string, resetLink: string, userName?: string) => {
    const displayName = (userName && userName !== 'undefined') ? userName : toEmail.split('@')[0];
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer contraseña - Zelys ERP</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f7fb;
            color: #1e293b;
            margin: 0;
            padding: 40px 10px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            padding: 40px 30px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
          }
          .logo-wrapper {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 26px;
            font-weight: 800;
            color: #2563eb;
            letter-spacing: -0.025em;
          }
          h1 {
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 16px;
            text-align: center;
          }
          p {
            font-size: 15px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 24px;
          }
          .btn-container {
            text-align: center;
            margin: 30px 0;
          }
          .btn {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 36px;
            font-weight: 600;
            font-size: 15px;
            border-radius: 10px;
            transition: background-color 0.15s ease;
          }
          .btn:hover {
            background-color: #1d4ed8;
          }
          .link-fallback {
            background-color: #f8fafc;
            border-radius: 8px;
            padding: 12px;
            font-size: 13px;
            word-break: break-all;
            color: #64748b;
            border: 1px solid #e2e8f0;
            margin-top: 24px;
          }
          .link-fallback a {
            color: #2563eb;
            text-decoration: none;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-wrapper">
            <span class="logo">Zelys<span style="color: #64748b;">ERP</span></span>
          </div>
          <h1>Restablece tu contraseña</h1>
          <p>Hola <strong>${displayName}</strong>,</p>
          <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Zelys ERP. Para crear una nueva contraseña, haz clic en el siguiente botón:</p>
          
          <div class="btn-container">
            <a href="${resetLink}" class="btn">Restablecer Contraseña</a>
          </div>

          <p>Este enlace expirará en 1 hora por seguridad. Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
          
          <p style="margin-bottom: 4px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
          <div class="link-fallback">
            <a href="${resetLink}">${resetLink}</a>
          </div>
          
          <div class="footer">
            Este es un correo automático, por favor no respondas a este mensaje.<br>
            © 2026 Zelys. Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    return await emailService.sendEmail(toEmail, 'Restablecer contraseña - Zelys ERP', htmlContent);
  },

  /**
   * Envía la plantilla de invitación corporativa a un tenant / espacio de trabajo con soporte 1-Click OAuth.
   */
  sendOrganizationInvitationEmail: async (
    toEmail: string,
    payload: {
      companyName: string;
      loginUrl: string;
      roleNames: string[];
      userName?: string;
      inviterName?: string;
      isNewUser?: boolean;
    }
  ) => {
    const displayName = (payload.userName && payload.userName !== 'undefined') ? payload.userName : toEmail.split('@')[0];
    const rolesList = payload.roleNames.length > 0
      ? payload.roleNames.map(r => `<span style="display:inline-block; background-color:#eff6ff; color:#1d4ed8; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; margin:2px 4px 2px 0; border:1px solid #dbeafe;">${r}</span>`).join('')
      : '<span style="display:inline-block; background-color:#eff6ff; color:#1d4ed8; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; border:1px solid #dbeafe;">Colaborador</span>';

    const inviterText = payload.inviterName
      ? `<strong>${payload.inviterName}</strong> te ha invitado a formar parte del equipo de <strong>${payload.companyName}</strong> en Zelys ERP.`
      : `Has sido invitado a formar parte del equipo de <strong>${payload.companyName}</strong> en Zelys ERP.`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitación a ${payload.companyName} - Zelys ERP</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f7fb;
            color: #1e293b;
            margin: 0;
            padding: 40px 10px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            padding: 40px 30px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
          }
          .logo-wrapper {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 26px;
            font-weight: 800;
            color: #2563eb;
            letter-spacing: -0.025em;
          }
          h1 {
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 16px;
            text-align: center;
          }
          p {
            font-size: 15px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 20px;
          }
          .card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 24px 0;
          }
          .card-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-bottom: 8px;
          }
          .card-company {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 12px;
          }
          .oauth-box {
            background-color: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            padding: 14px 16px;
            margin: 24px 0;
            font-size: 14px;
            color: #166534;
            line-height: 1.5;
          }
          .btn-container {
            text-align: center;
            margin: 30px 0;
          }
          .btn {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 38px;
            font-weight: 600;
            font-size: 15px;
            border-radius: 10px;
            transition: background-color 0.15s ease;
          }
          .btn:hover {
            background-color: #1d4ed8;
          }
          .link-fallback {
            background-color: #f8fafc;
            border-radius: 8px;
            padding: 12px;
            font-size: 13px;
            word-break: break-all;
            color: #64748b;
            border: 1px solid #e2e8f0;
            margin-top: 24px;
          }
          .link-fallback a {
            color: #2563eb;
            text-decoration: none;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-wrapper">
            <span class="logo">Zelys<span style="color: #64748b;">ERP</span></span>
          </div>
          <h1>¡Te damos la bienvenida al equipo!</h1>
          <p>Hola <strong>${displayName}</strong>,</p>
          <p>${inviterText}</p>
          
          <div class="card">
            <div class="card-title">Espacio de Trabajo</div>
            <div class="card-company">${payload.companyName}</div>
            <div class="card-title" style="margin-top: 12px;">Roles Asignados</div>
            <div>${rolesList}</div>
          </div>

          <div class="oauth-box">
            ⚡ <strong>Acceso rápido con un clic:</strong><br>
            Si tu correo utiliza <strong>Google Workspace</strong> o <strong>Microsoft 365</strong>, puedes presionar directamente <em>"Continuar con Google / Microsoft"</em> en la pantalla de inicio de sesión para acceder al instante sin configurar contraseñas.
          </div>

          <div class="btn-container">
            <a href="${payload.loginUrl}" class="btn">Ingresar a ${payload.companyName}</a>
          </div>

          <p style="margin-bottom: 4px;">Si el botón no abre directamente, copia este enlace en tu navegador:</p>
          <div class="link-fallback">
            <a href="${payload.loginUrl}">${payload.loginUrl}</a>
          </div>
          
          <div class="footer">
            Este es un correo automático de Zelys ERP para ${toEmail}.<br>
            © 2026 Zelys. Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    return await emailService.sendEmail(toEmail, `Invitación para unirte a ${payload.companyName} - Zelys ERP`, htmlContent);
  }
};
