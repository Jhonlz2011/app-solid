/**
 * CategoryPage — Main view for "Categorías" module.
 * Displays the Category management table with deep-linked Outlet Modals.
 */
import { Component } from 'solid-js';
import { Outlet, useNavigate } from '@tanstack/solid-router';
import { PageHeader } from '@shared/ui/PageHeader';
import CategoryTable from '../components/CategoryTable';
import Button from '@shared/ui/Button';
import { PlusIcon, TagIcon } from '@shared/ui/icons';

const CategoryPage: Component = () => {
    const navigate = useNavigate();

    const handleNewCategory = (parentId?: number) => {
        navigate({ 
            to: '/categories/new', 
            search: parentId ? ({ parentId: String(parentId) } as any) : undefined,
        });
    };

    const handleShowCategory = (id: number) => {
        navigate({ to: `/categories/${id}/show`, search: undefined });
    };

    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
            {/* Deep nested routing Modals drop here */}
            <Outlet />
            
            {/* Header */}
            <div class="flex-shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<TagIcon />}
                    iconBg="linear-gradient(135deg, #f59e0b, #d97706)"
                    title="Categorías"
                    info="Organiza las categorías de tus productos y define la estructura de tu catálogo."
                    actions={
                        <Button
                            icon={<PlusIcon />}
                            to="/categories/new"
                            preload="intent"
                        >
                            <span class="hidden sm:inline">Nueva Categoría</span>
                        </Button>
                    }
                />
            </div>

            {/* Content */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 flex flex-col gap-4 overflow-auto">
                <CategoryTable
                    onEdit={handleShowCategory}
                    onAddChild={handleNewCategory}
                />
            </div>
        </div>
    );
};

export default CategoryPage;
