import { api } from '@/shared/api/http';
import type { Performance, PerformanceCreateInput, PerformanceUpdateInput, PerformanceListResponse } from '@/types';

const BASE = '/api/v2/performance';

interface PerformanceApiResponse {
  success?: boolean;
  message?: string;
  data?: Performance[] | { data?: Performance[]; pagination?: PerformanceListResponse['pagination'] };
  pagination?: PerformanceListResponse['pagination'];
}

export const performanceService = {
  /**
   * GET /api/v2/performance?page=1&limit=12&search=...
   * Returns paginated performance list with metadata.
   */
  list: async (page = 1, limit = 12, search?: string): Promise<PerformanceListResponse> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search?.trim()) params.set('search', search.trim());
    const res = await api.get<PerformanceApiResponse | Performance[]>(`${BASE}?${params.toString()}`);

    const rawData = (res as PerformanceApiResponse)?.data;
    let data: Performance[] = [];
    if (Array.isArray(rawData)) {
      data = rawData;
    } else if (rawData && typeof rawData === 'object' && 'data' in rawData && Array.isArray(rawData.data)) {
      data = rawData.data;
    } else if (Array.isArray(res)) {
      data = res;
    }

    const rawPagination = (res as PerformanceApiResponse)?.pagination || (rawData && typeof rawData === 'object' && 'pagination' in rawData ? rawData.pagination : undefined);
    const pagination = rawPagination || {
      page,
      limit,
      total: data.length,
      totalPages: Math.max(1, Math.ceil(data.length / limit)),
      hasNextPage: false,
      hasPrevPage: page > 1,
    };

    return { data, pagination };
  },

  /**
   * GET /api/v2/performance/:id
   */
  get: async (id: string): Promise<Performance> => {
    const res = await api.get<{ data?: Performance; performance?: Performance } | Performance>(`${BASE}/${id}`);
    if (res && typeof res === 'object') {
      if ('data' in res && res.data) return res.data;
      if ('performance' in res && res.performance) return res.performance;
    }
    return res as Performance;
  },

  /**
   * POST /api/v2/performance
   * Returns the newly created performance object.
   */
  add: async (data: PerformanceCreateInput): Promise<Performance> => {
    const res = await api.post<{ data?: Performance; performance?: Performance } | Performance>(BASE, data);
    if (res && typeof res === 'object') {
      if ('data' in res && res.data) return res.data;
      if ('performance' in res && res.performance) return res.performance;
    }
    return res as Performance;
  },

  /**
   * PATCH /api/v2/performance/:id
   * Returns the updated performance object.
   */
  update: async (id: string, data: PerformanceUpdateInput): Promise<Performance> => {
    const res = await api.patch<{ data?: Performance; performance?: Performance } | Performance>(`${BASE}/${id}`, data);
    if (res && typeof res === 'object') {
      if ('data' in res && res.data) return res.data;
      if ('performance' in res && res.performance) return res.performance;
    }
    return res as Performance;
  },

  /**
   * DELETE /api/v2/performance/:id
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}`);
  },
} as const;
