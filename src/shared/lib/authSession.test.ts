import { beforeEach, describe, expect, it } from 'vitest';
import { clearAuthSession } from './authSession';
import { AppError, getErrorMessage, isUnauthorizedError } from './errors';

describe('auth session contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears every persisted credential when signing out', () => {
    localStorage.setItem('yolnoma_access_token', 'access');
    localStorage.setItem('yolnoma_refresh_token', 'refresh');
    localStorage.setItem('yolnoma_session_id', 'session');
    localStorage.setItem('yolnoma_user', '{"id":"user"}');

    clearAuthSession();

    expect(localStorage.length).toBe(0);
  });

  it('classifies expired and unauthorized responses consistently', () => {
    expect(isUnauthorizedError(new AppError('expired token', { status: 401 }))).toBe(true);
    expect(isUnauthorizedError(new AppError('request failed', { status: 500 }))).toBe(false);
    expect(getErrorMessage(new Error('network failed'))).toBe('network failed');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
