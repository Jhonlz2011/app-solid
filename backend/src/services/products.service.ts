import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { products, bomHeaders, bomDetails, productDimensions } from '../schema';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';

// Product class enum matching schema
type ProductClass = 'MATERIAL' | 'TOOL' | 'EPP' | 'ASSET' | 'SERVICE' | 'MANUFACTURED';

export interface ProductPayload {
  sku: string;
  name: string;
  productClass: ProductClass;
  categoryId?: number;
  brandId?: number;
  description?: string;
  specs?: Record<string, any>;
  imageUrls?: string[];
  uomInventoryCode?: string;
  uomConsumptionCode?: string;
  secondaryUomCode?: string;
  conversionFactorSecondary?: number;
  trackDimensional?: boolean;
  isService?: boolean;
  minStockAlert?: number;
  lastCost?: number;
  basePrice?: number;
  ivaRateCode?: number;
  components?: { componentId: number; quantity: number; wastagePercent?: number }[];
  dimensions?: {
    width?: number;
    length?: number;
    thickness?: number;
  };
}

interface ProductFilters {
  search?: string;
  categoryId?: number;
  brandId?: number;
  productClass?: ProductClass;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export async function listProducts(filters: ProductFilters) {
  const cacheKey = `products:list:${JSON.stringify(filters)}`;

  return cacheService.getOrSet(cacheKey, async () => {
    const { search, categoryId, brandId, productClass, isActive, limit = 25, offset = 0 } = filters;
    const conditions = [];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern)
        )
      );
    }

    if (categoryId) conditions.push(eq(products.category_id, categoryId));
    if (brandId) conditions.push(eq(products.brand_id, brandId));
    if (productClass) conditions.push(eq(products.product_class, productClass));
    if (isActive !== undefined) conditions.push(eq(products.is_active, isActive));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const data = await db
      .select()
      .from(products)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(products.created_at));

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(whereClause);

    return {
      data,
      meta: { total: count, limit, offset },
    };
  }, 300);
}

export async function getProduct(id: number) {
  const cacheKey = `products:${id}`;

  return cacheService.getOrSet(cacheKey, async () => {
    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        dimensions: true,
      }
    });

    if (!product) throw new DomainError('Producto no encontrado', 404);

    // Get BOM if exists
    const [bom] = await db
      .select()
      .from(bomHeaders)
      .where(eq(bomHeaders.product_id, id))
      .orderBy(desc(bomHeaders.revision))
      .limit(1);

    let components: any[] = [];
    if (bom) {
      components = await db
        .select({
          id: bomDetails.id,
          componentProductId: bomDetails.component_product_id,
          quantityNeeded: bomDetails.quantity_factor, // Updated field name
          wastagePercent: bomDetails.wastage_percent,
        })
        .from(bomDetails)
        .where(eq(bomDetails.bom_id, bom.id));
    }

    return { ...product, bom: bom ? { ...bom, components } : null };
  }, 600);
}

export async function createProduct(payload: ProductPayload, userId: number) {
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, payload.sku));

  if (existing.length) {
    throw new DomainError('El SKU ya está registrado', 409);
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        sku: payload.sku,
        name: payload.name,
        product_class: payload.productClass,
        category_id: payload.categoryId,
        brand_id: payload.brandId,
        description: payload.description,
        specs: payload.specs ?? {},
        uom_inventory_code: payload.uomInventoryCode,
        uom_consumption_code: payload.uomConsumptionCode,
        secondary_uom_code: payload.secondaryUomCode,
        conversion_factor_secondary: payload.conversionFactorSecondary?.toString() ?? '1',
        track_dimensional: payload.trackDimensional ?? false,
        is_service: payload.isService ?? false,
        min_stock_alert: payload.minStockAlert?.toString() ?? '0',
        last_cost: payload.lastCost?.toString() ?? '0',
        base_price: payload.basePrice?.toString() ?? '0',
        iva_rate_code: payload.ivaRateCode ?? 4,
        updated_by: userId,
      })
      .returning();

    // Insert Dimensions if provided
    if (payload.dimensions) {
      await tx.insert(productDimensions).values({
        product_id: created.id,
        width: payload.dimensions.width?.toString() ?? '0',
        length: payload.dimensions.length?.toString() ?? '0',
        thickness: payload.dimensions.thickness?.toString() ?? '0',
        area: ((payload.dimensions.width || 0) * (payload.dimensions.length || 0)).toString(),
      });
    }

    if (payload.components?.length) {
      const [bom] = await tx
        .insert(bomHeaders)
        .values({
          product_id: created.id,
          name: `BOM - ${created.sku}`,
          revision: 1,
        })
        .returning();

      await tx.insert(bomDetails).values(
        payload.components.map((c) => ({
          bom_id: bom.id,
          component_product_id: c.componentId,
          quantity_factor: c.quantity.toString(),
          wastage_percent: (c.wastagePercent ?? 0).toString(),
        }))
      );
    }

    cacheService.invalidate('products:*');
    broadcast('product:created', created, 'products');

    return created;
  });
}

