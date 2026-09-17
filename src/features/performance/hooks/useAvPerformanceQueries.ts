import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { avPerformanceService } from '@/features/performance/api/avPerformanceApi';
import type { AvPerformanceCreateInput } from '@/types';
import { getErrorMessage } from '@/shared/lib/errors';
import { toast } from '@/shared/ui/Toast';

export const avPerformanceKeys = {
  all: ['av-performances'] as const,
  lists: () => [...avPerformanceKeys.all, 'list'] as const,
  list: (page: number, limit: number, search: string) =>
    [...avPerformanceKeys.lists(), { page, limit, search }] as const,
  details: () => [...avPerformanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...avPerformanceKeys.details(), id] as const,
};

export function useAvPerformanceList(page: number, limit: number, search = '', enabled = true) {
  return useQuery({
    queryKey: avPerformanceKeys.list(page, limit, search),
    queryFn: () => avPerformanceService.list(page, limit, search),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateAvPerformance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AvPerformanceCreateInput) => avPerformanceService.add(input),
    onSuccess: async (created) => {
      queryClient.setQueryData(avPerformanceKeys.detail(created.id), created);
      await queryClient.invalidateQueries({ queryKey: avPerformanceKeys.lists() });
      toast.success('AV performance created successfully.');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to create the AV performance.')),
  });
}
