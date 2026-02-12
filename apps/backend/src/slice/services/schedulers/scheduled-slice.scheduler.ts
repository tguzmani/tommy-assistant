import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { SliceService } from '../../slice.service';
import { TimeUtils } from '../../utils/time.utils';

/**
 * Handles slices with temporalType = 'scheduled'
 * Example: Nutrition at 9:00 AM, Sleep at 11:00 PM
 *
 * How it works:
 * 1. Every 15 minutes, check all scheduled slices
 * 2. For each slice, check if user has reported today
 * 3. If not reported and past (expectedTime + gracePeriod), apply penalties
 * 4. Penalties accumulate based on penaltyInterval
 */
@Injectable()
export class ScheduledSliceScheduler {
  private readonly logger = new Logger(ScheduledSliceScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sliceService: SliceService,
  ) {}

  /**
   * Run every 15 minutes
   * Check all scheduled slices and apply penalties if needed
   */
  @Cron('*/15 * * * *', {
    name: 'check-scheduled-slices',
    timeZone: 'America/Caracas',
  })
  async checkScheduledSlices(): Promise<void> {
    if (process.env.ENABLE_SCHEDULED_SLICES === 'false') {
      return;
    }

    this.logger.log('Checking scheduled slices for penalties...');

    try {
      // Get all slices with temporalType = 'scheduled'
      const scheduledSlices = await this.prisma.slice.findMany({
        where: {
          temporalType: 'scheduled',
        },
        include: {
          updates: {
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
      });

      const now = new Date();
      const today = TimeUtils.getStartOfDay(now);

      for (const slice of scheduledSlices) {
        await this.evaluateScheduledSlice(slice, now, today);
      }

      this.logger.log(`Checked ${scheduledSlices.length} scheduled slices`);
    } catch (error) {
      this.logger.error('Error checking scheduled slices:', error);
    }
  }

  /**
   * Evaluate a single scheduled slice
   */
  private async evaluateScheduledSlice(
    slice: any,
    now: Date,
    today: Date,
  ): Promise<void> {
    // Check if user already reported TODAY
    const hasReportedToday =
      slice.updates.length > 0 &&
      !slice.updates[0].automatic &&
      TimeUtils.isSameDay(slice.updates[0].date, now);

    if (hasReportedToday) {
      // User already reported, no penalty needed
      return;
    }

    // Check if we're past the expected time + grace period
    const { isPast, minutesLate } = TimeUtils.isPastScheduledTime(
      slice.expectedTime,
      slice.gracePeriod || 0,
    );

    if (!isPast) {
      // Not yet time to penalize
      return;
    }

    // Calculate how many penalties are due
    const penaltiesDue = Math.floor(minutesLate / slice.penaltyInterval);

    if (penaltiesDue <= 0) {
      return;
    }

    // Check if we've already applied penalties today
    const automaticUpdatesToday = await this.prisma.sliceUpdate.count({
      where: {
        sliceId: slice.id,
        automatic: true,
        date: {
          gte: today,
        },
      },
    });

    // Only apply penalties we haven't applied yet
    const penaltiesToApply = Math.max(0, penaltiesDue - automaticUpdatesToday);

    if (penaltiesToApply > 0) {
      const totalDelta = penaltiesToApply * slice.penaltyAmount;

      await this.applyAutomaticPenalty(
        slice,
        totalDelta,
        `Scheduled penalty: ${penaltiesToApply}x ${slice.penaltyAmount} (${minutesLate} min late)`,
      );

      this.logger.log(
        `Applied ${penaltiesToApply} penalties to ${slice.slug} (${totalDelta} total delta)`,
      );
    }
  }

  /**
   * Apply automatic penalty to a slice
   */
  private async applyAutomaticPenalty(
    slice: any,
    delta: number,
    notes: string,
  ): Promise<void> {
    await this.sliceService.updateBySteps(slice.id, delta, notes, true);
  }
}
