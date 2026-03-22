import { config } from './config';

const REQUEST_TIMEOUT_MS = 15000;

type RequestInitExt = RequestInit & {
  token?: string;
};

export async function apiRequest<T>(path: string, init?: RequestInitExt): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string } & T;

    if (!response.ok) {
      throw new Error(data.error ?? `Request failed: ${response.status}`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Сервер долго отвечает. Повторите попытку через 10-20 секунд.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
