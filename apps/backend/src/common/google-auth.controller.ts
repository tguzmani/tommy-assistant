import { Controller, Get, Query, Redirect, Logger } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';

@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(private readonly authService: GoogleAuthService) {}

  @Get('authorize')
  @Redirect()
  authorize() {
    const url = this.authService.getAuthorizationUrl();
    this.logger.log('Redirecting to Google OAuth consent screen');

    return { url };
  }

  @Get('callback')
  async callback(@Query('code') code: string) {
    if (!code) {
      return {
        success: false,
        message: 'Authorization code not provided',
      };
    }

    const result = await this.authService.handleOAuthCallback(code);

    if (result.success) {
      this.logger.log('Google Calendar authorization successful');
    } else {
      this.logger.error('Google Calendar authorization failed');
    }

    return result;
  }

  @Get('status')
  async status() {
    return this.authService.checkAuthorizationStatus();
  }

  @Get('revoke')
  async revoke() {
    await this.authService.revokeAuthorization();
    return {
      success: true,
      message: 'Authorization revoked successfully',
    };
  }
}
