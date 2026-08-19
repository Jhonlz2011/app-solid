import type { api } from '@shared/lib/eden';

/** Full response array from /api/sri/by-ruc */
type SriByRucResponse = Awaited<ReturnType<typeof api.sri['by-ruc']['get']>>['data'];

/** Single SRI search result item inferred directly from Eden backend schema */
export type SriSearchResult = NonNullable<SriByRucResponse>[number];

/** Backward-compatible alias */
export type SriSupplierResponse = SriSearchResult;