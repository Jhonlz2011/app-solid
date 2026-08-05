import { Component } from 'solid-js';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@shared/ui/Sheet';
import { DataTableColumnFilter } from '@shared/ui/DataTable/DataTableColumnFilter';
import type { ColumnFilterConfig } from '../data/employee.columns';

interface EmployeeFilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    filters: {
        personType: ColumnFilterConfig;
        taxIdType: ColumnFilterConfig;
        isActive: ColumnFilterConfig;
        businessName: ColumnFilterConfig;
    };
}

export const EmployeeFilterSheet: Component<EmployeeFilterSheetProps> = (props) => {
    return (
        <Sheet isOpen={props.isOpen} onClose={props.onClose} side="right">
            <SheetContent class="w-full sm:max-w-md p-0 flex flex-col h-full bg-background/95 backdrop-blur-xl border-l border-border/50">
                <SheetHeader class="px-6 py-4 border-b border-border/50 shrink-0 bg-surface/50">
                    <SheetTitle class="text-xl">Filtros de Empleados</SheetTitle>
                    <SheetDescription>Aplica filtros para encontrar empleados específicos.</SheetDescription>
                </SheetHeader>
                <div class="flex-1 overflow-y-auto p-6 space-y-6">
                    <div class="space-y-4">
                        <h4 class="text-sm font-medium text-text">Estado</h4>
                        <DataTableColumnFilter title="Estado" {...props.filters.isActive} />
                    </div>
                    <div class="space-y-4">
                        <h4 class="text-sm font-medium text-text">Tipo de Persona</h4>
                        <DataTableColumnFilter title="Tipo de Persona" {...props.filters.personType} />
                    </div>
                    <div class="space-y-4">
                        <h4 class="text-sm font-medium text-text">Tipo de Identificación</h4>
                        <DataTableColumnFilter title="Tipo de ID" {...props.filters.taxIdType} />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default EmployeeFilterSheet;
