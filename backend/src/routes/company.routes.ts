import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { companyService } from '../services/company.service';
import { publicStorageService } from '../services/public-storage.service';
import { CompanySettingsBodySchema } from '@app/schema/backend';
import { db } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';

export const companyRoutes = new Elysia({ prefix: '/settings/company' })
  .use(authGuard)
  // Derive companySlug once — available to all routes below
  .derive(async ({ currentCompanyId }) => {
    const [company] = await db.select({ slug: companies.slug })
      .from(companies).where(eq(companies.id, currentCompanyId)).limit(1);
    return { companySlug: company?.slug ?? null };
  })
  .get('/', async ({ currentCompanyId }) => {
    return await companyService.getBranding(currentCompanyId);
  })
  .patch('/', async ({ currentCompanyId, body }) => {
    return await companyService.updateBranding(currentCompanyId, body);
  }, {
    body: CompanySettingsBodySchema,
  })
  .post('/upload-logo', async ({ companySlug, body, set }) => {
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
  .post('/upload-bg', async ({ companySlug, body, set }) => {
    if (!companySlug) { set.status = 404; return { message: 'Empresa no encontrada' }; }

    const arrayBuffer = await body.file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bgUrl = await publicStorageService.optimizeAndUploadLoginBg({
      slug: companySlug,
      rawFileBuffer: buffer,
    });

    return { url: bgUrl };
  }, {
    body: t.Object({
      file: t.File({
        maxSize: '10m',
        type: ['image/jpeg', 'image/png', 'image/webp'],
      }),
    }),
  });

