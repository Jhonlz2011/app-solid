import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { rbac } from '../../plugins/rbac';
import { toolsService } from './tools.service';
import {
    ToolLoanBodySchema,
    ToolReturnBodySchema,
    ToolLoanQuerySchema,
    IdParamSchema,
} from '@app/schema/backend';

export const toolLoansRoutes = new Elysia({ prefix: '/tool-loans' })
    .use(tenantGuard)
    .use(rbac)
    .get(
        '/',
        ({ query, currentCompanyId }) => {
            return toolsService.listToolLoans(currentCompanyId, query as any);
        },
        {
            query: ToolLoanQuerySchema,
            permission: 'tool_loans.read',
        }
    )
    .get(
        '/:id',
        ({ params, currentCompanyId }) => {
            return toolsService.getToolLoan(Number(params.id), currentCompanyId);
        },
        {
            params: IdParamSchema,
            permission: 'tool_loans.read',
        }
    )
    .post(
        '/',
        async ({ body, set, headers, currentUserId, currentCompanyId }) => {
            const loan = await toolsService.createToolLoan(
                body as any,
                currentCompanyId,
                currentUserId,
                headers['x-client-id']
            );
            set.status = 201;
            return loan;
        },
        {
            body: ToolLoanBodySchema,
            permission: 'tool_loans.create',
        }
    )
    .post(
        '/:id/return',
        ({ params, body, headers, currentUserId, currentCompanyId }) => {
            return toolsService.recordToolReturn(
                Number(params.id),
                body as any,
                currentCompanyId,
                currentUserId,
                headers['x-client-id']
            );
        },
        {
            params: IdParamSchema,
            body: ToolReturnBodySchema,
            permission: 'tool_loans.update',
        }
    )
    .get(
        '/custody/:employeeId',
        ({ params, currentCompanyId }) => {
            return toolsService.listEmployeeCustody(params.employeeId, currentCompanyId);
        },
        {
            permission: 'tool_loans.read',
        }
    );
