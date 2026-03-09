import { Component, Show } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { useSupplier } from '../data/suppliers.api';
import { EditIcon, UserIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Button from '@shared/ui/Button';
import Sheet from '@shared/ui/Sheet';
import { personTypeLabels, taxIdTypeLabels, taxRegimeTypeLabels } from '../models/supplier.types';
import { StatusBadge } from '@shared/ui/Badge';

interface SupplierShowPanelProps {
    supplierId: number;
}

const SupplierShowPanel: Component<SupplierShowPanelProps> = (props) => {
    const navigate = useNavigate();

    // Use TanStack Query hook with the passed supplierId
    const supplierQuery = useSupplier(() => props.supplierId);

    const handleClose = () => {
        navigate({ to: '/suppliers' });
    };

    const handleEdit = () => {
        if (props.supplierId) navigate({ to: `/suppliers/edit/${props.supplierId}` });
    };

    const InfoRow = (rowProps: { label: string; value?: string | number | boolean | null }) => {
        const displayValue = () => {
            if (rowProps.value === null || rowProps.value === undefined) return '—';
            if (typeof rowProps.value === 'boolean') return rowProps.value ? 'Sí' : 'No';
            return String(rowProps.value);
        };
        return (
            <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-3 border-b border-border/50 last:border-0">
                <span class="text-sm font-medium text-muted w-40 flex-shrink-0">{rowProps.label}</span>
                <span class="text-sm text-text font-medium">{displayValue()}</span>
            </div>
        );
    };

    return (
        <Sheet
            isOpen={true}
            onClose={handleClose}
            title="Detalles del Proveedor"
            description="Información completa del proveedor"
            size="lg"
        >
            <Show
                when={props.supplierId > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="text-4xl mb-4">🔍</div>
                        <p class="text-muted">ID de proveedor inválido</p>
                    </div>
                }
            >
                <Show
                    when={!supplierQuery.isLoading}
                    fallback={
                        <div class="space-y-4">
                            <SkeletonLoader type="text" />
                            <SkeletonLoader type="text" count={3} />
                            <SkeletonLoader type="text" count={2} />
                        </div>
                    }
                >
                    <Show
                        when={supplierQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="text-4xl mb-4">📭</div>
                                <p class="text-muted">No se encontró el proveedor</p>
                            </div>
                        }
                    >
                        {(supplier) => (
                            <div class="space-y-6">
                                {/* Header info */}
                                <div class="flex items-start justify-between">
                                    <div>
                                        <h3 class="text-xl font-bold text-text">{supplier().business_name}</h3>
                                        <Show when={supplier().trade_name}>
                                            <p class="text-sm text-muted">{supplier().trade_name}</p>
                                        </Show>
                                    </div>
                                    <StatusBadge isActive={supplier().is_active} />
                                </div>

                                {/* Identification Section */}
                                <div class="bg-surface/50 rounded-xl p-4 space-y-0.5">
                                    <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Identificación</h4>
                                    <InfoRow
                                        label="Número ID"
                                        value={supplier().tax_id}
                                    />
                                    <InfoRow
                                        label="Tipo ID"
                                        value={taxIdTypeLabels[supplier().tax_id_type as keyof typeof taxIdTypeLabels] ?? supplier().tax_id_type}
                                    />
                                    <InfoRow
                                        label="Tipo Persona"
                                        value={personTypeLabels[supplier().person_type as keyof typeof personTypeLabels] ?? supplier().person_type}
                                    />
                                </div>

                                {/* Contact Section */}
                                <div class="bg-surface/50 rounded-xl p-4 space-y-0.5">
                                    <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contacto</h4>
                                    <InfoRow label="Email Facturación" value={supplier().email_billing} />
                                    <InfoRow label="Teléfono" value={supplier().phone} />
                                    <InfoRow label="Dirección Fiscal" value={supplier().addresses?.[0]?.address_line} />
                                </div>

                                {/* Fiscal Section */}
                                <div class="bg-surface/50 rounded-xl p-4 space-y-0.5">
                                    <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Información Fiscal</h4>
                                    <InfoRow
                                        label="Régimen Fiscal"
                                        value={supplier().tax_regime_type ? taxRegimeTypeLabels[supplier().tax_regime_type as keyof typeof taxRegimeTypeLabels] ?? supplier().tax_regime_type : undefined}
                                    />
                                    <InfoRow label="Agente de Retención" value={supplier().is_retention_agent} />
                                    <InfoRow label="Contribuyente Especial" value={supplier().is_special_contributor} />
                                    <InfoRow label="Obligado Contabilidad" value={supplier().obligado_contabilidad} />
                                </div>

                                {/* Actions */}
                                <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
                                    <Button variant="outline" onClick={handleClose}>
                                        Cerrar
                                    </Button>
                                    <Button variant="primary" onClick={handleEdit} class="gap-2">
                                        <EditIcon class="size-4" />
                                        Editar Proveedor
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default SupplierShowPanel;