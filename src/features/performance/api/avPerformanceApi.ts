import { api } from '@/shared/api/http';
import type { AvPerformance, AvPerformanceCreateInput, AvPerformanceListResponse, AvPerformanceUpdateInput } from '@/types';

const BASE = '/api/v2/av-performance';
type ApiResponse<T> = { data?: T; pagination?: AvPerformanceListResponse['pagination'] };
const unwrap = <T>(res: ApiResponse<T> | T): T => (res && typeof res === 'object' && 'data' in res && res.data !== undefined ? res.data : res as T);

export const avPerformanceService = {
  list: async (page = 1, limit = 12, search = ''): Promise<AvPerformanceListResponse> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search.trim()) params.set('search', search.trim());
    const res = await api.get<ApiResponse<AvPerformance[]> | AvPerformance[]>(`${BASE}?${params}`);
    const data = Array.isArray(unwrap(res)) ? unwrap(res) : [];
    const pagination = (res as ApiResponse<AvPerformance[]>)?.pagination ?? { page, limit, total: data.length, totalPages: 1, hasNextPage: false, hasPrevPage: page > 1 };
    return { data, pagination };
  },
  get: async (id: string) => unwrap(await api.get<ApiResponse<AvPerformance> | AvPerformance>(`${BASE}/${id}`)),
  getBySlug: async (slug: string) => unwrap(await api.get<ApiResponse<AvPerformance> | AvPerformance>(`${BASE}/slug/${encodeURIComponent(slug)}`)),
  add: async (data: AvPerformanceCreateInput) => unwrap(await api.post<ApiResponse<AvPerformance> | AvPerformance>(BASE, data)),
  update: async (id: string, data: AvPerformanceUpdateInput) => unwrap(await api.patch<ApiResponse<AvPerformance> | AvPerformance>(`${BASE}/${id}`, data)),
  delete: async (id: string) => unwrap(await api.delete<ApiResponse<AvPerformance> | AvPerformance>(`${BASE}/${id}`)),
} as const;
