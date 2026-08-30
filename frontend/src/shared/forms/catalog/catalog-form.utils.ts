import type { Component } from 'solid-js';
import type { ProductType } from '@app/schema/enums';
import { BoxIcon } from '@icons/BoxIcon';
import { WrenchIcon } from '@icons/WrenchIcon';

// Mode configuration for product vs service catalog forms
export interface CatalogModeConfig {
    type: ProductType;
    label: string;               // 'Producto' | 'Servicio'
    labelPlural: string;         // 'Productos' | 'Servicios'
    icon: Component<any>;
    rbacModule: string;          // 'products' | 'services'
    routePrefix: string;         // '/products' | '/services'
    formId: string;              // 'product-form' | 'service-form' (for form submission)
    features: {
        subtype: boolean;        // SIMPLE/COMPUESTO/FABRICADO toggle
        salesTab: boolean;       // Tab 'Ventas' with pricing
        purchaseTab: boolean;    // Tab 'Compras' with costs
        inventoryTab: boolean;   // Tab 'Inventario' with stock/dimensional tracking
    };
}

export const CATALOG_MODES: Record<ProductType, CatalogModeConfig> = {
    PRODUCTO: {
        type: 'PRODUCTO',
        label: 'Producto',
        labelPlural: 'Productos',
        icon: BoxIcon,
        rbacModule: 'products',
        routePrefix: '/products',
        formId: 'product-form',
        features: {
            subtype: true,
            salesTab: true,
            purchaseTab: true,
            inventoryTab: true,
        },
    },
    SERVICIO: {
        type: 'SERVICIO',
        label: 'Servicio',
        labelPlural: 'Servicios',
        icon: WrenchIcon,
        rbacModule: 'services',
        routePrefix: '/services',
        formId: 'service-form',
        features: {
            subtype: false,
            salesTab: true,
            purchaseTab: false,
            inventoryTab: false,
        },
    },
};
