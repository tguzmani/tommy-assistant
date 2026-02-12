import { Injectable, Logger } from '@nestjs/common';
import { GoogleCalendarApiClient } from './google-calendar-api.client';
import { OAuthTokenStorageService } from './oauth-token-storage.service';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly GOOGLE_CALENDAR_PROVIDER = 'google_calendar';

  constructor(
    private readonly calendarClient: GoogleCalendarApiClient,
    private readonly tokenStorage: OAuthTokenStorageService,
  ) {}

  getAuthorizationUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
    ];

    return this.calendarClient.getAuthUrl(scopes);
  }

  async handleOAuthCallback(authCode: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.calendarClient.setTokensFromAuthCode(authCode);

      return {
        success: true,
        message: 'Successfully authorized Google Calendar access',
      };
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${error.message}`);
      return {
        success: false,
        message: `Authorization failed: ${error.message}`,
      };
    }
  }

  async checkAuthorizationStatus(): Promise<{
    authorized: boolean;
    expired?: boolean;
    expiresAt?: string;
  }> {
    const token = await this.tokenStorage.getToken(this.GOOGLE_CALENDAR_PROVIDER);

    if (!token) {
      return { authorized: false };
    }

    const isExpired = await this.tokenStorage.isTokenExpired(this.GOOGLE_CALENDAR_PROVIDER);

    return {
      authorized: true,
      expired: isExpired,
      expiresAt: token.expiresAt.toISOString(),
    };
  }

  async revokeAuthorization(): Promise<void> {
    await this.tokenStorage.deleteToken(this.GOOGLE_CALENDAR_PROVIDER);
    this.logger.log('Google Calendar authorization revoked');
  }
}
