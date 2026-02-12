import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { OAuthTokenStorageService } from './oauth-token-storage.service';

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  created?: string;
  updated?: string;
}

const GOOGLE_CALENDAR_PROVIDER = 'google_calendar';

@Injectable()
export class GoogleCalendarApiClient implements OnModuleInit {
  private readonly logger = new Logger(GoogleCalendarApiClient.name);
  private calendar: calendar_v3.Calendar | null = null;
  private oauth2Client: OAuth2Client | null = null;

  constructor(private readonly tokenStorage: OAuthTokenStorageService) {}

  async onModuleInit() {
    await this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      const credentialsJson = process.env.GOOGLE_CALENDAR_CREDENTIALS;

      if (!credentialsJson) {
        this.logger.warn('GOOGLE_CALENDAR_CREDENTIALS not configured');
        return;
      }

      const credentials = JSON.parse(credentialsJson);
      const { client_id, client_secret, redirect_uris } = credentials.installed;

      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // Load tokens from storage
      await this.loadTokensFromStorage();

      // Set up automatic token refresh
      this.oauth2Client.on('tokens', async (tokens) => {
        this.logger.log('Tokens refreshed automatically');
        await this.saveTokens(tokens);
      });

      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      this.logger.log('Google Calendar API client initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Google Calendar client: ${error.message}`);
    }
  }

  private async loadTokensFromStorage(): Promise<void> {
    const tokenData = await this.tokenStorage.getToken(GOOGLE_CALENDAR_PROVIDER);

    if (tokenData && this.oauth2Client) {
      this.oauth2Client.setCredentials({
        access_token: tokenData.accessToken,
        refresh_token: tokenData.refreshToken,
        expiry_date: tokenData.expiresAt.getTime(),
      });

      this.logger.log('Tokens loaded from storage');
    } else {
      this.logger.warn('No tokens found in storage. Authorization required.');
    }
  }

  private async saveTokens(tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
    scope?: string;
  }): Promise<void> {
    if (!tokens.access_token) {
      return;
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    await this.tokenStorage.saveToken(GOOGLE_CALENDAR_PROVIDER, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt,
      scope: tokens.scope,
    });
  }

  async setTokensFromAuthCode(authCode: string): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(authCode);
      this.oauth2Client.setCredentials(tokens);
      await this.saveTokens(tokens);

      this.logger.log('Tokens set from authorization code');
    } catch (error) {
      this.logger.error(`Failed to exchange auth code for tokens: ${error.message}`);
      throw error;
    }
  }

  getAuthUrl(scopes: string[] = ['https://www.googleapis.com/auth/calendar.readonly']): string {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  async getEvents(options: {
    daysBack?: number;
    startDate?: Date;
    endDate?: Date;
    calendarId?: string;
  }): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      throw new Error('Google Calendar client not initialized');
    }

    const { daysBack = 7, startDate, endDate, calendarId = 'primary' } = options;

    let timeMin: Date;
    let timeMax: Date;

    if (startDate && endDate) {
      timeMin = startDate;
      timeMax = endDate;
    } else {
      timeMax = new Date();
      timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - daysBack);
    }

    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.data.items || []) as CalendarEvent[];
    } catch (error) {
      this.logger.error(`Failed to fetch calendar events: ${error.message}`);
      throw error;
    }
  }

  async getEventById(eventId: string, calendarId = 'primary'): Promise<CalendarEvent | null> {
    if (!this.calendar) {
      throw new Error('Google Calendar client not initialized');
    }

    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });

      return response.data as CalendarEvent;
    } catch (error) {
      this.logger.error(`Failed to fetch event ${eventId}: ${error.message}`);
      return null;
    }
  }

  isInitialized(): boolean {
    return this.calendar !== null;
  }
}
