/**
 * useEntitySmartLookup.ts
 *
 * Smart lookup hook providing 2-tier resolution:
 * 1. Local ERP Multi-Role Lookup (`/api/entities/lookup/:taxId`)
 * 2. Official SRI Search (`fetchSriByRuc`)
 */
import { createSignal, batch } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { api } from '@shared/lib/eden';
import type { SriSearchResult } from '@modules/sri/sri.types';
import { fetchSriByRuc, sriKeys } from '@modules/sri/sri.queries';
import { STALE_TIME } from '@shared/constants/cache.constants';
import type { EntityFormApi } from '../entity-form.types';
import { mapEntityDetailToFormData } from '../entity-form.utils';

export interface ExistingEntityNotice {
    businessName: string;
    roles: string[];
}

export function useEntitySmartLookup(
    form: EntityFormApi,
    lockedRoles?: Partial<Record<'isClient' | 'isSupplier' | 'isEmployee' | 'isCarrier', boolean>>,
    onFocusBusinessName?: () => void
) {
    const queryClient = useQueryClient();
    const [isSearchingRuc, setIsSearchingRuc] = createSignal(false);
    const [sriError, setSriError] = createSignal('');
    const [existingEntityNotice, setExistingEntityNotice] = createSignal<ExistingEntityNotice | null>(null);

    const handleSriSelect = (source: 'RUC' | 'NAME') => (supplierResult: SriSearchResult | null) => {
        if (!supplierResult) return;

        form.setFieldValue('taxId', supplierResult.ruc);
        form.setFieldValue('businessName', supplierResult.razonSocial);
        form.setFieldValue('tradeName', supplierResult.nombreComercial ?? '');
        form.setFieldValue('taxIdType', 'RUC');
        form.setFieldValue('personType', supplierResult.isSociedad ? 'JURIDICA' : 'NATURAL');
        form.setFieldValue('obligadoContabilidad', !!supplierResult.obligadoContabilidad);
        form.setFieldValue('isRetentionAgent', !!supplierResult.agenteRetencion);
        form.setFieldValue('isSpecialContributor', !!supplierResult.contribuyenteEspecial);
        form.setFieldValue('taxRegimeType', supplierResult.isRimpe ? 'RIMPE_EMPRENDEDOR' : 'GENERAL');

        if (source === 'NAME') {
            queryClient.setQueryData(sriKeys.byName(supplierResult.razonSocial), [supplierResult]);
        }

        if (supplierResult.city) {
            const addresses = form.getFieldValue('addresses');
            if (addresses.length === 0) {
                form.pushFieldValue('addresses', {
                    addressLine: '',
                    city: supplierResult.city,
                    country: 'Ecuador',
                    countryCode: 'EC',
                    postalCode: '',
                    isMain: true,
                });
            } else {
                form.setFieldValue('addresses[0].city', supplierResult.city);
                form.setFieldValue('addresses[0].country', 'Ecuador');
                form.setFieldValue('addresses[0].countryCode', 'EC');
            }
        }
    };

    const handleNameInput = (value: string) => {
        if (form.getFieldValue('businessName') === value) return;
        form.setFieldValue('businessName', value);
    };

    const triggerRucSearch = async () => {
        const val = form.getFieldValue('taxId');
        if (val.length === 13) {
            try {
                setSriError('');
                setIsSearchingRuc(true);

                // 1. Check if entity already exists in this tenant (local ERP lookup)
                try {
                    const { data: localEntity } = await api.entities.lookup({ taxId: val }).get();
                    if (localEntity) {
                        const existingRoles: string[] = [];
                        if (localEntity.is_client) existingRoles.push('Cliente');
                        if (localEntity.is_supplier) existingRoles.push('Proveedor');
                        if (localEntity.is_employee) existingRoles.push('Empleado');
                        if (localEntity.is_carrier) existingRoles.push('Transportista');

                        setExistingEntityNotice({
                            businessName: localEntity.business_name,
                            roles: existingRoles,
                        });

                        const mapped = mapEntityDetailToFormData(localEntity, lockedRoles);

                        batch(() => {
                            form.setFieldValue('taxId', mapped.taxId);
                            form.setFieldValue('businessName', mapped.businessName);
                            form.setFieldValue('tradeName', mapped.tradeName);
                            form.setFieldValue('emailBilling', mapped.emailBilling);
                            form.setFieldValue('phone', mapped.phone);
                            form.setFieldValue('taxIdType', mapped.taxIdType);
                            form.setFieldValue('personType', mapped.personType);
                            form.setFieldValue('obligadoContabilidad', mapped.obligadoContabilidad);
                            form.setFieldValue('isRetentionAgent', mapped.isRetentionAgent);
                            form.setFieldValue('isSpecialContributor', mapped.isSpecialContributor);
                            form.setFieldValue('taxRegimeType', mapped.taxRegimeType);

                            // Maintain existing and new roles
                            if (mapped.isClient) form.setFieldValue('isClient', true);
                            if (mapped.isSupplier) form.setFieldValue('isSupplier', true);
                            if (mapped.isEmployee) form.setFieldValue('isEmployee', true);
                            if (mapped.isCarrier) form.setFieldValue('isCarrier', true);

                            if (mapped.addresses.length > 0) form.setFieldValue('addresses', mapped.addresses);
                            if (mapped.contacts.length > 0) form.setFieldValue('contacts', mapped.contacts);
                        });

                        toast.info(
                            `Entidad encontrada en el sistema (${existingRoles.join(', ')}). Al guardar se actualizará y promoverá su rol.`
                        );
                        setIsSearchingRuc(false);
                        return;
                    }
                } catch {
                    // Ignore lookup errors and fallback to SRI
                }

                // 2. Query SRI online if not registered in local ERP
                const data = await queryClient.fetchQuery({
                    queryKey: sriKeys.byRuc(val),
                    queryFn: () => fetchSriByRuc(val),
                    staleTime: STALE_TIME.DAY,
                });

                if (data && data.length > 0) {
                    setExistingEntityNotice(null);
                    handleSriSelect('RUC')(data[0]);
                    toast.success('Datos del SRI obtenidos correctamente');
                } else {
                    setSriError('No se encontró información para este RUC en el SRI.');
                    toast.error('RUC no encontrado. Ingrese los detalles manualmente.');
                    batch(() => {
                        form.setFieldValue('businessName', '');
                        form.setFieldValue('tradeName', '');
                        form.setFieldValue('taxRegimeType', undefined);
                        form.setFieldValue('obligadoContabilidad', false);
                        form.setFieldValue('isSpecialContributor', false);
                        form.setFieldValue('isRetentionAgent', false);
                    });
                    queueMicrotask(() => {
                        onFocusBusinessName?.();
                    });
                }
            } catch {
                toast.error('Error de conexión con el SRI.');
            } finally {
                setIsSearchingRuc(false);
            }
        } else {
            setSriError('');
            toast.error('El RUC debe tener 13 dígitos.');
        }
    };

    return {
        isSearchingRuc,
        sriError,
        setSriError,
        existingEntityNotice,
        triggerRucSearch,
        handleSriSelect,
        handleNameInput,
    };
}
