import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { toolsApi, type ToolLoanQueryType } from './tools.api';
import { toolKeys } from './tools.keys';

export function useToolLoansList(query?: () => ToolLoanQueryType | undefined) {
    return createQuery(() => {
        const q = query?.();
        return {
            queryKey: toolKeys.loanList(q),
            queryFn: () => toolsApi.list(q),
            staleTime: STALE_TIME.SHORT,
            gcTime: GC_TIME.DEFAULT,
        };
    });
}

export function useToolLoanDetail(id: () => number | null | undefined) {
    return createQuery(() => {
        const loanId = id();
        return {
            queryKey: toolKeys.loanDetail(loanId ?? 0),
            queryFn: () => toolsApi.get(loanId!),
            enabled: Boolean(loanId && loanId > 0),
            staleTime: STALE_TIME.SHORT,
            gcTime: GC_TIME.DEFAULT,
        };
    });
}

export function useEmployeeCustody(employeeId: () => string | null | undefined) {
    return createQuery(() => {
        const empId = employeeId();
        return {
            queryKey: toolKeys.employeeCustody(empId ?? ''),
            queryFn: () => toolsApi.getCustody(empId!),
            enabled: Boolean(empId && empId.length > 0),
            staleTime: STALE_TIME.SHORT,
            gcTime: GC_TIME.DEFAULT,
        };
    });
}
