import { Component } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { useQueryClient, createQuery } from '@tanstack/solid-query';
import ProductSlidePanel from './ProductSlidePanel';
import { categoryQueries, brandQueries } from '../data/products.queries';
import { productKeys } from '../data/products.keys';

/**
 * Route component for /products/new
 * Renders ProductSlidePanel in create mode
 * Parent (ProductsPage) stays mounted while this renders in the Outlet
 */
const ProductNewPanel: Component = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

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

    return (
        <ProductSlidePanel
            productId={undefined}
            mode="create"
            categories={categoriesQuery.data ?? []}
            brands={brandsQuery.data ?? []}
            onClose={handleClose}
            onSuccess={handleSuccess}
        />
    );
};

export default ProductNewPanel;
