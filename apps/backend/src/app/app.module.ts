import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';

const isTelegramEnabled = process.env.TELEGRAM_BOT_ENABLED === 'true';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    ...(isTelegramEnabled ? [TelegramModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
