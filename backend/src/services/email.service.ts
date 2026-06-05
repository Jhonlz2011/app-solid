import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { env } from '../config/env';

const sesClient = new SESClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const emailService = {
  /**
   * Envía un correo electrónico genérico a través de Amazon SES.
   */
  sendEmail: async (to: string, subject: string, htmlContent: string) => {
    const sender = 'Zelys ERP <no-reply@mail.zelys.app>'; 

    const command = new SendEmailCommand({
      Source: sender,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlContent,
            Charset: 'UTF-8',
          },
        },
      },
    });

    try {
      const response = await sesClient.send(command);
      if (env.NODE_ENV !== 'production') {
        console.log(`✉️ Correo enviado a ${to}. MessageId: ${response.MessageId}`);
      }
      return response;
    } catch (error) {
      console.error('❌ Error enviando correo vía AWS SES:', error);
      throw error;
    }
  },

  /**
   * Envía la plantilla de verificación de cuenta.
   */
  sendVerificationEmail: async (toEmail: string, verificationLink: string, userName: string) => {
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
          <p>Hola <strong>${userName}</strong>,</p>
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
    
    return emailService.sendEmail(
      toEmail,
      'Verificación de correo electrónico - Zelys ERP',
      htmlContent
    );
  }
};
