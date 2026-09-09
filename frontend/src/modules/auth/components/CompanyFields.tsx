import { Component, type Accessor } from 'solid-js';
import CompanyGeneralFields, { type CompanyGeneralFieldsStatus } from '@shared/ui/form/company/CompanyGeneralFields';
import CompanyFiscalFields from '@shared/ui/form/company/CompanyFiscalFields';
import type { AnyFormApi } from '@shared/ui/form/form.types';

export interface CompanyFieldsStatus {
    slugAvailable: Accessor<boolean | null>;
    slugChecking: Accessor<boolean>;
    rucAvailable: Accessor<boolean | null>;
    rucChecking: Accessor<boolean>;
    isValidForSubmit: Accessor<boolean>;
}

interface CompanyFieldsProps {
    form: AnyFormApi;
    stepSubmitted: Accessor<boolean>;
    onStatusChange?: (status: CompanyFieldsStatus) => void;
}

export const CompanyFields: Component<CompanyFieldsProps> = (props) => {
    const handleStatusChange = (status: CompanyGeneralFieldsStatus) => {
        if (props.onStatusChange) {
            props.onStatusChange({
                slugAvailable: status.slugAvailable ?? (() => null),
                slugChecking: status.slugChecking ?? (() => false),
                rucAvailable: status.rucAvailable ?? (() => null),
                rucChecking: status.rucChecking ?? (() => false),
                isValidForSubmit: status.isValidForSubmit,
            });
        }
    };

    return (
        <div class="flex flex-col gap-4">
            <CompanyGeneralFields
                form={props.form}
                stepSubmitted={props.stepSubmitted}
                showSlug={true}
                checkSlugAvailability={true}
                checkRucAvailability={true}
                onStatusChange={handleStatusChange}
            />
            <CompanyFiscalFields
                form={props.form}
                stepSubmitted={props.stepSubmitted}
                obligadoControlType="segmented"
            />
        </div>
    );
};

export default CompanyFields;
