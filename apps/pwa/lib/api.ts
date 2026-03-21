export type InviteResponse = {
  invite: {
    token: string;
    status: 'active' | 'expired' | 'revoked';
    sectionId: string;
  };
  authRequired: boolean;
  suggestedClient?: 'telegram' | 'pwa';
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    firstName: string;
    roles: string[];
  };
};

export type MeContextResponse = {
  userId: string;
  roles: string[];
  hasLinkedPhone: boolean;
  hasLinkedTelegram: boolean;
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  sections: Array<{
    id: string;
    name: string;
  }>;
  activeChildId?: string;
  activeSectionId?: string;
};

export type PreferencesResponse = {
  activeRole?: 'super_admin' | 'section_admin' | 'coach' | 'parent';
};

export type ContextSelectionResponse = {
  activeChildId?: string;
  activeSectionId?: string;
};

export type AttendanceBoard = {
  sectionId: string;
  canManage: boolean;
  session: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: 'scheduled' | 'live' | 'completed';
  };
  items: Array<{
    childId: string;
    childName: string;
    status: 'expected' | 'present' | 'late' | 'absent';
    onLesson: boolean;
    absenceId?: string;
    absenceStatus?: 'pending' | 'approved' | 'rejected';
    isExcused?: boolean;
  }>;
};

export type CreatedInvite = {
  token: string;
  sectionId: string;
  pwaInviteUrl: string;
  telegramStartAppUrl?: string;
  telegramMiniAppUrl: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string } & T;

    if (!response.ok) {
      throw new Error(data.error ?? `Request failed: ${response.status}`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Сервер долго отвечает (возможно просыпается). Нажмите Войти еще раз через 10-20 секунд.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function resolveInvite(token: string): Promise<InviteResponse> {
  return request<InviteResponse>(`/invites/${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: {},
  });
}

export function loginPwa(phone: string, otpCode: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/pwa/login', {
    method: 'POST',
    body: JSON.stringify({ phone, otpCode }),
  });
}

export function loginTelegram(initData: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  });
}

export function createInvite(accessToken: string, sectionId: string): Promise<CreatedInvite> {
  return request<CreatedInvite>('/invites', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ sectionId }),
  });
}

export function getMeContext(accessToken: string): Promise<MeContextResponse> {
  return request<MeContextResponse>('/me/context', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

export function acceptInvite(
  token: string,
  accessToken: string,
  payload:
    | {
        childId: string;
      }
    | {
        newChild: {
          firstName: string;
          lastName: string;
          birthDate?: string;
        };
      },
): Promise<{ status: string }> {
  return request<{ status: string }>(`/invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function getAttendanceBoard(accessToken: string, sectionId: string): Promise<AttendanceBoard> {
  return request<AttendanceBoard>(`/attendance/board?sectionId=${encodeURIComponent(sectionId)}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

export function bulkUpdateAttendance(
  accessToken: string,
  payload: {
    sessionId: string;
    updates: Array<{
      childId: string;
      status: 'expected' | 'present' | 'late' | 'absent';
    }>;
  },
): Promise<AttendanceBoard> {
  return request<AttendanceBoard>('/attendance/bulk-update', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function requestAbsence(
  accessToken: string,
  payload: {
    sessionId: string;
    childId: string;
    reason?: string;
  },
) {
  return request<{ id: string; status: 'pending' | 'approved' | 'rejected' }>('/absence/request', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function decideAbsence(
  accessToken: string,
  absenceId: string,
  payload: {
    decision: 'approved' | 'rejected';
    isExcused?: boolean;
  },
) {
  return request<{ id: string; status: 'pending' | 'approved' | 'rejected' }>(`/absence/${absenceId}/decision`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function getPreferences(accessToken: string): Promise<PreferencesResponse> {
  return request<PreferencesResponse>('/me/preferences', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

export function setActiveRole(
  accessToken: string,
  activeRole: 'super_admin' | 'section_admin' | 'coach' | 'parent',
): Promise<PreferencesResponse> {
  return request<PreferencesResponse>('/me/preferences/role', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ activeRole }),
  });
}

export function getContextSelection(accessToken: string): Promise<ContextSelectionResponse> {
  return request<ContextSelectionResponse>('/me/preferences/context', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

export function setContextSelection(
  accessToken: string,
  payload: { activeChildId?: string; activeSectionId?: string },
): Promise<ContextSelectionResponse> {
  return request<ContextSelectionResponse>('/me/preferences/context', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function requestTelegramLink(accessToken: string): Promise<{ startUrl: string; token: string; expiresInSec: number }> {
  return request<{ startUrl: string; token: string; expiresInSec: number }>('/me/link/telegram/request', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}
