import type {
  Product,
  ProductPayload,
  ProductsResponse,
  ProductFilters,
  Category,
  Brand,
  UOM,
  AttributeDefinition,
} from './models/products.type';
import { request } from '@shared/lib/http';

export const productsService = {
  // Products CRUD
  async list(filters?: ProductFilters): Promise<ProductsResponse> {
    return request<ProductsResponse>('/products', { params: filters });
  },

  async get(id: number): Promise<Product> {
    return request<Product>(`/products/${id}`);
  },

  async create(data: ProductPayload): Promise<Product> {
    return request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: number, data: Partial<ProductPayload>): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: number): Promise<void> {
    return request(`/products/${id}`, { method: 'DELETE' });
  },

  // Categories
  async listCategories(): Promise<Category[]> {
    return request<Category[]>('/categories');
  },

  async getCategoryWithAttributes(id: number): Promise<Category> {
    return request<Category>(`/categories/${id}`);
  },

  async createCategory(data: { name: string; parentId?: number; nameTemplate?: string }): Promise<Category> {
    return request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Brands
  async listBrands(): Promise<Brand[]> {
    return request<Brand[]>('/catalogs/brands');
  },

  async createBrand(data: { name: string; website?: string }): Promise<Brand> {
    return request<Brand>('/catalogs/brands', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // UOM
  async listUoms(): Promise<UOM[]> {
    return request<UOM[]>('/catalogs/uom');
  },

  // Attribute Definitions
  async listAttributes(): Promise<AttributeDefinition[]> {
    return request<AttributeDefinition[]>('/catalogs/attributes');
  },
};
