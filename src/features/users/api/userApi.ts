import { api } from '@/shared/api/http';
import type { UserItem, UserUpdatePayload, UsersResponse } from '../types/user';

const BASE = '/api/v2/users';

export const userApi = {
  /**
   * List all users
   */
  list: async (): Promise<UserItem[]> => {
    const res = await api.get<UsersResponse | UserItem[] | { data: { users: UserItem[] } }>(BASE);
    if (Array.isArray(res)) return res;
    if ('data' in res && res.data && 'users' in res.data && Array.isArray(res.data.users)) {
      return res.data.users;
    }
    if ('users' in res && Array.isArray(res.users)) {
      return res.users;
    }
    if ('data' in res && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  },

  /**
   * Update user details (displayName, email, role, isPrivate)
   */
  update: async (userId: string, payload: UserUpdatePayload): Promise<UserItem> => {
    const res = await api.patch<{ user?: UserItem; data?: { user?: UserItem } }>(`${BASE}/${userId}`, payload);
    const updated = res?.data?.user || res?.user;
    if (!updated) {
      throw new Error('User update failed: Invalid response from server');
    }
    return updated;
  },

  /**
   * Delete a user by ID
   */
  delete: async (userId: string): Promise<void> => {
    await api.delete(`${BASE}/${userId}`);
  },
};
