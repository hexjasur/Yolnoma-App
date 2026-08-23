import { invoke } from '@tauri-apps/api/core';
import { getBackendUrl } from '@/shared/config/backend';
import { clearAuthSession } from '@/shared/lib/authSession';
import { AppError, reportError } from '@/shared/lib/errors';

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
    return (typeof body.message === 'string' && body.message)
      || (typeof body.error === 'string' && body.error)
      || (typeof body.text === 'string' && body.text)
      || 'The request could not be completed.';
  }
  return 'The request could not be completed.';
}

async function sendRequest(url: string, options: RequestOptions, headers: Record<string, string>): Promise<ProxyResponse> {
  return invoke<ProxyResponse>('proxy_request', {
    method: options.method ?? 'GET',
    url,
    headers,
    body: options.body ?? null,
  });
}

async function refreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('yolnoma_refresh_token');
  if (!refreshToken) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${refreshToken}`,
    'Content-Type': 'application/json',
  };
  const sessionId = localStorage.getItem('yolnoma_session_id');
  if (sessionId) headers['x-session-id'] = sessionId;

  try {
    const response = await sendRequest(`${getBackendUrl()}/api/v2/auth/refresh`, {
      method: 'POST',
      body: { refreshToken, refresh_token: refreshToken },
      skipAuth: true,
    }, headers);

    if (response.status !== 200 || !isApiBody(response.body)) {
      throw new AppError('Your session has expired. Please sign in again.', { status: response.status });
    }

    const body = response.body;
    const data = isApiBody(body.data) ? body.data : body;
    const user = isApiBody(data.user) ? data.user : undefined;
    const accessToken = data.accessToken ?? data.access_token ?? user?.accessToken ?? user?.access_token;
    const nextRefreshToken = data.refreshToken ?? data.refresh_token ?? user?.refreshToken ?? user?.refresh_token;

    if (typeof accessToken !== 'string' || typeof nextRefreshToken !== 'string') {
      throw new AppError('Your session has expired. Please sign in again.', { status: 401 });
    }

    localStorage.setItem('yolnoma_access_token', accessToken);
    localStorage.setItem('yolnoma_refresh_token', nextRefreshToken);
    if (user && (typeof user.id === 'string' || typeof user._id === 'string')) {
      localStorage.setItem('yolnoma_user', JSON.stringify({ ...user, id: user.id ?? user._id }));
    }
    return accessToken;
  } catch (error) {
    reportError('auth.refresh', error);
    clearAuthSession();
    window.location.hash = '#/login';
    return null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = { ...options.headers };
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['Content-Type'] ??= 'application/json';
  }

  if (!options.skipAuth) {
    const accessToken = localStorage.getItem('yolnoma_access_token');
    const sessionId = localStorage.getItem('yolnoma_session_id');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (sessionId) headers['x-session-id'] = sessionId;
  }

  const url = `${getBackendUrl()}${path}`;
  try {
    let response = await sendRequest(url, options, headers);
    if (response.status === 401 && !options.skipAuth) {
      refreshInFlight ??= refreshToken().finally(() => { refreshInFlight = null; });
      const accessToken = await refreshInFlight;
      if (!accessToken) throw new AppError('Your session has expired. Please sign in again.', { status: 401 });

      headers.Authorization = `Bearer ${accessToken}`;
      response = await sendRequest(url, options, headers);
    }

    if (response.status < 200 || response.status >= 300) {
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
