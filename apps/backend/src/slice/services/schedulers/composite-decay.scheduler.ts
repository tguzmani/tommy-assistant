import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { TimeUtils } from '../../utils/time.utils';

/**
 * Handles composite slices (like Hygiene)
 * Applies decay to components based on time elapsed
 *
 * How it works:
 * 1. Every hour, check all composite slices
 * 2. For each component, calculate decay based on time since lastChecked
 * 3. Update component values
 * 4. Recalculate composite value
 */
@Injectable()
export class CompositeDecayScheduler {
  private readonly logger = new Logger(CompositeDecayScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run every hour
   * Apply decay to all composite slice components
   */
  @Cron('0 * * * *', {
    name: 'apply-composite-decay',
    timeZone: 'America/Caracas',
  })
  async applyCompositeDecay(): Promise<void> {
    if (process.env.ENABLE_COMPOSITE_DECAY === 'false') {
      return;
    }

    this.logger.log('Applying decay to composite slices...');

    try {
      const compositeSlices = await this.prisma.slice.findMany({
        where: {
          isComposite: true,
        },
        include: {
          components: true,
        },
      });

      const now = new Date();

      for (const slice of compositeSlices) {
        await this.decayCompositeSlice(slice, now);
      }

      this.logger.log(
        `Applied decay to ${compositeSlices.length} composite slices`,
      );
    } catch (error) {
      this.logger.error('Error applying composite decay:', error);
    }
  }

  /**
   * Apply decay to all components of a composite slice
   */
  private async decayCompositeSlice(slice: any, now: Date): Promise<void> {
    let hasChanges = false;

    for (const component of slice.components) {
      const decayed = await this.decayComponent(component, now);
      if (decayed) {
        hasChanges = true;
      }
    }

    // Recalculate composite value if any component changed
    if (hasChanges) {
      await this.recalculateCompositeValue(slice);

      this.logger.log(`Recalculated composite value for ${slice.slug}`);
    }
  }

  /**
   * Apply decay to a single component
   * Returns true if component value changed
   */
  private async decayComponent(component: any, now: Date): Promise<boolean> {
    if (!component.lastChecked) {
      // Never checked, no decay
      return false;
    }

    // Calculate time elapsed in appropriate units
    let periodsElapsed = 0;

    switch (component.decayType) {
      case 'hourly':
        periodsElapsed = TimeUtils.hoursElapsed(component.lastChecked, now);
        break;
      case 'daily':
        periodsElapsed = TimeUtils.daysElapsed(component.lastChecked, now);
        break;
      case 'weekly':
        periodsElapsed = TimeUtils.weeksElapsed(component.lastChecked, now);
        break;
      default:
        return false;
    }

    if (periodsElapsed < 1) {
      // Not enough time has passed for decay
      return false;
    }

    // Calculate decay amount
    const decayAmount = Math.floor(periodsElapsed * component.decayRate);

    if (decayAmount <= 0) {
      return false;
    }

    // Apply decay (but don't go below 0)
    const newValue = Math.max(0, component.currentValue - decayAmount);

    if (newValue === component.currentValue) {
      // Already at 0, no change
      return false;
    }

    // Update component
    await this.prisma.sliceComponent.update({
      where: { id: component.id },
      data: {
        currentValue: newValue,
      },
    });

    // Log the decay
    await this.prisma.sliceComponentUpdate.create({
      data: {
        componentId: component.id,
        valueBefore: component.currentValue,
        valueAfter: newValue,
        notes: `Automatic decay: -${decayAmount} (${periodsElapsed.toFixed(1)} ${component.decayType} periods)`,
      },
    });

    this.logger.debug(
      `Decayed ${component.key}: ${component.currentValue} → ${newValue} (-${decayAmount})`,
    );

    return true;
  }

  /**
   * Recalculate composite value from components
   */
  private async recalculateCompositeValue(slice: any): Promise<void> {
    const components = await this.prisma.sliceComponent.findMany({
      where: { sliceId: slice.id },
    });

    if (components.length === 0) {
      return;
    }

    let totalWeight = 0;
    let weightedSum = 0;

    for (const component of components) {
      weightedSum += component.currentValue * (component.weight / 100);
      totalWeight += component.weight;
    }

    const normalizedValue =
      totalWeight > 0 ? Math.floor((weightedSum * 100) / totalWeight) : 0;

    await this.prisma.slice.update({
      where: { id: slice.id },
      data: {
        currentValue: normalizedValue,
      },
    });
  }
}
