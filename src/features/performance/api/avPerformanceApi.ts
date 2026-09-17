import { api } from '@/shared/api/http';
import type { AvPerformance, AvPerformanceListResponse } from '@/types';

const BASE = '/api/v2/av-performance';

type ApiResponse = {
  data?: AvPerformance[] | AvPerformance;
  pagination?: AvPerformanceListResponse['pagination'];
};

export const avPerformanceService = {
  list: async (page = 1, limit = 12, search?: string): Promise<AvPerformanceListResponse> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search?.trim()) params.set('search', search.trim());
    const res = await api.get<ApiResponse | AvPerformance[]>(`${BASE}?${params.toString()}`);
    const rawData = (res as ApiResponse)?.data;
    const data = Array.isArray(rawData) ? rawData : Array.isArray(res) ? res : [];
    const pagination = (res as ApiResponse)?.pagination ?? {
      page,
      limit,
      total: data.length,
      totalPages: Math.max(1, Math.ceil(data.length / limit)),
      hasNextPage: false,
      hasPrevPage: page > 1,
    };
    return { data, pagination };
  },
  get: async (id: string): Promise<AvPerformance> => {
    const res = await api.get<{ data?: AvPerformance } | AvPerformance>(`${BASE}/${id}`);
    if (res && typeof res === 'object' && 'data' in res && res.data) return res.data;
    return res as AvPerformance;
  },
} as const;
