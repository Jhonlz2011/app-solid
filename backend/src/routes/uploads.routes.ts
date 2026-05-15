import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { mkdir, unlink } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = typeof import.meta.dir === 'string'
    ? import.meta.dir
    : fileURLToPath(new URL('.', import.meta.url));
const UPLOADS_DIR = resolve(__dirname, '../../public/uploads/products');
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Ensure directory exists on startup
await mkdir(UPLOADS_DIR, { recursive: true });

export const uploadsRoutes = new Elysia({ prefix: '/uploads' })
    .use(authGuard)

    // ─── UPLOAD PRODUCT IMAGES ─────────────────────────────────────
    .post('/products', async ({ body, set }) => {
        const files = Array.isArray(body.files) ? body.files : [body.files];
        const urls: string[] = [];

        for (const file of files) {
            if (!file || !(file instanceof File)) continue;

            // Validate type
            if (!ALLOWED_TYPES.has(file.type)) {
                set.status = 400;
                return { message: `Tipo de archivo no permitido: ${file.type}. Permitidos: JPG, PNG, WebP, AVIF` };
            }

            // Validate size
            if (file.size > MAX_FILE_SIZE) {
                set.status = 400;
                return { message: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 5MB` };
            }

            // Generate unique filename
            const ext = extname(file.name) || '.webp';
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const filename = `prod_${timestamp}_${random}${ext}`;

            // Write file using Bun APIs
            const filepath = join(UPLOADS_DIR, filename);
            const buffer = await file.arrayBuffer();
            await Bun.write(filepath, buffer);

            // Return relative URL for serving
            urls.push(`/uploads/products/${filename}`);
        }

        return { urls };
    }, {
        body: t.Object({
            files: t.Any(),
        }),
    })

    // ─── DELETE PRODUCT IMAGE ──────────────────────────────────────
    .delete('/products/:filename', async ({ params, set }) => {
        const filepath = join(UPLOADS_DIR, params.filename);
        try {
            await unlink(filepath);
            set.status = 204;
        } catch {
            set.status = 404;
            return { message: 'Archivo no encontrado' };
        }
    }, {
        params: t.Object({ filename: t.String() }),
    });
