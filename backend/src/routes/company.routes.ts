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
  .get('/', async ({ currentCompanyId }) => {
    return await companyService.getBranding(currentCompanyId);
  })
  .patch('/', async ({ currentCompanyId, body }) => {
    return await companyService.updateBranding(currentCompanyId, body);
  }, {
    body: CompanySettingsBodySchema,
  })
  .post('/upload-logo', async ({ currentCompanyId, body, set }) => {
    const file = body.file;
    if (!file || !(file instanceof File)) {
      set.status = 400;
      return { message: 'El archivo es requerido' };
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      set.status = 400;
      return { message: 'Tipo de archivo no permitido. Solo se permiten JPG, PNG y WebP' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Fetch stable slug for R2 key
    const [company] = await db.select({ slug: companies.slug })
      .from(companies).where(eq(companies.id, currentCompanyId)).limit(1);
    if (!company) { set.status = 404; return { message: 'Empresa no encontrada' }; }

    const logoUrl = await publicStorageService.optimizeAndUploadLogo({
      slug: company.slug,
      rawFileBuffer: buffer,
    });

    return { url: logoUrl };
  }, {
    body: t.Object({
      file: t.Any(),
    }),
  })
  .post('/upload-bg', async ({ currentCompanyId, body, set }) => {
    const file = body.file;
    if (!file || !(file instanceof File)) {
      set.status = 400;
      return { message: 'El archivo es requerido' };
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      set.status = 400;
      return { message: 'Tipo de archivo no permitido. Solo se permiten JPG, PNG y WebP' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Fetch stable slug for R2 key
    const [company] = await db.select({ slug: companies.slug })
      .from(companies).where(eq(companies.id, currentCompanyId)).limit(1);
    if (!company) { set.status = 404; return { message: 'Empresa no encontrada' }; }

    const bgUrl = await publicStorageService.optimizeAndUploadLoginBg({
      slug: company.slug,
      rawFileBuffer: buffer,
    });

    return { url: bgUrl };
  }, {
    body: t.Object({
      file: t.Any(),
    }),
  });
