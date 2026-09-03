import { Component, JSX } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';

export interface CrudShellProps {
    header: JSX.Element;
    toolbar?: JSX.Element;
    children: JSX.Element;
    extra?: JSX.Element;
    contentContainerClass?: string;
    showCardWrapper?: boolean;
}

/**
 * CrudShell — Shell estructural estándar para vistas CRUD / Entidades en la SPA.
 *
 * Mantiene la coherencia visual (fondo degradado, márgenes, padding responsivo)
 * y garantiza la integración con rutas anidadas (<Outlet /> para sheets y modales).
 */
export const CrudShell: Component<CrudShellProps> = (props) => {
    return (
        <div class="h-full flex flex-col bg-linear-to-br from-background via-background to-surface/20">
            {/* Deep-Nested Routes para Sheets y Modales (ej. /new, /$id/edit) */}
            <Outlet />

            {/* Cabecera y Barra de herramientas */}
            <div class="shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                {props.header}
                {props.toolbar}
            </div>

            {/* Área de contenido principal */}
            <div class={`flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden ${props.contentContainerClass || ''}`}>
                {props.showCardWrapper !== false ? (
                    <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                        {props.children}
                    </div>
                ) : (
                    props.children
                )}
            </div>

            {/* Elementos auxiliares: Barras de selección flotantes, modales de confirmación, etc. */}
            {props.extra}
        </div>
    );
};

export default CrudShell;
