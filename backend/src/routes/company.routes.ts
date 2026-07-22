import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { companyService } from '../services/company.service';
import { publicStorageService } from '../services/public-storage.service';
import { CompanySettingsBodySchema } from '@app/schema/backend';
import { db } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';

/**
 * Helper to resolve company slug from ID.
 * Only used by upload routes that need the slug for R2 key paths.
 */
const resolveCompanySlug = async (companyId: number): Promise<string | null> => {
  const [company] = await db.select({ slug: companies.slug })
    .from(companies).where(eq(companies.id, companyId)).limit(1);
  return company?.slug ?? null;
};

export const companyRoutes = new Elysia({ prefix: '/settings/company' })
  .use(authGuard)
  // GET and PATCH don't need slug — removed derive() to save 1 SELECT per request
  .get('/', async ({ currentCompanyId }) => {
    return await companyService.getBranding(currentCompanyId);
  })
  .patch('/', async ({ currentCompanyId, body }) => {
    return await companyService.updateBranding(currentCompanyId, body);
  }, {
    body: CompanySettingsBodySchema,
  })
  // Upload routes resolve slug on-demand (only when needed for R2 key paths)
  .post('/upload-logo', async ({ currentCompanyId, body, set }) => {
    const companySlug = await resolveCompanySlug(currentCompanyId);
    if (!companySlug) { set.status = 404; return { message: 'Empresa no encontrada' }; }

    const arrayBuffer = await body.file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const logoUrl = await publicStorageService.optimizeAndUploadLogo({
      slug: companySlug,
      rawFileBuffer: buffer,
    });

    return { url: logoUrl };
  }, {
    body: t.Object({
      file: t.File({
        maxSize: '5m',
        type: ['image/jpeg', 'image/png', 'image/webp'],
      }),
    }),
  })
  .post('/upload-bg', async ({ currentCompanyId, body, set }) => {
    const companySlug = await resolveCompanySlug(currentCompanyId);
    if (!companySlug) { set.status = 404; return { message: 'Empresa no encontrada' }; }

    const arrayBuffer = await body.file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let crop: { left: number; top: number; width: number; height: number } | undefined;
    let transforms: { rotate?: number; flipX?: boolean; flipY?: boolean } | undefined;
    
    if (body.cropX != null && body.cropY != null && body.cropWidth != null && body.cropHeight != null) {
      crop = {
        left: Math.round(body.cropX),
        top: Math.round(body.cropY),
        width: Math.round(body.cropWidth),
        height: Math.round(body.cropHeight),
      };
    }

    if (body.cropRotate || body.cropFlipX || body.cropFlipY) {
      transforms = {
        rotate: body.cropRotate ? Math.round(body.cropRotate) : undefined,
        flipX: body.cropFlipX ?? undefined,
        flipY: body.cropFlipY ?? undefined,
      };
    }

    const bgUrl = await publicStorageService.optimizeAndUploadLoginBg({
      slug: companySlug,
      rawFileBuffer: buffer,
      crop,
      transforms,
    });

    return { url: bgUrl };
  }, {
    body: t.Object({
      file: t.File({
        maxSize: '10m',
        type: ['image/jpeg', 'image/png', 'image/webp'],
      }),
      cropX: t.Optional(t.Numeric()),
      cropY: t.Optional(t.Numeric()),
      cropWidth: t.Optional(t.Numeric()),
      cropHeight: t.Optional(t.Numeric()),
      cropRotate: t.Optional(t.Numeric()),
      cropFlipX: t.Optional(t.BooleanString()),
      cropFlipY: t.Optional(t.BooleanString()),
    }),
  });
