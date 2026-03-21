import { Injectable } from '@nestjs/common';

interface TelegramSendMessageResponse {
  ok: boolean;
}

@Injectable()
export class TelegramBotService {
  private readonly token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  private readonly botUsername = process.env.TELEGRAM_BOT_USERNAME ?? '';
  private readonly miniAppUrl = process.env.TELEGRAM_MINIAPP_URL ?? 'http://localhost:3002';

  getInviteStartAppUrl(token: string): string | undefined {
    if (!this.botUsername) {
      return undefined;
    }

    return `https://t.me/${this.botUsername}?startapp=invite_${token}`;
  }

  getMiniAppDirectUrl(token: string): string {
    const base = this.miniAppUrl.replace(/\/$/, '');
    const url = new URL(base);
    url.searchParams.set('token', token);
    url.searchParams.set('v', '2');
    return url.toString();
  }

  async handleStart(chatId: number, payload?: string): Promise<void> {
    if (!payload || !payload.startsWith('invite_')) {
      await this.sendMessage(chatId, 'Откройте ссылку инвайта из секции, чтобы продолжить.');
      return;
    }

    const token = payload.slice('invite_'.length);
    const miniAppUrl = this.getMiniAppDirectUrl(token);

    await this.sendMessage(
      chatId,
      'Нажмите кнопку ниже, чтобы открыть мини-приложение и добавить ребенка в секцию.',
      {
        inline_keyboard: [[{ text: 'Открыть мини-приложение', web_app: { url: miniAppUrl } }]],
      },
    );
  }

  private async sendMessage(chatId: number, text: string, replyMarkup?: Record<string, unknown>): Promise<void> {
    if (!this.token) {
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as TelegramSendMessageResponse;
    if (!response.ok || !data.ok) {
      throw new Error('Failed to send Telegram message');
    }
  }
}
