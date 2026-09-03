export type UserRole = 'owner' | 'admin' | 'tester' | 'user';

export interface UserItem {
  id: string;
  email: string | null;
  name?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  thumbnailUrl?: string | null;
  isPrivate?: boolean;
  role: UserRole;
  createdAt?: string;
  lastSignInAt?: string;
}

export interface UserUpdatePayload {
  displayName?: string | null;
  email?: string;
  role?: UserRole;
  isPrivate?: boolean;
}

export interface UsersResponse {
  users?: UserItem[];
  data?: UserItem[];
}
