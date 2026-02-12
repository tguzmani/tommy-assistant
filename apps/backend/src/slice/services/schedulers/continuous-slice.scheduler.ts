import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { SliceService } from '../../slice.service';
import { TimeUtils } from '../../utils/time.utils';

/**
 * Handles slices with temporalType = 'continuous'
 * Example: Hydration (should drink every 2 hours)
 *
 * How it works:
 * 1. Every 15 minutes, check all continuous slices
 * 2. For each slice, check time since last update
 * 3. If time > maxInterval, apply penalties based on how much over
 */
@Injectable()
export class ContinuousSliceScheduler {
  private readonly logger = new Logger(ContinuousSliceScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sliceService: SliceService,
  ) {}

  /**
   * Run every 15 minutes
   * Check continuous slices and apply penalties if too much time has passed
   */
  @Cron('*/15 * * * *', {
    name: 'check-continuous-slices',
    timeZone: 'America/Caracas',
  })
  async checkContinuousSlices(): Promise<void> {
    if (process.env.ENABLE_CONTINUOUS_SLICES === 'false') {
      return;
    }

    this.logger.log('Checking continuous slices for penalties...');

    try {
      const continuousSlices = await this.prisma.slice.findMany({
        where: {
          temporalType: 'continuous',
        },
        include: {
          updates: {
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
      });

      const now = new Date();

      for (const slice of continuousSlices) {
        await this.evaluateContinuousSlice(slice, now);
      }

      this.logger.log(`Checked ${continuousSlices.length} continuous slices`);
    } catch (error) {
      this.logger.error('Error checking continuous slices:', error);
    }
  }

  /**
   * Evaluate a single continuous slice
   */
  private async evaluateContinuousSlice(
    slice: any,
    now: Date,
  ): Promise<void> {
    // Get last update
    if (!slice.updates || slice.updates.length === 0) {
      // No updates yet, can't penalize
      return;
    }

    const lastUpdate = slice.updates[0];
    const minutesSinceUpdate = TimeUtils.minutesElapsed(lastUpdate.date, now);

    // Check if exceeded maxInterval
    if (minutesSinceUpdate <= slice.maxInterval) {
      // Still within allowed time
      return;
    }

    // Calculate how many penalty periods have passed
    const excessMinutes = minutesSinceUpdate - slice.maxInterval;
    const penaltiesDue = Math.floor(excessMinutes / slice.penaltyInterval);

    if (penaltiesDue <= 0) {
      return;
    }

    // Check how many automatic penalties already applied since last update
    const automaticPenaltiesSinceUpdate = await this.prisma.sliceUpdate.count({
      where: {
        sliceId: slice.id,
        automatic: true,
        date: {
          gt: lastUpdate.date,
        },
      },
    });

    // Only apply penalties we haven't applied yet
    const penaltiesToApply = Math.max(
      0,
      penaltiesDue - automaticPenaltiesSinceUpdate,
    );

    if (penaltiesToApply > 0) {
      const totalDelta = penaltiesToApply * slice.penaltyAmount;

      await this.sliceService.updateBySteps(
        slice.id,
        totalDelta,
        `Continuous penalty: ${penaltiesToApply}x ${slice.penaltyAmount} (${Math.floor(minutesSinceUpdate / 60)}h since last update)`,
        true,
      );

      this.logger.log(
        `Applied ${penaltiesToApply} penalties to ${slice.slug} (${totalDelta} total delta)`,
      );
    }
  }
}
