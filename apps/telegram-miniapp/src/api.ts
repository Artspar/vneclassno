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
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed ${response.status}`);
  }

  return data;
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