export async function updateProduct(productId: number, payload: Partial<ProductPayload>, userId: number) {
  return db.transaction(async (tx) => {
    const updateValues: any = {
      updated_at: new Date(),
      updated_by: userId,
    };

    if (payload.name !== undefined) updateValues.name = payload.name;
    if (payload.productClass !== undefined) updateValues.product_class = payload.productClass;
    if (payload.categoryId !== undefined) updateValues.category_id = payload.categoryId;
    if (payload.brandId !== undefined) updateValues.brand_id = payload.brandId;
    if (payload.description !== undefined) updateValues.description = payload.description;
    if (payload.specs !== undefined) updateValues.specs = payload.specs;
    if (payload.uomInventoryCode !== undefined) updateValues.uom_inventory_code = payload.uomInventoryCode;
    if (payload.uomConsumptionCode !== undefined) updateValues.uom_consumption_code = payload.uomConsumptionCode;
    if (payload.secondaryUomCode !== undefined) updateValues.secondary_uom_code = payload.secondaryUomCode;
    if (payload.conversionFactorSecondary !== undefined) updateValues.conversion_factor_secondary = payload.conversionFactorSecondary.toString();
    if (payload.trackDimensional !== undefined) updateValues.track_dimensional = payload.trackDimensional;
    if (payload.isService !== undefined) updateValues.is_service = payload.isService;
    if (payload.minStockAlert !== undefined) updateValues.min_stock_alert = payload.minStockAlert.toString();
    if (payload.lastCost !== undefined) updateValues.last_cost = payload.lastCost.toString();
    if (payload.basePrice !== undefined) updateValues.base_price = payload.basePrice.toString();
    if (payload.ivaRateCode !== undefined) updateValues.iva_rate_code = payload.ivaRateCode;

    const [updated] = await tx
      .update(products)
      .set(updateValues)
      .where(eq(products.id, productId))
      .returning();

    if (!updated) {
      throw new DomainError('Producto no encontrado', 404);
    }

    // Update Dimensions if provided
    if (payload.dimensions) {
      const dimValues = {
        width: payload.dimensions.width?.toString() ?? '0',
        length: payload.dimensions.length?.toString() ?? '0',
        thickness: payload.dimensions.thickness?.toString() ?? '0',
        area: ((payload.dimensions.width || 0) * (payload.dimensions.length || 0)).toString(),
      };

      await tx
        .insert(productDimensions)
        .values({ product_id: productId, ...dimValues })
        .onConflictDoUpdate({
          target: productDimensions.product_id,
          set: dimValues,
        });
    }

    cacheService.invalidate(`products:${productId}`);
    cacheService.invalidate('products:list:*');
    broadcast('product:updated', updated, 'products');

    return updated;
  });
}

export async function deactivateProduct(productId: number, userId: number) {
  const [updated] = await db
    .update(products)
    .set({ is_active: false, updated_at: new Date(), updated_by: userId })
    .where(eq(products.id, productId))
    .returning();

  if (!updated) throw new DomainError('Producto no encontrado', 404);

  cacheService.invalidate(`products:${productId}`);
  cacheService.invalidate('products:list:*');
  broadcast('product:deleted', { id: productId }, 'products');

  return { success: true };
}

export async function deleteProduct(productId: number, userId: number) {
  // Soft delete by deactivating
  return deactivateProduct(productId, userId);
}
