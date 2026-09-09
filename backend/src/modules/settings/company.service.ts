import { db } from '../../core/db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import { invalidateTenantCache } from '../../core/spa';
import { NotFoundError } from '../../core/errors';
import type { CompanySettingsBodyType } from '@app/schema/backend';
import { publicStorageService } from '../../core/storage';
import { broadcastToTenant } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';


/**
 * Standard projection for company branding & fiscal settings.
 * Shared between queries and mutations to ensure DRY and 100% type alignment.
 */
const companyProjection = {
  id: companies.id,
  slug: companies.slug,
  businessName: companies.business_name,
  tradeName: companies.trade_name,
  logoUrl: companies.logo_url,
  primaryColor: companies.primary_color,
  themeColor: companies.theme_color,
  loginBgUrl: companies.login_bg_url,
  ruc: companies.ruc,
  mainAddress: companies.main_address,
  businessType: companies.business_type,
  email: companies.email,
  phone: companies.phone,
  obligadoContabilidad: companies.obligado_contabilidad,
  contribuyenteEspecial: companies.contribuyente_especial,
  agenteRetencion: companies.agente_retencion,
  taxRegimeType: companies.rimpe_type,
  sriEnvironment: companies.sri_environment,
};

/**
 * Strictly-typed partial builder for Drizzle UPDATE.
 * Only writes fields explicitly passed in the request body (skipping undefined).
 * Completely eliminates manual runtime reflection and `any` casting.
 */
function toCompanyUpdateData(data: CompanySettingsBodyType): Partial<typeof companies.$inferInsert> {
  const update: Partial<typeof companies.$inferInsert> = {
    updated_at: new Date(),
  };

  if (data.logoUrl !== undefined) update.logo_url = data.logoUrl;
  if (data.loginBgUrl !== undefined) update.login_bg_url = data.loginBgUrl;
  if (data.primaryColor !== undefined) update.primary_color = data.primaryColor;
  if (data.themeColor !== undefined) update.theme_color = data.themeColor;
  if (data.businessName !== undefined) update.business_name = data.businessName;
  if (data.tradeName !== undefined) update.trade_name = data.tradeName;
  if (data.ruc !== undefined) update.ruc = data.ruc;
  if (data.mainAddress !== undefined) update.main_address = data.mainAddress;
  if (data.businessType !== undefined) update.business_type = data.businessType;
  if (data.email !== undefined) update.email = data.email;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.obligadoContabilidad !== undefined) update.obligado_contabilidad = data.obligadoContabilidad;
  if (data.contribuyenteEspecial !== undefined) update.contribuyente_especial = data.contribuyenteEspecial;
  if (data.agenteRetencion !== undefined) update.agente_retencion = data.agenteRetencion;
  if (data.taxRegimeType !== undefined) update.rimpe_type = data.taxRegimeType;
  if (data.sriEnvironment !== undefined) update.sri_environment = data.sriEnvironment;

  return update;
}

export const companyService = {
  getBranding: async (companyId: number) => {
    const [company] = await db
      .select(companyProjection)
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new NotFoundError('Empresa no encontrada');
    }

    return company;
  },

  updateBranding: async (companyId: number, data: CompanySettingsBodyType) => {
    // Fetch current image URLs for deferred delete comparison
    const [currentImages] = await db
      .select({
        logoUrl: companies.logo_url,
        loginBgUrl: companies.login_bg_url,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const [updated] = await db
      .update(companies)
      .set(toCompanyUpdateData(data))
      .where(eq(companies.id, companyId))
      .returning(companyProjection);

    if (!updated) {
      throw new NotFoundError('Empresa no encontrada para actualizar');
    }

    // Deferred delete: only cleanup R2 objects when explicitly removed (set to null).
    if (currentImages) {
      if (currentImages.logoUrl && data.logoUrl === null) {
        publicStorageService.deleteObject(currentImages.logoUrl).catch((err) =>
          console.warn('[R2] Deferred logo delete failed:', err)
        );
      }

      if (currentImages.loginBgUrl && data.loginBgUrl === null) {
        publicStorageService.deleteObject(currentImages.loginBgUrl).catch((err) =>
          console.warn('[R2] Deferred login-bg delete failed:', err)
        );
      }
    }

    // Invalidate backend SPA cache for this tenant
    if (updated.slug) {
      invalidateTenantCache(updated.slug);
    }

    broadcastToTenant(companyId, RealtimeEvents.COMPANY.BRANDING_UPDATED, updated);

    return updated;
  },
};
