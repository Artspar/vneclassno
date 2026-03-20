export interface TelegramWebAppUser {
  id?: number;
}

export interface TelegramWebAppUnsafeData {
  user?: TelegramWebAppUser;
  start_param?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: TelegramWebAppUnsafeData;
  ready?: () => void;
  expand?: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export function getStartTokenFromUrl(): string | undefined {
  const url = new URL(window.location.href);
  const direct = url.searchParams.get('token');
  if (direct) {
    return direct;
  }

  const tgStart = url.searchParams.get('tgWebAppStartParam') ?? url.searchParams.get('startapp');
  if (!tgStart) {
    return undefined;
  }

  if (tgStart.startsWith('invite_')) {
    return tgStart.slice('invite_'.length);
  }

  return tgStart;
}

export function getStartTokenFromTelegram(wa: TelegramWebApp | undefined): string | undefined {
  const start = wa?.initDataUnsafe?.start_param;
  if (!start) {
    return undefined;
  }

  if (start.startsWith('invite_')) {
    return start.slice('invite_'.length);
  }

  return start;
}
