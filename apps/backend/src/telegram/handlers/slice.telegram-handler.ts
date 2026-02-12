import { Injectable, Logger } from '@nestjs/common';
import { Ctx, On, Update } from 'nestjs-telegraf';
import { SliceService } from '../../slice/slice.service';
import { CompositeSliceService } from '../../slice/services/composite-slice.service';
import { SessionContext } from '../telegram.types';

/**
 * Telegram handler for slice commands.
 * Handles commands like /gym +1, /rel -90%, /hyg teeth, etc.
 */
@Update()
@Injectable()
export class SliceTelegramHandler {
  private readonly logger = new Logger(SliceTelegramHandler.name);

  constructor(
    private readonly sliceService: SliceService,
    private readonly compositeService: CompositeSliceService,
  ) {}

  /**
   * Parse command text to extract slice slug, action, and notes.
   * Examples:
   * - "/gym +1" → { slug: 'gym', action: '+1', notes: undefined }
   * - "/rel -90%" → { slug: 'rel', action: '-90%', notes: undefined }
   * - "/gym +1 Leg day" → { slug: 'gym', action: '+1', notes: 'Leg day' }
   * - "/hyg teeth shower" → { slug: 'hyg', action: 'teeth shower', notes: undefined }
   */
  private parseCommand(text: string): {
    slug: string;
    action?: string;
    notes?: string;
  } | null {
    const match = text.match(/^\/(\w+)(?:\s+(.+))?$/);
    if (!match) {
      return null;
    }

    const slug = match[1];
    const rest = match[2];

    if (!rest) {
      // Just the command, no action (e.g., "/gym")
      return { slug };
    }

    // Check if it starts with +, -, or = (numeric update)
    const numericMatch = rest.match(/^([+\-=]\d+%?)(?:\s+(.+))?$/);
    if (numericMatch) {
      return {
        slug,
        action: numericMatch[1],
        notes: numericMatch[2],
      };
    }

    // Otherwise, treat the whole rest as action (for composite slices)
    return { slug, action: rest };
  }

  /**
   * Handle slice commands.
   * This catches all commands that aren't handled by other handlers.
   */
  @On('text')
  async handleSliceCommand(@Ctx() ctx: SessionContext) {
    const text = ctx.message?.['text'];
    if (!text || !text.startsWith('/')) {
      return; // Not a command
    }

    const parsed = this.parseCommand(text);
    if (!parsed) {
      return; // Invalid command format
    }

    try {
      // Try to find the slice
      let slice;
      try {
        slice = await this.sliceService.findBySlug(parsed.slug);
      } catch (error) {
        // Slice not found - ignore (might be a different command)
        return;
      }

      // Handle composite slices differently
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

  /**
   * Handle regular (non-composite) slice updates.
   */
  private async handleRegularSlice(
    ctx: SessionContext,
    slice: any,
    action?: string,
    notes?: string,
  ) {
    // If no action, show status
    if (!action) {
      const status = await this.sliceService.getSliceStatus(slice.slug);
      const lastUpdateText = status.lastUpdate
        ? this.formatTimeSince(status.lastUpdate)
        : 'Never';

      await ctx.reply(
        `${this.getSliceEmoji(slice.slug)} ${slice.name}\n` +
          `Value: ${status.currentValue}\n` +
          `Index: ${status.currentIndex}\n` +
          `Last: ${lastUpdateText}`,
      );
      return;
    }

    // Parse action
    let updatedSlice;

    if (action.startsWith('+') || action.startsWith('-')) {
      // Steps or percentage
      const isPercentage = action.endsWith('%');
      const value = parseInt(action);

      if (isPercentage) {
        updatedSlice = await this.sliceService.updateByPercentage(
          slice.id,
          value,
          notes,
        );
      } else {
        updatedSlice = await this.sliceService.updateBySteps(
          slice.id,
          value,
          notes,
        );
      }
    } else if (action.startsWith('=')) {
      // Absolute value
      const value = parseInt(action.substring(1));
      updatedSlice = await this.sliceService.updateToValue(
        slice.id,
        value,
        notes,
      );
    } else {
      await ctx.reply('❌ Invalid action. Use +N, -N, -N%, or =N');
      return;
    }

    // Get the latest update to show the change
    const updates = updatedSlice.updates || [];
    const latestUpdate = updates[0];

    if (latestUpdate) {
      const delta = latestUpdate.valueAfter - latestUpdate.valueBefore;
      const deltaSign = delta >= 0 ? '+' : '';

      await ctx.reply(
        `${this.getSliceEmoji(slice.slug)} ${slice.name}\n` +
          `Value: ${latestUpdate.valueBefore} → ${latestUpdate.valueAfter} (${deltaSign}${delta})\n` +
          `Index: ${latestUpdate.indexBefore} → ${latestUpdate.indexAfter}`,
      );
    } else {
      await ctx.reply(`✅ ${slice.name} updated!`);
    }
  }

  /**
   * Handle composite slice updates.
   */
  private async handleCompositeSlice(
    ctx: SessionContext,
    slice: any,
    action?: string,
  ) {
    const sliceWithComponents = await this.sliceService.findOne(slice.id);

    // If no action, show status
    if (!action) {
      const status = await this.sliceService.getSliceStatus(slice.slug);

      let message = `${this.getSliceEmoji(slice.slug)} ${slice.name}: ${status.currentValue}/100\n\n`;

      if (status.components) {
        for (const comp of status.components) {
          const lastCheckedText = comp.lastChecked
            ? this.formatTimeSince(comp.lastChecked)
            : 'Never';

          message += `${this.getComponentEmoji(comp.key)} ${comp.name}: ${comp.currentValue}/${comp.maxValue}  (${lastCheckedText})\n`;
        }
      }

      await ctx.reply(message);
      return;
    }

    // Parse component keys from action
    const componentKeys = action.split(/\s+/);

    // Update components
    const updatedSlice = await this.compositeService.updateMultipleComponents(
      slice.id,
      componentKeys,
    );

    // Show updated status
    const status = await this.sliceService.getSliceStatus(slice.slug);

    let message = `✅ Updated ${componentKeys.join(', ')}\n\n`;
    message += `${this.getSliceEmoji(slice.slug)} ${slice.name}: ${status.currentValue}/100\n\n`;

    if (status.components) {
      for (const comp of status.components) {
        const lastCheckedText = comp.lastChecked
          ? this.formatTimeSince(comp.lastChecked)
          : 'Never';

        const isUpdated = componentKeys.includes(comp.key);
        const prefix = isUpdated ? '✓' : ' ';

        message += `${prefix} ${this.getComponentEmoji(comp.key)} ${comp.name}: ${comp.currentValue}/${comp.maxValue}  (${lastCheckedText})\n`;
      }
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
