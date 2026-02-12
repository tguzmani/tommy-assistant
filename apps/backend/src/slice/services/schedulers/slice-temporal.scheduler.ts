import { Injectable, Logger } from '@nestjs/common';
import { ScheduledSliceScheduler } from './scheduled-slice.scheduler';
import { ContinuousSliceScheduler } from './continuous-slice.scheduler';
import { CompositeDecayScheduler } from './composite-decay.scheduler';

/**
 * Main orchestrator for all temporal behaviors
 * Aggregates all scheduler services
 */
@Injectable()
export class SliceTemporalScheduler {
  private readonly logger = new Logger(SliceTemporalScheduler.name);

  constructor(
    private readonly scheduledSliceScheduler: ScheduledSliceScheduler,
    private readonly continuousSliceScheduler: ContinuousSliceScheduler,
    private readonly compositeDecayScheduler: CompositeDecayScheduler,
  ) {}

  /**
   * Manual trigger for all checks (useful for testing)
   */
  async runAllChecks(): Promise<void> {
    this.logger.log('Running all temporal checks manually...');

    await Promise.all([
      this.scheduledSliceScheduler.checkScheduledSlices(),
      this.continuousSliceScheduler.checkContinuousSlices(),
      this.compositeDecayScheduler.applyCompositeDecay(),
    ]);

    this.logger.log('All temporal checks completed');
  }

  /**
   * Get summary of next scheduled runs
   */
  getScheduleSummary(): any {
    return {
      scheduledSlices: {
        cron: '*/15 * * * *',
        description: 'Check scheduled slices every 15 minutes',
        timezone: 'America/Caracas',
      },
      continuousSlices: {
        cron: '*/15 * * * *',
        description: 'Check continuous slices every 15 minutes',
        timezone: 'America/Caracas',
      },
      compositeDecay: {
        cron: '0 * * * *',
        description: 'Apply component decay every hour',
        timezone: 'America/Caracas',
      },
    };
  }
}
