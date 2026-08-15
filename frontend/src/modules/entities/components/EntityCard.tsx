/**
 * EntityCard.tsx — Generic Mobile card representation for any entity (Client, Supplier, Employee, Carrier).
 */
import { Component, Show } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import type { EntityListItem } from '../data/entities.api';
import { useAuth } from '@/modules/auth/store/auth.store';
import { StatusBadge, Badge } from '@shared/ui/Badge';
import { EditIcon, TrashIcon, RotateCcwIcon } from '@shared/ui/icons';
import Checkbox from '@shared/ui/Checkbox';
import { cn } from '@shared/lib/utils';
import Button from '@shared/ui/Button';
import LinkButton from '@shared/ui/LinkButton';
import type { RbacModule } from '@app/schema/enums';

export interface EntityCardProps {
    entity: EntityListItem;
    isSelected: boolean;
    onSelect: (checked: boolean) => void;
    onDelete: (entity: EntityListItem) => void;
    onRestore: (entity: EntityListItem) => void;
    basePath?: string; // e.g., '/clients', '/suppliers', '/employees'
    permissionKey?: RbacModule;
}

export const EntityCard: Component<EntityCardProps> = (props) => {
    const auth = useAuth();
    const navigate = useNavigate();
    const basePath = () => props.basePath || (props.entity.is_client ? '/clients' : props.entity.is_supplier ? '/suppliers' : props.entity.is_employee ? '/employees' : '/clients');
    const permKey = () => props.permissionKey || (props.entity.is_client ? 'clients' : props.entity.is_supplier ? 'suppliers' : props.entity.is_employee ? 'employees' : 'clients');
    const canDestroy = () => auth.hasPermission(`${permKey()}.destroy` as any);

    return (
        <div
            class={cn(
                'group relative flex items-start gap-3 px-3 py-3.5',
                'bg-card border-b border-border',
                'transition-colors duration-150',
                props.isSelected && 'bg-row-selected',
            )}
            onClick={() => navigate({ to: `${basePath()}/${props.entity.id}/show` })}
        >
            {/* Left: checkbox + active accent */}
            <div
                class={cn(
                    'absolute left-0 top-0 bottom-0 w-0.5 rounded-r',
                    props.entity.is_active ? 'bg-emerald-500' : 'bg-border',
                )}
            />

            {/* Checkbox — stops propagation */}
            <div class="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={props.isSelected}
                    onChange={props.onSelect}
                />
            </div>

            {/* Content */}
            <div class="flex-1 min-w-0">
                {/* Row 1: name + status */}
                <div class="flex items-start justify-between gap-2">
                    <span class="font-semibold text-text text-sm leading-tight truncate">
                        {props.entity.business_name}
                    </span>
                    <StatusBadge isActive={props.entity.is_active} />
                </div>

                {/* Row 2: trade name */}
                <Show when={props.entity.trade_name}>
                    <p class="text-xs text-muted truncate mt-0.5">
                        {props.entity.trade_name}
                    </p>
                </Show>

                {/* Row 3: tax_id + person type */}
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span class="font-mono text-xs text-primary font-semibold">
                        {props.entity.tax_id}
                    </span>
                    <Badge
                        variant={props.entity.person_type === 'JURIDICA' ? 'primary' : 'info'}
                        class="text-[10px] px-1.5 py-0"
                    >
                        {props.entity.person_type === 'JURIDICA' ? 'Jurídica' : 'Natural'}
                    </Badge>
                </div>

                <Show when={props.entity.email_billing}>
                    <p class="text-xs text-muted truncate mt-0.5">
                        {props.entity.email_billing}
                    </p>
                </Show>
            </div>

            {/* Right: actions */}
            <div
                class="flex items-center gap-0.5 shrink-0 self-center"
                onClick={(e) => e.stopPropagation()}
            >
                <Show
                    when={props.entity.is_active}
                    fallback={
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-8 w-8 text-muted hover:text-emerald-400 hover:bg-emerald-500/10"
                                title="Restaurar"
                                onClick={() => props.onRestore(props.entity)}
                            >
                                <RotateCcwIcon class="size-4" />
                            </Button>
                            <Show when={canDestroy()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="size-8 text-muted hover:text-danger hover:bg-danger/10 shadow-none"
                                    title="Eliminar permanentemente"
                                    onClick={() => props.onDelete(props.entity)}
                                >
                                    <TrashIcon class="size-4" />
                                </Button>
                            </Show>
                        </>
                    }
                >
                    <LinkButton
                        to={`${basePath()}/${props.entity.id}/edit`}
                        variant="ghost"
                        size="icon"
                        class="size-8 text-muted hover:text-info hover:bg-info/10"
                        title="Editar"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <EditIcon class="size-4" />
                    </LinkButton>
                    <Button
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 text-muted hover:text-danger hover:bg-danger/10"
                        title="Eliminar"
                        onClick={() => props.onDelete(props.entity)}
                    >
                        <TrashIcon class="size-4" />
                    </Button>
                </Show>
            </div>
        </div>
    );
};

export default EntityCard;
