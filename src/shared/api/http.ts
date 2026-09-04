import { invoke } from '@tauri-apps/api/core';
import { getBackendUrl } from '@/shared/config/backend';
import { clearAuthSession } from '@/shared/lib/authSession';
import { AppError, reportError } from '@/shared/lib/errors';
import { isTokenExpired } from '@/shared/lib/jwt';
import { useAuthStore } from '@/features/auth/store/authStore';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  skipAuth?: boolean;
}

interface ProxyResponse {
  status: number;
  body: unknown;
}

interface ApiBody {
  message?: string;
  error?: string;
  text?: string;
  [key: string]: unknown;
}

let refreshInFlight: Promise<string | null> | null = null;

function isApiBody(value: unknown): value is ApiBody {
  return typeof value === 'object' && value !== null;
}

function getResponseMessage(body: unknown): string {
  if (isApiBody(body)) {
    return (
      (typeof body.message === 'string' && body.message) ||
      (typeof body.error === 'string' && body.error) ||
      (typeof body.text === 'string' && body.text) ||
      'The request could not be completed.'
    );
  }
  return 'The request could not be completed.';
}

async function sendRequest(
  url: string,
  options: RequestOptions,
  headers: Record<string, string>
): Promise<ProxyResponse> {
  return invoke<ProxyResponse>('proxy_request', {
    method: options.method ?? 'GET',
    url,
    headers,
    body: options.body ?? null,
  });
}

/**
 * Refreshes the access token using the stored refresh token.
 * Manages single-flight concurrency so multiple requests wait on the same refresh call.
 */
export async function refreshToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const storedRefreshToken = localStorage.getItem('yolnoma_refresh_token');
    if (!storedRefreshToken) {
      handleAuthFailure('No refresh token available');
      return null;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${storedRefreshToken}`,
      'Content-Type': 'application/json',
    };
    const sessionId = localStorage.getItem('yolnoma_session_id');
    if (sessionId) headers['x-session-id'] = sessionId;

    try {
      const response = await sendRequest(
        `${getBackendUrl()}/api/v2/auth/refresh`,
        {
          method: 'POST',
          body: {
            refreshToken: storedRefreshToken,
            refresh_token: storedRefreshToken,
          },
          skipAuth: true,
        },
        headers
      );

      if (response.status !== 200 || !isApiBody(response.body)) {
        throw new AppError('Your session has expired. Please sign in again.', {
          status: response.status,
        });
      }

      const body = response.body;
      const data = isApiBody(body.data) ? body.data : body;
      const user = isApiBody(data.user) ? data.user : undefined;
      const accessToken =
        data.accessToken ?? data.access_token ?? user?.accessToken ?? user?.access_token;
      const nextRefreshToken =
        data.refreshToken ?? data.refresh_token ?? user?.refreshToken ?? user?.refresh_token;
      const newSessionId =
        (typeof data.sessionId === 'string' && data.sessionId) ||
        (typeof data.session_id === 'string' && data.session_id) ||
        sessionId;

      if (typeof accessToken !== 'string') {
        throw new AppError('Invalid token response from server.', { status: 401 });
      }

      // Save updated credentials
      localStorage.setItem('yolnoma_access_token', accessToken);
      if (typeof nextRefreshToken === 'string' && nextRefreshToken.trim()) {
        localStorage.setItem('yolnoma_refresh_token', nextRefreshToken);
      }
      if (newSessionId) {
        localStorage.setItem('yolnoma_session_id', newSessionId);
      }

      if (user && (typeof user.id === 'string' || typeof user._id === 'string')) {
        const formattedUser = { ...user, id: user.id ?? user._id };
        localStorage.setItem('yolnoma_user', JSON.stringify(formattedUser));
        try {
          useAuthStore.getState().setUser(formattedUser as any);
        } catch {}
      }

      return accessToken;
    } catch (error) {
      reportError('auth.refresh', error);
      handleAuthFailure('Session refresh failed');
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * Cleans up invalid credentials and transitions UI to signed-out state.
 */
function handleAuthFailure(reason: string) {
  console.warn(`[Auth] Session terminated: ${reason}`);
  clearAuthSession();
  try {
    const authState = useAuthStore.getState();
    if (authState.isAuthenticated) {
      authState.setUser(null);
      useAuthStore.setState({ isAuthenticated: false, user: null });
    }
  } catch {}
  if (window.location.hash !== '#/login') {
    window.location.hash = '#/login';
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = { ...options.headers };
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['Content-Type'] ??= 'application/json';
  }

  // 1. Proactive Token Refresh
  if (!options.skipAuth) {
    let accessToken = localStorage.getItem('yolnoma_access_token');
    const hasRefreshToken = Boolean(localStorage.getItem('yolnoma_refresh_token'));

    // If access token is expired or expiring in < 60s, refresh proactively before sending
    if (hasRefreshToken && isTokenExpired(accessToken, 60)) {
      const refreshedToken = await refreshToken();
      if (refreshedToken) {
        accessToken = refreshedToken;
      }
    }

    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const sessionId = localStorage.getItem('yolnoma_session_id');
    if (sessionId) headers['x-session-id'] = sessionId;
  }

  const url = `${getBackendUrl()}${path}`;

  try {
    let response = await sendRequest(url, options, headers);

    // 2. Reactive 401 Interceptor: If backend returns 401, refresh token and retry once
    if (response.status === 401 && !options.skipAuth) {
      const newAccessToken = await refreshToken();
      if (!newAccessToken) {
        throw new AppError('Your session has expired. Please sign in again.', { status: 401 });
      }

      headers.Authorization = `Bearer ${newAccessToken}`;
      const latestSessionId = localStorage.getItem('yolnoma_session_id');
      if (latestSessionId) {
        headers['x-session-id'] = latestSessionId;
      }

      response = await sendRequest(url, options, headers);
    }

    if (response.status < 200 || response.status >= 300) {
      throw new AppError(getResponseMessage(response.body), { status: response.status });
    }

    if (isApiBody(response.body) && response.body.success === false) {
      throw new AppError(getResponseMessage(response.body), { status: response.status });
    }

    return response.body as T;
  } catch (error) {
    reportError(`http.${options.method ?? 'GET'} ${path}`, error);
    throw error instanceof AppError
      ? error
      : new AppError('Unable to reach the service. Check your connection and try again.', { cause: error });
  }
}

export const api = {
  get: <T = any>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T = any>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body }),
  put: <T = any>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = any>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = any>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};
