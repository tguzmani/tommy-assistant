import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EventsService } from './events.service';

@Module({
  imports: [CommonModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
