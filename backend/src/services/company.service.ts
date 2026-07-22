import { db } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import { invalidateTenantCache } from './spa-renderer.service';
import type { CompanySettingsBodyType } from '@app/schema/backend';
import { publicStorageService } from './public-storage.service';

/**
 * Maps camelCase form field names → snake_case DB column setters.
 * Only fields present in the input are included in the UPDATE SET clause,
 * avoiding unnecessary writes and reducing last-write-wins conflicts.
 */
const FIELD_MAP: Record<keyof CompanySettingsBodyType, (data: CompanySettingsBodyType) => any> = {
  logoUrl: (d) => d.logoUrl,
  loginBgUrl: (d) => d.loginBgUrl,
  primaryColor: (d) => d.primaryColor,
  themeColor: (d) => d.themeColor,
  businessName: (d) => d.businessName,
  tradeName: (d) => d.tradeName || null,
  ruc: (d) => d.ruc,
  mainAddress: (d) => d.mainAddress,
  businessType: (d) => d.businessType || null,
  email: (d) => d.email || null,
  phone: (d) => d.phone || null,
  obligadoContabilidad: (d) => d.obligadoContabilidad,
  contribuyenteEspecial: (d) => d.contribuyenteEspecial || null,
  agenteRetencion: (d) => d.agenteRetencion || null,
  rimpeType: (d) => d.rimpeType || null,
  sriEnvironment: (d) => d.sriEnvironment,
};

const CAMEL_TO_COLUMN: Record<string, keyof typeof companies> = {
  logoUrl: 'logo_url',
  loginBgUrl: 'login_bg_url',
  primaryColor: 'primary_color',
  themeColor: 'theme_color',
  businessName: 'business_name',
  tradeName: 'trade_name',
  ruc: 'ruc',
  mainAddress: 'main_address',
  businessType: 'business_type',
  email: 'email',
  phone: 'phone',
  obligadoContabilidad: 'obligado_contabilidad',
  contribuyenteEspecial: 'contribuyente_especial',
  agenteRetencion: 'agente_retencion',
  rimpeType: 'rimpe_type',
  sriEnvironment: 'sri_environment',
};

/**
 * Builds a partial Drizzle `.set()` object from only the fields present in the input.
 * Fields with `undefined` value are skipped — only explicit values are written.
 */
function buildPartialSet(data: CompanySettingsBodyType): Record<string, any> {
  const set: Record<string, any> = {};
  for (const [camelKey, resolver] of Object.entries(FIELD_MAP)) {
    const value = (data as any)[camelKey];
    if (value !== undefined) {
      const columnKey = CAMEL_TO_COLUMN[camelKey];
      if (columnKey) {
        set[columnKey as string] = resolver(data);
      }
    }
  }
  set.updated_at = new Date();
  return set;
}

export const companyService = {
  getBranding: async (companyId: number) => {
    const [company] = await db
      .select({
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
        rimpeType: companies.rimpe_type,
        sriEnvironment: companies.sri_environment,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new Error('Empresa no encontrada');
    }

    return company;
  },

  updateBranding: async (companyId: number, data: CompanySettingsBodyType) => {
    // Fetch current image URLs for deferred delete comparison
    const [currentImages] = await db.select({
        logoUrl: companies.logo_url,
        loginBgUrl: companies.login_bg_url,
    }).from(companies).where(eq(companies.id, companyId)).limit(1);

    // Build partial SET — only changed fields are written to the DB
    const partialSet = buildPartialSet(data);

    const [updated] = await db
      .update(companies)
      .set(partialSet as any)
      .where(eq(companies.id, companyId))
      .returning();

    // Deferred delete: cleanup orphaned R2 objects after successful DB update
    if (currentImages) {
        const oldLogo = currentImages.logoUrl;
        const newLogo = data.logoUrl;
        if (oldLogo && oldLogo !== newLogo) {
            publicStorageService.deleteObject(oldLogo).catch((err) =>
                console.warn('[R2] Deferred logo delete failed:', err)
            );
        }

        const oldBg = currentImages.loginBgUrl;
        const newBg = data.loginBgUrl;
        if (oldBg && oldBg !== newBg) {
            publicStorageService.deleteObject(oldBg).catch((err) =>
                console.warn('[R2] Deferred login-bg delete failed:', err)
            );
        }
    }

    // Invalidate backend SPA cache for this tenant
    if (updated.slug) {
      invalidateTenantCache(updated.slug);
    }

    return {
      id: updated.id,
      slug: updated.slug,
      logoUrl: updated.logo_url,
      loginBgUrl: updated.login_bg_url,
      primaryColor: updated.primary_color,
      themeColor: updated.theme_color,
      businessName: updated.business_name,
      tradeName: updated.trade_name,
      ruc: updated.ruc,
      mainAddress: updated.main_address,
      businessType: updated.business_type,
      email: updated.email,
      phone: updated.phone,
      obligadoContabilidad: updated.obligado_contabilidad,
      contribuyenteEspecial: updated.contribuyente_especial,
      agenteRetencion: updated.agente_retencion,
      rimpeType: updated.rimpe_type,
      sriEnvironment: updated.sri_environment,
    };
  },
};
