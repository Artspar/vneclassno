import { config } from './config';

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
