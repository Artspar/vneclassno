import { Body, Controller, Post } from '@nestjs/common';
import { AccountLinkService } from '../linking/account-link-service.js';
import { TelegramBotService } from '../telegram/telegram-bot.service.js';

type TelegramUpdate = {
  message?: {
    text?: string;
    from?: {
      id?: number;
    };
    chat?: {
      id?: number;
    };
  };
};

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly accountLinkService: AccountLinkService,
  ) {}

  @Post('webhook')
  async webhook(@Body() update: TelegramUpdate): Promise<{ ok: true }> {
    const text = update.message?.text ?? '';
    const chatId = update.message?.chat?.id;
    const fromId = update.message?.from?.id;

    if (typeof chatId === 'number' && text.startsWith('/start')) {
      const payload = text.split(' ').slice(1).join(' ').trim() || undefined;

      if (payload?.startsWith('link_') && typeof fromId === 'number') {
        const linkToken = payload.slice('link_'.length);
        try {
          await this.accountLinkService.consumeTelegramLink(linkToken, String(fromId));
          await this.telegramBotService.sendInfo(chatId, 'Готово. Telegram успешно привязан к вашему аккаунту.');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Не удалось завершить привязку.';
          await this.telegramBotService.sendInfo(chatId, `Ошибка привязки: ${message}`);
        }

        return { ok: true };
      }

      await this.telegramBotService.handleStart(chatId, payload);
    }

    return { ok: true };
  }
}
