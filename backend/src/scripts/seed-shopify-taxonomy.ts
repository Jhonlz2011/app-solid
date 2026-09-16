// backend/src/scripts/seed-shopify-taxonomy.ts
import { referenceDb } from '../core/db';
import {
    taxonomyCategories,
    taxonomyAttributes,
    taxonomyAttributeValues,
    taxonomyCategoryAttributes,
} from '@app/schema/tables';

async function main() {
    console.log('🌱 Starting Shopify Standard Taxonomy Seed in referenceDb...');

    // 1. Seed Core Attributes (Color, Talla, Material, Acabado, Voltaje, Rosca)
    const attributesData = [
        { id: 1, name: 'Color', handle: 'color', data_type: 'COLOR' },
        { id: 2, name: 'Talla', handle: 'talla', data_type: 'SELECT' },
        { id: 3, name: 'Material', handle: 'material', data_type: 'SELECT' },
        { id: 4, name: 'Acabado', handle: 'acabado', data_type: 'SELECT' },
        { id: 5, name: 'Voltaje', handle: 'voltaje', data_type: 'SELECT' },
        { id: 6, name: 'Rosca / Paso', handle: 'rosca', data_type: 'TEXT' },
    ];

    console.log('Inserting taxonomy attributes...');
    for (const attr of attributesData) {
        await referenceDb.insert(taxonomyAttributes).values(attr).onConflictDoNothing();
    }

    // 2. Seed Canonical Attribute Values (e.g. Colors with Hex, Sizes, Materials)
    const colorValues = [
        { id: 101, attribute_id: 1, name: 'Negro', handle: 'negro', metadata: { hex: '#000000' } },
        { id: 102, attribute_id: 1, name: 'Blanco', handle: 'blanco', metadata: { hex: '#FFFFFF' } },
        { id: 103, attribute_id: 1, name: 'Rojo', handle: 'rojo', metadata: { hex: '#EF4444' } },
        { id: 104, attribute_id: 1, name: 'Azul', handle: 'azul', metadata: { hex: '#3B82F6' } },
        { id: 105, attribute_id: 1, name: 'Amarillo', handle: 'amarillo', metadata: { hex: '#EAB308' } },
        { id: 106, attribute_id: 1, name: 'Verde', handle: 'verde', metadata: { hex: '#22C55E' } },
        { id: 107, attribute_id: 1, name: 'Gris', handle: 'gris', metadata: { hex: '#6B7280' } },
    ];

    const sizeValues = [
        { id: 201, attribute_id: 2, name: 'XS', handle: 'xs', metadata: null },
        { id: 202, attribute_id: 2, name: 'S', handle: 's', metadata: null },
        { id: 203, attribute_id: 2, name: 'M', handle: 'm', metadata: null },
        { id: 204, attribute_id: 2, name: 'L', handle: 'l', metadata: null },
        { id: 205, attribute_id: 2, name: 'XL', handle: 'xl', metadata: null },
        { id: 206, attribute_id: 2, name: 'XXL', handle: 'xxl', metadata: null },
    ];

    const materialValues = [
        { id: 301, attribute_id: 3, name: 'Acero Inoxidable', handle: 'acero_inoxidable', metadata: null },
        { id: 302, attribute_id: 3, name: 'Acero al Carbono', handle: 'acero_carbono', metadata: null },
        { id: 303, attribute_id: 3, name: 'Aluminio', handle: 'aluminio', metadata: null },
        { id: 304, attribute_id: 3, name: 'Cobre', handle: 'cobre', metadata: null },
        { id: 305, attribute_id: 3, name: 'Bronce', handle: 'bronce', metadata: null },
        { id: 306, attribute_id: 3, name: 'PVC', handle: 'pvc', metadata: null },
        { id: 307, attribute_id: 3, name: 'Algodón', handle: 'algodon', metadata: null },
        { id: 308, attribute_id: 3, name: 'Poliéster', handle: 'poliester', metadata: null },
    ];

    const finishValues = [
        { id: 401, attribute_id: 4, name: 'Galvanizado', handle: 'galvanizado', metadata: null },
        { id: 402, attribute_id: 4, name: 'Zincado', handle: 'zincado', metadata: null },
        { id: 403, attribute_id: 4, name: 'Pavonado', handle: 'pavonado', metadata: null },
        { id: 404, attribute_id: 4, name: 'Anodizado', handle: 'anodizado', metadata: null },
        { id: 405, attribute_id: 4, name: 'Mate', handle: 'mate', metadata: null },
        { id: 406, attribute_id: 4, name: 'Brillante', handle: 'brillante', metadata: null },
    ];

    console.log('Inserting taxonomy attribute values...');
    for (const val of [...colorValues, ...sizeValues, ...materialValues, ...finishValues]) {
        await referenceDb.insert(taxonomyAttributeValues).values(val).onConflictDoNothing();
    }

    // 3. Seed Hierarchy Categories (Industrial, Ferretería, Ropa, Electrónica)
    const categoriesData = [
        // Ropa y Accesorios
        { id: 1, code: 'aa', name: 'Ropa y Accesorios', full_path: 'Ropa y Accesorios', parent_id: null, depth: 0, path_ltree: '1' },
        { id: 2, code: 'aa-1', name: 'Camisas y Camisetas', full_path: 'Ropa y Accesorios > Camisas y Camisetas', parent_id: 1, depth: 1, path_ltree: '1.2' },
        { id: 3, code: 'aa-1-1', name: 'Polos Industriales', full_path: 'Ropa y Accesorios > Camisas y Camisetas > Polos Industriales', parent_id: 2, depth: 2, path_ltree: '1.2.3' },
        { id: 4, code: 'aa-2', name: 'Ropa de Seguridad y EPP', full_path: 'Ropa y Accesorios > Ropa de Seguridad y EPP', parent_id: 1, depth: 1, path_ltree: '1.4' },
        { id: 5, code: 'aa-2-1', name: 'Chalecos Reflectivos', full_path: 'Ropa y Accesorios > Ropa de Seguridad y EPP > Chalecos Reflectivos', parent_id: 4, depth: 2, path_ltree: '1.4.5' },

        // Ferretería y Materiales
        { id: 10, code: 'hw', name: 'Ferretería y Sujeción', full_path: 'Ferretería y Sujeción', parent_id: null, depth: 0, path_ltree: '10' },
        { id: 11, code: 'hw-1', name: 'Tornillería y Pernos', full_path: 'Ferretería y Sujeción > Tornillería y Pernos', parent_id: 10, depth: 1, path_ltree: '10.11' },
        { id: 12, code: 'hw-1-1', name: 'Tornillos Autorroscantes', full_path: 'Ferretería y Sujeción > Tornillería y Pernos > Tornillos Autorroscantes', parent_id: 11, depth: 2, path_ltree: '10.11.12' },
        { id: 13, code: 'hw-1-2', name: 'Pernos Hexagonales', full_path: 'Ferretería y Sujeción > Tornillería y Pernos > Pernos Hexagonales', parent_id: 11, depth: 2, path_ltree: '10.11.13' },

        // Herramientas
        { id: 20, code: 'tl', name: 'Herramientas', full_path: 'Herramientas', parent_id: null, depth: 0, path_ltree: '20' },
        { id: 21, code: 'tl-1', name: 'Herramientas Eléctricas', full_path: 'Herramientas > Herramientas Eléctricas', parent_id: 20, depth: 1, path_ltree: '20.21' },
        { id: 22, code: 'tl-1-1', name: 'Taladros y Rotomartillos', full_path: 'Herramientas > Herramientas Eléctricas > Taladros y Rotomartillos', parent_id: 21, depth: 2, path_ltree: '20.21.22' },
        { id: 23, code: 'tl-2', name: 'Herramientas Manuales', full_path: 'Herramientas > Herramientas Manuales', parent_id: 20, depth: 1, path_ltree: '20.23' },

        // Electrónica y Computación
        { id: 30, code: 'el', name: 'Electrónica', full_path: 'Electrónica', parent_id: null, depth: 0, path_ltree: '30' },
        { id: 31, code: 'el-1', name: 'Computadoras', full_path: 'Electrónica > Computadoras', parent_id: 30, depth: 1, path_ltree: '30.31' },
        { id: 32, code: 'el-1-1', name: 'Computadoras de sobremesa', full_path: 'Electrónica > Computadoras > Computadoras de sobremesa', parent_id: 31, depth: 2, path_ltree: '30.31.32' },
        { id: 33, code: 'el-1-2', name: 'Laptops y Portátiles', full_path: 'Electrónica > Computadoras > Laptops y Portátiles', parent_id: 31, depth: 2, path_ltree: '30.31.33' },
    ];

    console.log('Inserting taxonomy categories...');
    for (const cat of categoriesData) {
        await referenceDb.insert(taxonomyCategories).values(cat).onConflictDoNothing();
    }

    // 4. Bridge Category ↔ Recommended Attributes
    const bridges = [
        // Polos: Color, Talla, Material
        { category_id: 3, attribute_id: 1, is_recommended: true },
        { category_id: 3, attribute_id: 2, is_recommended: true },
        { category_id: 3, attribute_id: 3, is_recommended: true },

        // Chalecos: Color, Talla
        { category_id: 5, attribute_id: 1, is_recommended: true },
        { category_id: 5, attribute_id: 2, is_recommended: true },

        // Tornillos y Pernos: Material, Acabado, Rosca
        { category_id: 12, attribute_id: 3, is_recommended: true },
        { category_id: 12, attribute_id: 4, is_recommended: true },
        { category_id: 12, attribute_id: 6, is_recommended: true },
        { category_id: 13, attribute_id: 3, is_recommended: true },
        { category_id: 13, attribute_id: 4, is_recommended: true },
        { category_id: 13, attribute_id: 6, is_recommended: true },

        // Taladros: Voltaje, Color
        { category_id: 22, attribute_id: 5, is_recommended: true },
        { category_id: 22, attribute_id: 1, is_recommended: false },

        // Computadoras: Color
        { category_id: 32, attribute_id: 1, is_recommended: true },
        { category_id: 33, attribute_id: 1, is_recommended: true },
    ];

    console.log('Inserting taxonomy category attribute links...');
    for (const bridge of bridges) {
        await referenceDb.insert(taxonomyCategoryAttributes).values(bridge).onConflictDoNothing();
    }

    console.log('✅ Shopify Standard Taxonomy seed completed successfully.');
}

main().catch(err => {
    console.error('Error seeding taxonomy:', err);
    process.exit(1);
});
