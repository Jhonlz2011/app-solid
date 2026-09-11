import { Component, type Accessor } from 'solid-js';
import CompanyGeneralFields from '@shared/ui/form/company/CompanyGeneralFields';
import CompanyFiscalFields from '@shared/ui/form/company/CompanyFiscalFields';
import type { AnyFormApi } from '@shared/ui/form/form.types';

interface CompanyFieldsProps {
    form: AnyFormApi;
    stepSubmitted: Accessor<boolean>;
}

export const CompanyFields: Component<CompanyFieldsProps> = (props) => {
    return (
        <div class="flex flex-col gap-4">
            <CompanyGeneralFields
                form={props.form}
                stepSubmitted={props.stepSubmitted}
                showSlug={true}
                checkSlugAvailability={true}
                checkRucAvailability={true}
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
