import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PerformanceCreateInput, PerformanceListResponse, PerformanceUpdateInput } from '@/types';
import { performanceService } from '@/features/performance/api/performanceApi';
import { getErrorMessage } from '@/shared/lib/errors';
import { toast } from '@/shared/ui/Toast';

export const performanceKeys = {
  all: ['performances'] as const,
  lists: () => [...performanceKeys.all, 'list'] as const,
  list: (page: number, limit: number, search: string) => [...performanceKeys.lists(), { page, limit, search }] as const,
  details: () => [...performanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...performanceKeys.details(), id] as const,
};

export function usePerformanceList(page: number, limit: number, search = '', enabled = true) {
  return useQuery({
    queryKey: performanceKeys.list(page, limit, search),
    queryFn: () => performanceService.list(page, limit, search),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function usePerformanceDetail(id?: string) {
  return useQuery({
    queryKey: performanceKeys.detail(id ?? ''),
    queryFn: () => performanceService.get(id!),
    enabled: Boolean(id),
  });
}

function invalidatePerformanceLists(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: performanceKeys.lists() });
}

export function useCreatePerformance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PerformanceCreateInput) => performanceService.add(input),
    onSuccess: async (created) => {
      queryClient.setQueryData(performanceKeys.detail(created.id), created);
      await invalidatePerformanceLists(queryClient);
      toast.success('Performance created successfully.');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to create the performance.')),
  });
}

export function useUpdatePerformance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PerformanceUpdateInput }) => performanceService.update(id, data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(performanceKeys.detail(updated.id), updated);
      queryClient.setQueriesData<PerformanceListResponse>({ queryKey: performanceKeys.lists() }, (current) => current && ({
        ...current,
        data: current.data.map((item) => item.id === updated.id ? updated : item),
      }));
      await invalidatePerformanceLists(queryClient);
      toast.success('Performance updated successfully.');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to update the performance.')),
  });
}

export function useDeletePerformance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => performanceService.delete(id),
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: performanceKeys.detail(id) });
      await invalidatePerformanceLists(queryClient);
      toast.success('Performance deleted successfully.');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to delete the performance.')),
  });
}
