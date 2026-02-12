import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { CommonModule } from '../common/common.module';
import { EventsModule } from '../events/events.module';
import { SliceModule } from '../slice/slice.module';

const isTelegramEnabled = process.env.TELEGRAM_BOT_ENABLED === 'true';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    EventsModule,
    SliceModule,
    ...(isTelegramEnabled ? [TelegramModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
