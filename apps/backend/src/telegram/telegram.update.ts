import { Update, Ctx, Command, On } from 'nestjs-telegraf';
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SessionContext } from './telegram.types';
import { SliceService } from '../slice/slice.service';
import { CompositeSliceService } from '../slice/services/composite-slice.service';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly sliceService: SliceService,
    private readonly compositeService: CompositeSliceService,
  ) { }

  @Command('start')
  async handleStart(@Ctx() ctx: SessionContext) {
    await ctx.reply('Welcome to the Telegram bot! Use /help to see available commands.');
  }

  @Command('help')
  async handleHelp(@Ctx() ctx: SessionContext) {
    await ctx.reply(
      '🤖 Available Commands:\n\n' +
      '📊 Slice Tracking:\n' +
      '/status - Show all slices\n' +
      '/status <slug> - Show specific slice\n' +
      '/<slug> - Show slice status\n' +
      '/<slug> +N - Add N steps\n' +
      '/<slug> -N - Subtract N steps\n' +
      '/<slug> -N% - Decrease by N%\n' +
      '/<slug> =N - Set to value N\n' +
      '/<slug> +N [notes] - Add with notes\n\n' +
      '🧼 Composite Slices:\n' +
      '/hyg - Show hygiene status\n' +
      '/hyg teeth - Check off teeth\n' +
      '/hyg shower teeth - Check multiple\n\n' +
      '🏋️  Available Slices:\n' +
      'gym, ord, org, hea, hyd, hyg, om, gar, nut, zzz, rel\n\n' +
      'ℹ️  General:\n' +
      '/start - Welcome message\n' +
      '/help - Show this help'
    );
  }

  @Command('status')
  async handleStatus(@Ctx() ctx: SessionContext) {
    this.logger.log('📊 /status command received');
    try {
      const args = ctx.message?.['text']?.split(/\s+/).slice(1);
      const slug = args?.[0];

      if (slug) {
        await this.showSliceStatus(ctx, slug);
      } else {
        await this.showAllSlices(ctx);
      }
    } catch (error) {
      this.logger.error('Error handling /status command:', error);
      await ctx.reply('❌ Error fetching status. Please try again.');
    }
  }

  @On('text')
  async handleSliceCommand(@Ctx() ctx: SessionContext) {
    const text = ctx.message?.['text'];
    if (!text || !text.startsWith('/')) {
      return;
    }

    const parsed = this.parseCommand(text);
    if (!parsed) {
      return;
    }

    try {
      let slice;
      try {
        slice = await this.sliceService.findBySlug(parsed.slug);
      } catch (error) {
        return;
      }

      if (slice.isComposite) {
        await this.handleCompositeSlice(ctx, slice, parsed.action);
      } else {
        await this.handleRegularSlice(ctx, slice, parsed.action, parsed.notes);
      }
    } catch (error) {
      this.logger.error(`Error handling slice command: ${text}`, error);
      await ctx.reply('❌ Error processing command. Please try again.');
    }
  }

  private parseCommand(text: string): { slug: string; action?: string; notes?: string } | null {
    const match = text.match(/^\/(\w+)(?:\s+(.+))?$/);
    if (!match) return null;

    const slug = match[1];
    const rest = match[2];

    if (!rest) return { slug };

    const numericMatch = rest.match(/^([+\-=]\d+%?)(?:\s+(.+))?$/);
    if (numericMatch) {
      return { slug, action: numericMatch[1], notes: numericMatch[2] };
    }

    return { slug, action: rest };
  }

  private async handleRegularSlice(ctx: SessionContext, slice: any, action?: string, notes?: string) {
    if (!action) {
      const status = await this.sliceService.getSliceStatus(slice.slug);
      const lastUpdateText = status.lastUpdate ? this.formatTimeSince(status.lastUpdate) : 'Never';
      await ctx.reply(
        `${this.getSliceEmoji(slice.slug)} ${slice.name}\n` +
        `Value: ${status.currentValue}\n` +
        `Index: ${status.currentIndex}\n` +
        `Last: ${lastUpdateText}`
      );
      return;
    }

    let updatedSlice;
    if (action.startsWith('+') || action.startsWith('-')) {
      const isPercentage = action.endsWith('%');
      const value = parseInt(action);
      if (isPercentage) {
        updatedSlice = await this.sliceService.updateByPercentage(slice.id, value, notes);
      } else {
        updatedSlice = await this.sliceService.updateBySteps(slice.id, value, notes);
      }
    } else if (action.startsWith('=')) {
      const value = parseInt(action.substring(1));
      updatedSlice = await this.sliceService.updateToValue(slice.id, value, notes);
    } else {
      await ctx.reply('❌ Invalid action. Use +N, -N, -N%, or =N');
      return;
    }

    const updates = updatedSlice.updates || [];
    const latestUpdate = updates[0];
    if (latestUpdate) {
      const delta = latestUpdate.valueAfter - latestUpdate.valueBefore;
      const deltaSign = delta >= 0 ? '+' : '';
      await ctx.reply(
        `${this.getSliceEmoji(slice.slug)} ${slice.name}\n` +
        `Value: ${latestUpdate.valueBefore} → ${latestUpdate.valueAfter} (${deltaSign}${delta})\n` +
        `Index: ${latestUpdate.indexBefore} → ${latestUpdate.indexAfter}`
      );
    }
  }

  private async handleCompositeSlice(ctx: SessionContext, slice: any, action?: string) {
    if (!action) {
      const status = await this.sliceService.getSliceStatus(slice.slug);
      let message = `${this.getSliceEmoji(slice.slug)} ${slice.name}: ${status.currentValue}/100\n\n`;
      if (status.components) {
        for (const comp of status.components) {
          const lastCheckedText = comp.lastChecked ? this.formatTimeSince(comp.lastChecked) : 'Never';
          message += `${this.getComponentEmoji(comp.key)} ${comp.name}: ${comp.currentValue}/${comp.maxValue}  (${lastCheckedText})\n`;
        }
      }
      await ctx.reply(message);
      return;
    }

    const componentKeys = action.split(/\s+/);
    await this.compositeService.updateMultipleComponents(slice.id, componentKeys);
    const status = await this.sliceService.getSliceStatus(slice.slug);
    let message = `✅ Updated ${componentKeys.join(', ')}\n\n${this.getSliceEmoji(slice.slug)} ${slice.name}: ${status.currentValue}/100\n\n`;
    if (status.components) {
      for (const comp of status.components) {
        const lastCheckedText = comp.lastChecked ? this.formatTimeSince(comp.lastChecked) : 'Never';
        const isUpdated = componentKeys.includes(comp.key);
        const prefix = isUpdated ? '✓' : ' ';
        message += `${prefix} ${this.getComponentEmoji(comp.key)} ${comp.name}: ${comp.currentValue}/${comp.maxValue}  (${lastCheckedText})\n`;
      }
    }
    await ctx.reply(message);
  }

  private async showAllSlices(ctx: SessionContext) {
    const slices = await this.sliceService.findAll();
    if (slices.length === 0) {
      await ctx.reply('No slices found. Run /help for more info.');
      return;
    }

    let message = '📊 All Slices Status:\n\n';
    for (const slice of slices) {
      const status = await this.sliceService.getSliceStatus(slice.slug);
      const lastUpdateText = status.lastUpdate ? this.formatTimeSince(status.lastUpdate) : 'Never';
      message += `${this.getSliceEmoji(slice.slug)} ${slice.name}: ${status.currentValue}  (${lastUpdateText})\n`;
    }
    await ctx.reply(message);
  }

  private async showSliceStatus(ctx: SessionContext, slug: string) {
    try {
      const status = await this.sliceService.getSliceStatus(slug);
      let message = `${this.getSliceEmoji(slug)} ${status.name}\nValue: ${status.currentValue}\nIndex: ${status.currentIndex}\n`;
      if (status.lastUpdate) {
        message += `Last: ${this.formatTimeSince(status.lastUpdate)}\n`;
      }
      if (status.isComposite && status.components) {
        message += '\nComponents:\n';
        for (const comp of status.components) {
          const lastCheckedText = comp.lastChecked ? this.formatTimeSince(comp.lastChecked) : 'Never';
          message += `  ${this.getComponentEmoji(comp.key)} ${comp.name}: ${comp.currentValue}/${comp.maxValue}  (${lastCheckedText})\n`;
        }
      }
      await ctx.reply(message);
    } catch (error) {
      await ctx.reply(`❌ Slice "${slug}" not found.`);
    }
  }

  private getSliceEmoji(slug: string): string {
    const emojiMap: Record<string, string> = {
      gym: '🏋️', ord: '📦', org: '🗂️', hea: '❤️', hyd: '💧',
      hyg: '🧼', om: '💼', gar: '🏢', nut: '🍎', zzz: '😴', rel: '💑'
    };
    return emojiMap[slug] || '📊';
  }

  private getComponentEmoji(key: string): string {
    const emojiMap: Record<string, string> = {
      teeth: '🦷', shower: '🚿', nails: '✂️', haircut: '💇', shave: '🧔'
    };
    return emojiMap[key] || '•';
  }

  private formatTimeSince(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    else if (hours > 0) return `${hours}h ago`;
    else if (minutes > 0) return `${minutes}m ago`;
    else return 'just now';
  }
}
