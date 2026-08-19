import { invoke } from '@tauri-apps/api/core';
import { getBackendUrl } from '../config/apiConfig';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
}

interface ProxyResponse {
  status: number;
  body: any;
}

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

const processQueue = (err: Error | null, token: string | null = null) => {
  refreshQueue.forEach((cb) => {
    if (err) {
      cb('');
    } else if (token) {
      cb(token);
    }
  });
  refreshQueue = [];
};

async function refreshToken(): Promise<string | null> {
  const currentRefreshToken = localStorage.getItem('yolnoma_refresh_token');
  if (!currentRefreshToken) return null;

  try {
    const baseUrl = getBackendUrl();
    const res = await invoke<ProxyResponse>('proxy_request', {
      method: 'POST',
      url: `${baseUrl}/api/v2/auth/refresh`,
      headers: {
        'Authorization': `Bearer ${currentRefreshToken}`,
        'Content-Type': 'application/json',
      },
      body: null,
    });

    if (res.status !== 200) {
      throw new Error('Refresh token invalid');
    }

    const data = res.body;
    
    // Parse nested user or flat tokens, supporting snake_case and camelCase
    const newAccessToken = data.accessToken || data.access_token || data.user?.accessToken || data.user?.access_token;
    const newRefreshToken = data.refreshToken || data.refresh_token || data.user?.refreshToken || data.user?.refresh_token;
    const userData = data.user || data;

    if (newAccessToken && newRefreshToken) {
      localStorage.setItem('yolnoma_access_token', newAccessToken);
      localStorage.setItem('yolnoma_refresh_token', newRefreshToken);
      if (userData && (userData.id || userData._id)) {
        localStorage.setItem('yolnoma_user', JSON.stringify({
          ...userData,
          id: userData.id || userData._id,
        }));
      }
      return newAccessToken;
    }
    return null;
  } catch (error) {
    console.error('Token refresh error:', error);
    // Explicitly clear tokens only on critical auth rejection
    localStorage.removeItem('yolnoma_access_token');
    localStorage.removeItem('yolnoma_refresh_token');
    localStorage.removeItem('yolnoma_user');
    window.location.hash = '#/login'; // Redirect to login
    return null;
  }
}

async function request(path: string, options: RequestOptions = {}): Promise<any> {
  const baseUrl = getBackendUrl();
  const url = `${baseUrl}${path}`;
  
  const headers: Record<string, string> = {
    ...options.headers,
  };

  if (!options.skipAuth) {
    const token = localStorage.getItem('yolnoma_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Format body
  let serializedBody: any = null;
  if (options.body) {
    if (options.body instanceof FormData) {
      serializedBody = options.body;
    } else {
      headers['Content-Type'] = 'application/json';
      serializedBody = options.body;
    }
  }

  const proxyOptions = {
    method: options.method || 'GET',
    url,
    headers,
    body: serializedBody,
  };

  try {
    const response = await invoke<ProxyResponse>('proxy_request', proxyOptions);

    if (response.status === 401 && !options.skipAuth) {
      // Token expired, refresh it
      if (!isRefreshing) {
        isRefreshing = true;
        const newAccessToken = await refreshToken();
        isRefreshing = false;

        if (newAccessToken) {
          processQueue(null, newAccessToken);
          // Retry original request
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          const retryResponse = await invoke<ProxyResponse>('proxy_request', {
            ...proxyOptions,
            headers,
          });
          return handleResponse(retryResponse);
        } else {
          processQueue(new Error('Refresh failed'));
          throw new Error('Unauthorized');
        }
      } else {
        // Wait in queue
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
              invoke<ProxyResponse>('proxy_request', { ...proxyOptions, headers })
                .then(handleResponse)
                .then(resolve)
                .catch(reject);
            } else {
              reject(new Error('Unauthorized'));
            }
          });
        });
      }
    }

    return handleResponse(response);
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

function handleResponse(response: ProxyResponse): any {
  if (response.status < 200 || response.status >= 300) {
    const errorMsg = response.body?.message || response.body?.error || response.body?.text || 'Tarmoq xatosi';
    throw new Error(errorMsg);
  }
  return response.body;
}

export const api = {
  get: (path: string, options?: RequestOptions) => request(path, { ...options, method: 'GET' }),
  post: (path: string, body?: any, options?: RequestOptions) =>
    request(path, {
      ...options,
      method: 'POST',
      body,
    }),
  put: (path: string, body?: any, options?: RequestOptions) =>
    request(path, {
      ...options,
      method: 'PUT',
      body,
    }),
  delete: (path: string, options?: RequestOptions) => request(path, { ...options, method: 'DELETE' }),
};
