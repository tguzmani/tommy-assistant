import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor() {
    this.logger.log('TelegramService initialized');
  }
}
