import { and, desc, eq, ilike, or, sql } from '@app/schema';
import { db, type Tx } from '../db';
import { products, bomHeaders, bomDetails, productDimensions } from '@app/schema/tables';
import { type ProductInsertType } from '@app/schema/typebox';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';

// Use inferred type from schema for the base payload
// type ProductInsert = InferInsertModel<typeof products>;



export type ProductPayload = ProductInsertType & {
  // Campos extra que no están en la tabla 'products' pero sí en el formulario
  components?: {
    componentId: number;
    quantity: number;
    wastagePercent?: number
  }[];
  dimensions?: {
    width?: number;
    length?: number;
    thickness?: number;
  };
};

// export interface ProductPayload extends ProductInsert {
//   // Extra fields not in products table
//   components?: { componentId: number; quantity: number; wastagePercent?: number }[];
//   dimensions?: {
//     width?: number;
//     length?: number;
//     thickness?: number;
//   };
// }

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  brandId?: number;
  productType?: string;
  productSubtype?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export async function listProducts(filters: ProductFilters) {
  const cacheKey = `products:list:${JSON.stringify(filters)}`;

  return cacheService.getOrSet(cacheKey, async () => {
    const { search, categoryId, brandId, productType, productSubtype, isActive, limit = 25, offset = 0 } = filters;
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
    if (productType) conditions.push(eq(products.product_type, productType as any));
    if (productSubtype) conditions.push(eq(products.product_subtype, productSubtype as any));
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
        category: true,
        brand: true,
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
          quantityFactor: bomDetails.quantity_factor,
          wastagePercent: bomDetails.wastage_percent,
          calculationType: bomDetails.calculation_type,
          formulaExpression: bomDetails.formula_expression,
          sortOrder: bomDetails.sort_order,
          isOptional: bomDetails.is_optional,
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

  return db.transaction(async (tx: Tx) => {
    // Extract extra fields
    const { components, dimensions, ...productData } = payload;

    const [created] = await tx
      .insert(products)
      .values({
        ...productData,
        updated_by: userId,
      })
      .returning();

    // Insert Dimensions if provided
    if (dimensions) {
      await tx.insert(productDimensions).values({
        product_id: created.id,
        width: dimensions.width?.toString() ?? '0',
        length: dimensions.length?.toString() ?? '0',
        thickness: dimensions.thickness?.toString() ?? '0',
        area: ((dimensions.width || 0) * (dimensions.length || 0)).toString(),
      });
    }

    // Create BOM if components provided
    if (components?.length) {
      const [bom] = await tx
        .insert(bomHeaders)
        .values({
          product_id: created.id,
          name: `BOM - ${created.sku}`,
          revision: 1,
        })
        .returning();

      await tx.insert(bomDetails).values(
        components.map((c) => ({
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
  return db.transaction(async (tx: Tx) => {
    const { components, dimensions, ...productData } = payload;

    const updateValues: any = {
      ...productData,
      updated_at: new Date(),
      updated_by: userId,
    };

    const [updated] = await tx
      .update(products)
      .set(updateValues)
      .where(eq(products.id, productId))
      .returning();

    if (!updated) {
      throw new DomainError('Producto no encontrado', 404);
    }

    // Update Dimensions if provided
    if (dimensions) {
      const dimValues = {
        width: dimensions.width?.toString() ?? '0',
        length: dimensions.length?.toString() ?? '0',
        thickness: dimensions.thickness?.toString() ?? '0',
        area: ((dimensions.width || 0) * (dimensions.length || 0)).toString(),
      };

      await tx
        .insert(productDimensions)
        .values({ product_id: productId, ...dimValues })
        .onConflictDoUpdate({
          target: productDimensions.product_id,
          set: dimValues,
        });
    }

    // Note: Updating BOM components is complex and usually requires a new revision or full replace.
    // For now, we'll skip updating BOMs in this simple update function unless explicitly requested.
    // A dedicated endpoint for BOM management is usually better.

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
