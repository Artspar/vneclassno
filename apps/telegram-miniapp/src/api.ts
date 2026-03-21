export type InviteResponse = {
  invite: {
    token: string;
    status: 'active' | 'expired' | 'revoked';
    sectionId: string;
  };
  authRequired: boolean;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    firstName: string;
  };
};

export type MeContext = {
  userId: string;
  roles: string[];
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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
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
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? `Request failed ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Сервер долго отвечает. Повторите вход через 10-20 секунд.');
    }
    if (error instanceof TypeError) {
      throw new Error('Нет соединения с сервером. Проверьте интернет и откройте мини-приложение снова.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function loginTelegram(initData: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  });
}

export function resolveInvite(token: string): Promise<InviteResponse> {
  return request<InviteResponse>(`/invites/${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: {},
  });
}

export function meContext(accessToken: string): Promise<MeContext> {
  return request<MeContext>('/me/context', {
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

export function confirmPhoneLink(accessToken: string, phone: string, otpCode: string): Promise<{ ok: true }> {
  return request<{ ok: true }>('/me/link/phone/confirm', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ phone, otpCode }),
  });
}
