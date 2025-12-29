import { Component, createMemo } from 'solid-js';
import { useNavigate, useLocation } from '@tanstack/solid-router';
import { useQueryClient, createQuery } from '@tanstack/solid-query';
import ProductSlidePanel from './ProductSlidePanel';
import { categoryQueries, brandQueries } from '../data/products.queries';
import { productKeys } from '../data/products.keys';

/**
 * Route component for /products/show/$id
 * Renders ProductSlidePanel in view mode
 * Parent (ProductsPage) stays mounted while this renders in the Outlet
 */
const ProductShowPanel: Component = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

    // Extract product ID from URL path
    const productId = createMemo(() => {
        const match = location().pathname.match(/\/products\/show\/(\d+)/);
        return match ? Number(match[1]) : undefined;
    });

    // Fetch categories and brands for the panel - using queryOptions
    const categoriesQuery = createQuery(() => categoryQueries.list());
    const brandsQuery = createQuery(() => brandQueries.list());

    const handleClose = () => {
        navigate({ to: '/products' });
    };

    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: productKeys.all });
        navigate({ to: '/products' });
    };

    const handleModeChange = (newMode: 'view' | 'edit' | 'create') => {
        const id = productId();
        if (newMode === 'edit' && id) {
            navigate({ to: `/products/edit/${id}` });
        }
    };

    return (
        <ProductSlidePanel
            productId={productId()}
            mode="view"
            categories={categoriesQuery.data ?? []}
            brands={brandsQuery.data ?? []}
            onClose={handleClose}
            onSuccess={handleSuccess}
        />
    );
};

export default ProductShowPanel;
