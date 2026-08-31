import { Component, Show } from 'solid-js';
import { businessTypeLabels, taxRegimeTypeLabels } from '@shared/constants/entity-labels';
import type { BusinessType, TaxRegimeType } from '@app/schema/enums';
import { Badge } from '@shared/ui/display/Badge';

export interface CompanySummaryData {
    slug: string;
    ruc: string;
    businessName: string;
    tradeName?: string | null;
    businessType?: string | null;
    mainAddress?: string | null;
    taxRegime?: string | null;
    obligadoContabilidad?: boolean | null;
    contribuyenteEspecial?: string | null;
}

interface CompanySummaryCardProps {
    data: CompanySummaryData;
}

export const CompanySummaryCard: Component<CompanySummaryCardProps> = (props) => {
    const businessTypeLabel = () => {
        const bt = props.data.businessType;
        if (!bt) return null;
        return businessTypeLabels[bt as BusinessType] || bt;
    };

    const taxRegimeLabel = () => {
        const tr = props.data.taxRegime;
        if (!tr) return null;
        return taxRegimeTypeLabels[tr as TaxRegimeType] || tr;
    };

    return (
        <div class="bg-card-alt border border-border rounded-xl p-4 space-y-2 mb-3">
            <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clip-rule="evenodd" />
                </svg>
                Datos de la Empresa
            </h3>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-1 items-center">
                <span class="text-muted">Subdominio / Slug:</span>
                <div>
                    <Badge variant="primary" class="font-mono text-[11px] px-2 py-0.5">
                        {props.data.slug}.zelys.app
                    </Badge>
                </div>

                <span class="text-muted">RUC:</span>
                <div>
                    <Badge variant="default" class="font-mono text-[11px] px-2 py-0.5 text-text">
                        {props.data.ruc}
                    </Badge>
                </div>

                <span class="text-muted">Razón Social:</span>
                <span class="text-text font-semibold">{props.data.businessName}</span>

                <Show when={props.data.tradeName}>
                    <span class="text-muted">Nombre Comercial:</span>
                    <span class="text-text">{props.data.tradeName}</span>
                </Show>

                <Show when={businessTypeLabel()}>
                    <span class="text-muted">Tipo de Negocio:</span>
                    <div>
                        <Badge variant="purple" class="text-[11px]">
                            {businessTypeLabel()}
                        </Badge>
                    </div>
                </Show>

                <Show when={props.data.mainAddress}>
                    <span class="text-muted">Dirección Matriz:</span>
                    <span class="text-text truncate">{props.data.mainAddress}</span>
                </Show>

                <Show when={taxRegimeLabel()}>
                    <span class="text-muted">Régimen Tributario:</span>
                    <div>
                        <Badge variant="teal" class="text-[11px]">
                            {taxRegimeLabel()}
                        </Badge>
                    </div>
                </Show>

                <span class="text-muted">¿Lleva contabilidad?</span>
                <div>
                    <Badge variant={props.data.obligadoContabilidad ? 'success' : 'default'} class="text-[11px]">
                        {props.data.obligadoContabilidad ? 'Sí' : 'No'}
                    </Badge>
                </div>

                <Show when={props.data.contribuyenteEspecial}>
                    <span class="text-muted">Contribuyente Especial:</span>
                    <div>
                        <Badge variant="warning" class="text-[11px]">
                            {props.data.contribuyenteEspecial}
                        </Badge>
                    </div>
                </Show>
            </div>
        </div>
    );
};

export default CompanySummaryCard;
