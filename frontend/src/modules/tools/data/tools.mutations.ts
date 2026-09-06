import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { toolsApi, type ToolLoanBodyType, type ToolReturnBodyType } from './tools.api';
import { toolKeys } from './tools.keys';

export function useCreateToolLoan() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['tools', 'loans', 'create'],
        mutationFn: (body: ToolLoanBodyType) => toolsApi.create(body),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: toolKeys.loans() });
            qc.invalidateQueries({ queryKey: toolKeys.all });
        },
    }));
}

export function useRecordToolReturn() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['tools', 'loans', 'return'],
        mutationFn: ({ id, body }: { id: number; body: ToolReturnBodyType }) =>
            toolsApi.recordReturn(id, body),
        onSettled: (_data, _error, { id }) => {
            qc.invalidateQueries({ queryKey: toolKeys.loans() });
            qc.invalidateQueries({ queryKey: toolKeys.loanDetail(id) });
            qc.invalidateQueries({ queryKey: toolKeys.all });
        },
    }));
}
