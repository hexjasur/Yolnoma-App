import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { avPerformanceService } from '@/features/performance/api/avPerformanceApi';
import type { AvPerformanceListResponse, AvPerformanceCreateInput, AvPerformanceUpdateInput } from '@/types';
import { getErrorMessage } from '@/shared/lib/errors';
import { toast } from '@/shared/ui/Toast';

export const avPerformanceKeys = {
  all: ['av-performances'] as const,
  lists: () => [...avPerformanceKeys.all, 'list'] as const,
  list: (page: number, limit: number, search: string) => [...avPerformanceKeys.lists(), { page, limit, search }] as const,
  details: () => [...avPerformanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...avPerformanceKeys.details(), id] as const,
};
export function useAvPerformanceList(page: number, limit: number, search = '', enabled = true) { return useQuery({ queryKey: avPerformanceKeys.list(page, limit, search), queryFn: () => avPerformanceService.list(page, limit, search), enabled, placeholderData: keepPreviousData }); }
export function useAvPerformanceDetail(id?: string) { return useQuery({ queryKey: avPerformanceKeys.detail(id ?? ''), queryFn: () => avPerformanceService.get(id!), enabled: Boolean(id) }); }
function invalidate(client: ReturnType<typeof useQueryClient>) { return client.invalidateQueries({ queryKey: avPerformanceKeys.lists() }); }
export function useCreateAvPerformance() { const client = useQueryClient(); return useMutation({ mutationFn: (input: AvPerformanceCreateInput) => avPerformanceService.add(input), onSuccess: async (item) => { client.setQueryData(avPerformanceKeys.detail(item.id), item); await invalidate(client); toast.success('AV performance created successfully.'); }, onError: (e) => toast.error(getErrorMessage(e, 'Unable to create the AV performance.')) }); }
export function useUpdateAvPerformance() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, data }: { id: string; data: AvPerformanceUpdateInput }) => avPerformanceService.update(id, data), onSuccess: async (item) => { client.setQueryData(avPerformanceKeys.detail(item.id), item); client.setQueriesData<AvPerformanceListResponse>({ queryKey: avPerformanceKeys.lists() }, (current) => current && ({ ...current, data: current.data.map((x) => x.id === item.id ? item : x) })); await invalidate(client); toast.success('AV performance updated successfully.'); }, onError: (e) => toast.error(getErrorMessage(e, 'Unable to update the AV performance.')) }); }
export function useDeleteAvPerformance() { const client = useQueryClient(); return useMutation({ mutationFn: (id: string) => avPerformanceService.delete(id), onSuccess: async (_item, id) => { client.removeQueries({ queryKey: avPerformanceKeys.detail(id) }); await invalidate(client); toast.success('AV performance deleted successfully.'); }, onError: (e) => toast.error(getErrorMessage(e, 'Unable to delete the AV performance.')) }); }
