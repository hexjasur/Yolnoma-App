import { api } from '@/shared/api/http';
import type { Performance, PerformanceCreateInput, PerformanceUpdateInput, PerformanceListResponse } from '@/types';

const BASE = '/api/v2/performance';

export const performanceService = {
  /**
   * GET /api/v2/performance?page=1&limit=12&search=...
   * Returns paginated performance list with metadata.
   */
  list: async (page = 1, limit = 12, search?: string): Promise<PerformanceListResponse> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search?.trim()) params.set('search', search.trim());
    const res = await api.get(`${BASE}?${params.toString()}`);

    const data: Performance[] = res?.data || (Array.isArray(res) ? res : []);
    const pagination = res?.pagination || {
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
    const res = await api.get(`${BASE}/${id}`);
    return res?.data || res;
  },

  /**
   * POST /api/v2/performance
   * Returns the newly created performance object.
   */
  add: async (data: PerformanceCreateInput): Promise<Performance> => {
    const res = await api.post(BASE, data);
    return res?.data || res;
  },

  /**
   * PATCH /api/v2/performance/:id
   * Returns the updated performance object.
   */
  update: async (id: string, data: PerformanceUpdateInput): Promise<Performance> => {
    const res = await api.patch(`${BASE}/${id}`, data);
    return res?.data || res;
  },

  /**
   * DELETE /api/v2/performance/:id
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}`);
  },
} as const;
