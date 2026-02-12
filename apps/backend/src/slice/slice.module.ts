import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SliceService } from './slice.service';
import { SliceController } from './slice.controller';
import { SequenceFormulaService } from './formulas/sequence-formula.service';
import { CompositeSliceService } from './services/composite-slice.service';
import { SliceTemporalScheduler } from './services/schedulers/slice-temporal.scheduler';
import { ScheduledSliceScheduler } from './services/schedulers/scheduled-slice.scheduler';
import { ContinuousSliceScheduler } from './services/schedulers/continuous-slice.scheduler';
import { CompositeDecayScheduler } from './services/schedulers/composite-decay.scheduler';

/**
 * Module for the Slice Tracking System.
 * Provides services for managing slices, formulas, composite slices, and temporal behaviors.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SliceController],
  providers: [
    SliceService,
    SequenceFormulaService,
    CompositeSliceService,
    SliceTemporalScheduler,
    ScheduledSliceScheduler,
    ContinuousSliceScheduler,
    CompositeDecayScheduler,
  ],
  exports: [
    SliceService,
    SequenceFormulaService,
    CompositeSliceService,
    SliceTemporalScheduler,
  ],
})
export class SliceModule {}
