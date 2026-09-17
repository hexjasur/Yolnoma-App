import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { avPerformanceService } from '@/features/performance/api/avPerformanceApi';

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
