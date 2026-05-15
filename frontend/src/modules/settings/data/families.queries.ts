import { createQuery } from '@tanstack/solid-query';
import { familiesApi, type FamilyItem } from './families.api';
import { familyKeys } from './families.keys';

export function useFamiliesList() {
    return createQuery(() => ({
        queryKey: familyKeys.all,
        queryFn: () => familiesApi.list() as Promise<FamilyItem[]>,
        staleTime: 1000 * 60 * 30,
    }));
}
