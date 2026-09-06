import type { ToolLoanQueryType } from '@app/schema/dto';

export const toolKeys = {
    all: ['tools'] as const,
    loans: () => [...toolKeys.all, 'loans'] as const,
    loanList: (query?: ToolLoanQueryType) => [...toolKeys.loans(), 'list', query ?? {}] as const,
    loanDetail: (id: number) => [...toolKeys.loans(), 'detail', id] as const,
    employeeCustody: (employeeId: string) => [...toolKeys.all, 'custody', employeeId] as const,
};
