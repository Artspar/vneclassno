import { Body, Controller, Post } from '@nestjs/common';
import { TelegramBotService } from '../telegram/telegram-bot.service.js';

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: {
      id?: number;
    };
  };
};

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  @Post('webhook')
  async webhook(@Body() update: TelegramUpdate): Promise<{ ok: true }> {
    const text = update.message?.text ?? '';
    const chatId = update.message?.chat?.id;

    if (typeof chatId === 'number' && text.startsWith('/start')) {
      const payload = text.split(' ').slice(1).join(' ').trim() || undefined;
      await this.telegramBotService.handleStart(chatId, payload);
    }

    return { ok: true };
  }
}
