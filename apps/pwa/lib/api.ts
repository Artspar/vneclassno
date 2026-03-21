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
    participationStatus?: 'confirmed' | 'declined';
    onLesson: boolean;
    absenceId?: string;
    absenceStatus?: 'pending' | 'approved' | 'rejected';
    isExcused?: boolean;
  }>;
};

export type NotificationFeedResponse = {
  items: Array<{
    id: string;
    sectionId: string;
    type: 'training' | 'game' | 'event';
    title: string;
    message: string;
    targetMode: 'all' | 'selected';
    childIds: string[];
    matchedChildIds?: string[];
    createdAt: string;
    channels: Array<'telegram' | 'pwa'>;
  }>;
};

export type PaymentOptionsResponse = {
  items: Array<{
    childId: string;
    childName: string;
    sectionId: string;
    sessionId: string;
    sessionTitle: string;
    dueAt: string;
    participationStatus: 'confirmed' | 'declined' | 'not_confirmed';
    duePassed: boolean;
    canPayNow: boolean;
    canPayEarly: boolean;
    lockedReason?: string;
    recommendedMethod: 'auto_link' | 'auto_qr' | 'manual_transfer';
  }>;
  rule: {
    description: string;
  };
};


export type OtpChannel = 'sms' | 'telegram' | 'vk';

export type OtpRequestResponse = {
  requestId: string;
  channel: OtpChannel;
  expiresInSec: number;
  destinationMasked: string;
  debugCode?: string;
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

export function requestPwaOtp(phone: string, channel: OtpChannel): Promise<OtpRequestResponse> {
  return request<OtpRequestResponse>('/auth/pwa/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, channel }),
  });
}

export function loginPwa(phone: string, otpCode: string, otpRequestId?: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/pwa/login', {
    method: 'POST',
    body: JSON.stringify({ phone, otpCode, otpRequestId }),
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


export function confirmParticipation(
  accessToken: string,
  payload: { sessionId: string; childId: string; decision: 'confirmed' | 'declined' },
): Promise<AttendanceBoard> {
  return request<AttendanceBoard>('/sessions/participation/confirm', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}


export function getNotifications(
  accessToken: string,
  query?: { sectionId?: string; childId?: string },
): Promise<NotificationFeedResponse> {
  const params = new URLSearchParams();
  if (query?.sectionId) {
    params.set('sectionId', query.sectionId);
  }
  if (query?.childId) {
    params.set('childId', query.childId);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request<NotificationFeedResponse>(`/notifications${suffix}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}


export function createNotification(
  accessToken: string,
  payload: {
    sectionId: string;
    type: 'training' | 'game' | 'event';
    title: string;
    message: string;
    targetMode: 'all' | 'selected';
    childIds?: string[];
  },
): Promise<{ id: string; recipientsCount: number }> {
  return request<{ id: string; recipientsCount: number }>('/notifications', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}


export function getPaymentOptions(
  accessToken: string,
  query?: { sectionId?: string; childId?: string },
): Promise<PaymentOptionsResponse> {
  const params = new URLSearchParams();
  if (query?.sectionId) {
    params.set('sectionId', query.sectionId);
  }
  if (query?.childId) {
    params.set('childId', query.childId);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request<PaymentOptionsResponse>(`/payments/options${suffix}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}
