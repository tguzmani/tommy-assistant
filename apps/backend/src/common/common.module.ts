import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleCalendarApiClient } from './google-calendar-api.client';
import { OAuthTokenStorageService } from './oauth-token-storage.service';
import { GoogleAuthService } from './google-auth.service';
import { GoogleAuthController } from './google-auth.controller';

@Module({
  imports: [PrismaModule],
  controllers: [GoogleAuthController],
  providers: [GoogleCalendarApiClient, OAuthTokenStorageService, GoogleAuthService],
  exports: [GoogleCalendarApiClient, OAuthTokenStorageService, GoogleAuthService],
})
export class CommonModule {}
