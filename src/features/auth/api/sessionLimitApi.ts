import { api } from '@/shared/api/http';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SessionEntry {
  id: string;
  device: string;
  ip: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string;
}

export interface PendingDevice {
  device: string;
  ip: string;
}

export interface SessionLimitData {
  sessions: SessionEntry[];
  newDevice: PendingDevice;
  maxSessions: number;
}

// ── API helpers ─────────────────────────────────────────────────────────────
// All requests are authenticated by the temp_code, not by the standard
// Access-Token / X-Session-Id headers.  skipAuth: true prevents the HTTP
// client from attaching stale tokens from a previous session.

const BASE = '/api/v2/auth/desktop/session-limit';

/**
 * Fetch the list of existing sessions for the current user,
 * plus metadata about the pending new-device session.
 */
async function getSessions(tempCode: string): Promise<SessionLimitData> {
  const res = await api.get<{ success: boolean; data: SessionLimitData }>(
    `${BASE}/sessions`,
    {
      skipAuth: true,
      headers: { 'x-temp-code': tempCode },
    },
  );
  return res.data;
}

/**
 * Terminate an existing session by ID.
 * The temp_code is NOT consumed — the user may terminate multiple sessions.
 */
async function terminateSession(tempCode: string, sessionId: string): Promise<void> {
  await api.delete<{ success: boolean }>(
    `${BASE}/sessions/${sessionId}`,
    {
      skipAuth: true,
      headers: { 'x-temp-code': tempCode },
    },
  );
}

/**
 * Verify the session limit is now clear and finalise authentication.
 * Returns a short-lived one-time code to exchange at /desktop/exchange.
 * The code is in the JSON response body — never in a URL.
 */
async function continueAuth(tempCode: string): Promise<{ code: string }> {
  const res = await api.post<{ success: boolean; data: { code: string } }>(
    `${BASE}/continue`,
    { temp_code: tempCode },
    { skipAuth: true },
  );
  return res.data;
}

export const sessionLimitApi = {
  getSessions,
  terminateSession,
  continueAuth,
};
