import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type {
    ToolLoanBodyType,
    ToolReturnBodyType,
    ToolLoanQueryType,
    ToolLoanNode,
    ToolLoanDetail,
    EmployeeCustodySummary,
} from '@app/schema/dto';

export type {
    ToolLoanBodyType,
    ToolReturnBodyType,
    ToolLoanQueryType,
    ToolLoanNode,
    ToolLoanDetail,
    EmployeeCustodySummary,
};

export const toolsApi = {
    list: async (query?: ToolLoanQueryType): Promise<ToolLoanNode[]> => {
        const { data, error } = await api['tool-loans'].get({ query: query as any });
        if (error) throwApiError(error);
        return (data as unknown as ToolLoanNode[]) || [];
    },

    get: async (id: number): Promise<ToolLoanDetail> => {
        const { data, error } = await api['tool-loans']({ id }).get();
        if (error) throwApiError(error);
        return data as unknown as ToolLoanDetail;
    },

    create: async (body: ToolLoanBodyType): Promise<ToolLoanDetail> => {
        const { data, error } = await api['tool-loans'].post(body as any);
        if (error) throwApiError(error);
        return data as unknown as ToolLoanDetail;
    },

    recordReturn: async (id: number, body: ToolReturnBodyType): Promise<ToolLoanDetail> => {
        const { data, error } = await api['tool-loans']({ id })['return'].post(body as any);
        if (error) throwApiError(error);
        return data as unknown as ToolLoanDetail;
    },

    getCustody: async (employeeId: string): Promise<EmployeeCustodySummary> => {
        const { data, error } = await api['tool-loans'].custody({ employeeId }).get();
        if (error) throwApiError(error);
        return data as unknown as EmployeeCustodySummary;
    },
};
