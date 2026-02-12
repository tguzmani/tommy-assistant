import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SliceService } from '../slice.service';
import { CompositeSliceService } from './composite-slice.service';

/**
 * Service for handling temporal behaviors of slices.
 * Runs scheduled cron jobs to apply penalties and decay.
 */
@Injectable()
export class SliceTemporalService {
  private readonly logger = new Logger(SliceTemporalService.name);

  // Caracas, Venezuela is UTC-4
  private readonly TIMEZONE_OFFSET = -4;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sliceService: SliceService,
    private readonly compositeService: CompositeSliceService,
  ) {}

  /**
   * Check scheduled slices every 15 minutes.
   * Applies penalties if slice hasn't been updated past the expected time + grace period.
   */
  @Cron('*/15 * * * *')
  async checkScheduledSlices(): Promise<void> {
    this.logger.log('Checking scheduled slices for penalties');

    const scheduledSlices =
      await this.sliceService.findByTemporalType('scheduled');

    const now = new Date();

    for (const slice of scheduledSlices) {
      try {
        await this.processScheduledSlice(slice, now);
      } catch (error) {
        this.logger.error(
          `Error processing scheduled slice ${slice.slug}:`,
          error,
        );
      }
    }
  }

  /**
   * Check continuous slices every 30 minutes.
   * Applies penalties if slice hasn't been updated within maxInterval.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkContinuousSlices(): Promise<void> {
    this.logger.log('Checking continuous slices for penalties');

    const continuousSlices =
      await this.sliceService.findByTemporalType('continuous');

    const now = new Date();

    for (const slice of continuousSlices) {
      try {
        await this.processContinuousSlice(slice, now);
      } catch (error) {
        this.logger.error(
          `Error processing continuous slice ${slice.slug}:`,
          error,
        );
      }
    }
  }

  /**
   * Apply decay to composite slices hourly.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async applyCompositeDecay(): Promise<void> {
    this.logger.log('Applying decay to composite slices');

    try {
      await this.compositeService.recalculateAllCompositeSlices();
      this.logger.log('Composite decay applied successfully');
    } catch (error) {
      this.logger.error('Error applying composite decay:', error);
    }
  }

  /**
   * Reset daily slices at midnight (Caracas time).
   */
  @Cron('0 0 * * *')
  async resetDailySlices(): Promise<void> {
    this.logger.log('Resetting daily slices');

    const dailySlices = await this.prisma.slice.findMany({
      where: { resetDaily: true },
    });

    for (const slice of dailySlices) {
      try {
        // Reset to index 0
        await this.prisma.slice.update({
          where: { id: slice.id },
          data: {
            currentIndex: 0,
            currentValue: 0,
          },
        });

        this.logger.log(`Reset daily slice: ${slice.slug}`);
      } catch (error) {
        this.logger.error(`Error resetting slice ${slice.slug}:`, error);
      }
    }
  }

  /**
   * Process a scheduled slice.
   */
  private async processScheduledSlice(slice: any, now: Date): Promise<void> {
    if (!slice.expectedTime || !slice.penaltyInterval || !slice.penaltyAmount) {
      return;
    }

    // Get last update
    const lastUpdate = slice.updates?.[0];
    const lastUpdateTime = lastUpdate ? new Date(lastUpdate.date) : null;

    // Parse expected time (format: "HH:MM")
    const [expectedHour, expectedMinute] = slice.expectedTime
      .split(':')
      .map(Number);

    // Create expected time for today (in Caracas time)
    const expectedTime = new Date(now);
    expectedTime.setHours(expectedHour, expectedMinute, 0, 0);

    // Add grace period
    const gracePeriodMs = (slice.gracePeriod || 0) * 60 * 1000;
    const deadlineTime = new Date(expectedTime.getTime() + gracePeriodMs);

    // Check if we're past the deadline
    if (now < deadlineTime) {
      return; // Not yet time for penalty
    }

    // Check if already updated today after expected time
    if (lastUpdateTime && lastUpdateTime >= expectedTime) {
      return; // Already updated today
    }

    // Calculate how many penalty intervals have passed
    const timeSinceDeadline = now.getTime() - deadlineTime.getTime();
    const penaltyIntervalMs = slice.penaltyInterval * 60 * 1000;
    const penaltyCount = Math.floor(timeSinceDeadline / penaltyIntervalMs);

    if (penaltyCount <= 0) {
      return; // Not enough time has passed for a penalty
    }

    // Check if we already applied penalties for this period
    const lastPenalty = await this.prisma.sliceUpdate.findFirst({
      where: {
        sliceId: slice.id,
        automatic: true,
        date: {
          gte: deadlineTime,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Calculate how many penalties should have been applied
    const penaltiesAlreadyApplied = lastPenalty
      ? Math.floor(
          (lastPenalty.date.getTime() - deadlineTime.getTime()) /
            penaltyIntervalMs,
        ) + 1
      : 0;

    const penaltiesToApply = penaltyCount - penaltiesAlreadyApplied;

    if (penaltiesToApply <= 0) {
      return; // All penalties already applied
    }

    // Apply penalties
    const totalPenalty = slice.penaltyAmount * penaltiesToApply;

    this.logger.log(
      `Applying ${penaltiesToApply} penalties (${totalPenalty} steps) to scheduled slice ${slice.slug}`,
    );

    await this.sliceService.updateBySteps(
      slice.id,
      totalPenalty,
      `Automatic penalty: missed ${slice.expectedTime} deadline`,
      true,
    );
  }

  /**
   * Process a continuous slice.
   */
  private async processContinuousSlice(slice: any, now: Date): Promise<void> {
    if (!slice.maxInterval || !slice.penaltyInterval || !slice.penaltyAmount) {
      return;
    }

    // Get last update
    const lastUpdate = slice.updates?.[0];

    if (!lastUpdate) {
      return; // No updates yet, can't apply penalty
    }

    const lastUpdateTime = new Date(lastUpdate.date);
    const timeSinceUpdate = now.getTime() - lastUpdateTime.getTime();
    const maxIntervalMs = slice.maxInterval * 60 * 1000;

    // Check if we're past the max interval
    if (timeSinceUpdate < maxIntervalMs) {
      return; // Still within allowed interval
    }

    // Calculate how many penalty intervals have passed since maxInterval
    const timeSinceMaxInterval = timeSinceUpdate - maxIntervalMs;
    const penaltyIntervalMs = slice.penaltyInterval * 60 * 1000;
    const penaltyCount = Math.floor(timeSinceMaxInterval / penaltyIntervalMs);

    if (penaltyCount <= 0) {
      return; // Not enough time has passed for a penalty
    }

    // Check when we last applied a penalty
    const lastPenalty = await this.prisma.sliceUpdate.findFirst({
      where: {
        sliceId: slice.id,
        automatic: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Calculate how many penalties should have been applied
    const deadlineTime = new Date(lastUpdateTime.getTime() + maxIntervalMs);
    const penaltiesAlreadyApplied = lastPenalty
      ? Math.floor(
          (lastPenalty.date.getTime() - deadlineTime.getTime()) /
            penaltyIntervalMs,
        ) + 1
      : 0;

    const penaltiesToApply = penaltyCount - penaltiesAlreadyApplied;

    if (penaltiesToApply <= 0) {
      return; // All penalties already applied
    }

    // Apply penalties
    const totalPenalty = slice.penaltyAmount * penaltiesToApply;

    this.logger.log(
      `Applying ${penaltiesToApply} penalties (${totalPenalty} steps) to continuous slice ${slice.slug}`,
    );

    await this.sliceService.updateBySteps(
      slice.id,
      totalPenalty,
      `Automatic penalty: no update for ${Math.floor(timeSinceUpdate / 1000 / 60)} minutes`,
      true,
    );
  }
}
