import { db } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import { invalidateTenantCache } from './spa-renderer.service';
import type { CompanySettingsBodyType } from '@app/schema/backend';

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
    const [updated] = await db
      .update(companies)
      .set({
        logo_url: data.logoUrl,
        login_bg_url: data.loginBgUrl,
        primary_color: data.primaryColor,
        theme_color: data.themeColor,
        business_name: data.businessName,
        trade_name: data.tradeName || null,
        ruc: data.ruc,
        main_address: data.mainAddress,
        business_type: data.businessType || null,
        email: data.email || null,
        phone: data.phone || null,
        obligado_contabilidad: data.obligadoContabilidad,
        contribuyente_especial: data.contribuyenteEspecial || null,
        agente_retencion: data.agenteRetencion || null,
        rimpe_type: data.rimpeType || null,
        sri_environment: data.sriEnvironment,
        updated_at: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning();

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
