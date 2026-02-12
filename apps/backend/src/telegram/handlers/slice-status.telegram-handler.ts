import { Injectable, Logger } from '@nestjs/common';
import { Command, Ctx, Update } from 'nestjs-telegraf';
import { SliceService } from '../../slice/slice.service';
import { SessionContext } from '../telegram.types';

/**
 * Handler for /status command to show all slices.
 */
@Update()
@Injectable()
export class SliceStatusTelegramHandler {
  private readonly logger = new Logger(SliceStatusTelegramHandler.name);

  constructor(private readonly sliceService: SliceService) {}

  @Command('status')
  async handleStatus(@Ctx() ctx: SessionContext) {
    this.logger.log('📊 /status command received');
    try {
      const args = ctx.message?.['text']?.split(/\s+/).slice(1);
      const slug = args?.[0];

      this.logger.log(`Args: ${JSON.stringify(args)}, slug: ${slug}`);

      if (slug) {
        // Show specific slice status
        await this.showSliceStatus(ctx, slug);
      } else {
        // Show all slices
        await this.showAllSlices(ctx);
      }
    } catch (error) {
      this.logger.error('Error handling /status command:', error);
      await ctx.reply('❌ Error fetching status. Please try again.');
    }
  }

  /**
   * Show status of a specific slice.
   */
  private async showSliceStatus(ctx: SessionContext, slug: string) {
    try {
      const status = await this.sliceService.getSliceStatus(slug);

      let message = `${this.getSliceEmoji(slug)} ${status.name}\n`;
      message += `Value: ${status.currentValue}\n`;
      message += `Index: ${status.currentIndex}\n`;

      if (status.lastUpdate) {
        message += `Last: ${this.formatTimeSince(status.lastUpdate)}\n`;
      }

      if (status.isComposite && status.components) {
        message += '\nComponents:\n';
        for (const comp of status.components) {
          const lastCheckedText = comp.lastChecked
            ? this.formatTimeSince(comp.lastChecked)
            : 'Never';

          message += `  ${this.getComponentEmoji(comp.key)} ${comp.name}: ${comp.currentValue}/${comp.maxValue}  (${lastCheckedText})\n`;
        }
      }

      await ctx.reply(message);
    } catch (error) {
      await ctx.reply(`❌ Slice "${slug}" not found.`);
    }
  }

  /**
   * Show status of all slices.
   */
  private async showAllSlices(ctx: SessionContext) {
    const slices = await this.sliceService.findAll();

    if (slices.length === 0) {
      await ctx.reply('No slices found. Run /help for more info.');
      return;
    }

    let message = '📊 All Slices Status:\n\n';

    for (const slice of slices) {
      const status = await this.sliceService.getSliceStatus(slice.slug);
      const lastUpdateText = status.lastUpdate
        ? this.formatTimeSince(status.lastUpdate)
        : 'Never';

      message += `${this.getSliceEmoji(slice.slug)} ${slice.name}: ${status.currentValue}  (${lastUpdateText})\n`;
    }

    await ctx.reply(message);
  }

  /**
   * Get emoji for a slice.
   */
  private getSliceEmoji(slug: string): string {
    const emojiMap: Record<string, string> = {
      gym: '🏋️',
      ord: '📦',
      org: '🗂️',
      hea: '❤️',
      hyd: '💧',
      hyg: '🧼',
      om: '💼',
      gar: '🏢',
      nut: '🍎',
      zzz: '😴',
      rel: '💑',
    };
    return emojiMap[slug] || '📊';
  }

  /**
   * Get emoji for a component.
   */
  private getComponentEmoji(key: string): string {
    const emojiMap: Record<string, string> = {
      teeth: '🦷',
      shower: '🚿',
      nails: '✂️',
      haircut: '💇',
      shave: '🧔',
    };
    return emojiMap[key] || '•';
  }

  /**
   * Format time since a date.
   */
  private formatTimeSince(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'just now';
    }
  }
}
