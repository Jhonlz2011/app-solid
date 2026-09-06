import { Component, createSignal, createMemo, Show } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { PageHeader } from '@overlay/PageHeader';
import { SearchInput } from '@form/SearchInput';
import Button from '@form/Button';
import { DataTable } from '@shared/ui/DataTable';
import { WrenchIcon } from '@icons/WrenchIcon';
import { PlusIcon } from '@icons/PlusIcon';
import { useAuth } from '@modules/auth/store/auth.store';
import { useToolLoansList } from '../data/tools.queries';
import { createToolLoanColumns } from '../data/tools.columns';
import { ToolReturnDialog } from '../components/ToolReturnDialog';
import { ToolLoanShowPanel } from '../components/ToolLoanShowPanel';
import { ToolLoanNewSheet } from '../components/ToolLoanNewSheet';
import type { ToolLoanNode } from '../data/tools.api';

export const ToolLoansPage: Component = () => {
    const auth = useAuth();

    // Filters state
    const [search, setSearch] = createSignal('');
    const [activeTab, setActiveTab] = createSignal<'ALL' | 'DISPATCHED' | 'OVERDUE' | 'PARTIAL' | 'COMPLETED'>('ALL');

    // Dialogs / Sheets state
    const [isNewSheetOpen, setIsNewSheetOpen] = createSignal(false);
    const [returnLoanId, setReturnLoanId] = createSignal<number | null>(null);
    const [showLoanId, setShowLoanId] = createSignal<number | null>(null);

    // Queries
    const loansQuery = useToolLoansList(() => {
        const tab = activeTab();
        return {
            search: search() || undefined,
            status: tab === 'DISPATCHED' ? 'DISPATCHED' : tab === 'PARTIAL' ? 'PARTIALLY_RETURNED' : tab === 'COMPLETED' ? 'COMPLETED' : undefined,
            overdueOnly: tab === 'OVERDUE' ? true : undefined,
        };
    });

    const loans = () => loansQuery.data ?? [];

    const handleViewDetail = (loan: ToolLoanNode) => {
        setShowLoanId(loan.id);
    };

    const handleRecordReturn = (loan: ToolLoanNode) => {
        setReturnLoanId(loan.id);
    };

    const columns = createMemo(() =>
        createToolLoanColumns({
            onViewDetail: handleViewDetail,
            onRecordReturn: handleRecordReturn,
        })
    );

    const totalCount = () => loans().length;

    return (
        <div class="h-full flex flex-col bg-linear-to-br from-background via-background to-surface/20">
            <Outlet />

            {/* Header */}
            <div class="shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<WrenchIcon class="size-5" />}
                    iconBg="linear-gradient(135deg, #0284c7, #0369a1)"
                    title="Pañol de Herramientas"
                    count={totalCount()}
                    info="Control de custodia, vales de salida de herramientas y recepción técnica de devolución con inspección de condición."
                    actions={
                        <div class="flex items-center gap-2">
                            <Show when={!auth.user() || auth.canAdd('tool_loans')}>
                                <Button
                                    variant="primary"
                                    icon={<PlusIcon class="size-4" />}
                                    onClick={() => setIsNewSheetOpen(true)}
                                >
                                    <span class="hidden sm:inline">Nuevo Préstamo</span>
                                </Button>
                            </Show>
                        </div>
                    }
                />

                {/* Filter Tabs & Search Bar */}
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Quick filter tabs */}
                    <div class="flex items-center gap-1.5 p-1 bg-surface/50 border border-border/40 rounded-xl overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab('ALL')}
                            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                activeTab() === 'ALL'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted hover:text-text hover:bg-surface/60'
                            }`}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('DISPATCHED')}
                            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                activeTab() === 'DISPATCHED'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted hover:text-text hover:bg-surface/60'
                            }`}
                        >
                            En Custodia
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('OVERDUE')}
                            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                activeTab() === 'OVERDUE'
                                    ? 'bg-danger text-danger-foreground shadow-xs'
                                    : 'text-muted hover:text-text hover:bg-surface/60'
                            }`}
                        >
                            Vencidos
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('PARTIAL')}
                            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                activeTab() === 'PARTIAL'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted hover:text-text hover:bg-surface/60'
                            }`}
                        >
                            Retorno Parcial
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('COMPLETED')}
                            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                activeTab() === 'COMPLETED'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted hover:text-text hover:bg-surface/60'
                            }`}
                        >
                            Devueltos
                        </button>
                    </div>

                    {/* Search */}
                    <div class="flex items-center gap-2">
                        <SearchInput
                            value={search()}
                            onSearch={setSearch}
                            placeholder="Buscar por vale # o custodio..."
                            class="w-full sm:w-72"
                        />
                    </div>
                </div>
            </div>

            {/* DataTable */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden">
                <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                    <DataTable
                        data={loans()}
                        columns={columns()}
                        isLoading={loansQuery.isLoading}
                        isPlaceholderData={loansQuery.isPlaceholderData}
                        pagination={{ pageIndex: 0, pageSize: 50 }}
                        onPaginationChange={() => {}}
                        pageCount={1}
                        totalRows={totalCount()}
                        sorting={[]}
                        onSortingChange={() => {}}
                        enableRowSelection={false}
                        getRowId={(row) => String(row.id)}
                        enableVirtualization={false}
                        estimatedRowHeight={56}
                        emptyIcon={<WrenchIcon class="size-8 text-muted" />}
                        emptyMessage="No se encontraron vales de préstamo"
                        emptyDescription="Genera un vale de entrega para prestar herramientas a un empleado o custodio."
                    />
                </div>
            </div>

            {/* Return Inspection Dialog */}
            <ToolReturnDialog
                loanId={returnLoanId()}
                isOpen={returnLoanId() !== null}
                onClose={() => setReturnLoanId(null)}
            />

            {/* Show / Detail Panel */}
            <ToolLoanShowPanel
                loanId={showLoanId()}
                isOpen={showLoanId() !== null}
                onClose={() => setShowLoanId(null)}
                onRecordReturn={(loan) => {
                    setShowLoanId(null);
                    setReturnLoanId(loan.id);
                }}
            />

            {/* New Loan Sheet */}
            <Show when={isNewSheetOpen()}>
                <ToolLoanNewSheet
                    onClose={() => setIsNewSheetOpen(false)}
                />
            </Show>
        </div>
    );
};

export default ToolLoansPage;
