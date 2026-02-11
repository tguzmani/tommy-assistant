import { Update, Ctx, Command } from 'nestjs-telegraf';
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SessionContext } from './telegram.types';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
  ) { }

  @Command('start')
  async handleStart(@Ctx() ctx: SessionContext) {
    await ctx.reply('Welcome to the Telegram bot! Use /help to see available commands.');
  }

  @Command('help')
  async handleHelp(@Ctx() ctx: SessionContext) {
    await ctx.reply(
      'Available commands:\n' +
      '/start - Welcome message\n' +
      '/help - Show this help'
    );
  }
}
