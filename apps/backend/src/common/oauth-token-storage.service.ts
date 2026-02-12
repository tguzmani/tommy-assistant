import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope?: string;
}

@Injectable()
export class OAuthTokenStorageService {
  private readonly logger = new Logger(OAuthTokenStorageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveToken(provider: string, tokenData: TokenData): Promise<void> {
    try {
      await this.prisma.oAuthToken.upsert({
        where: { provider },
        create: {
          provider,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: tokenData.expiresAt,
          scope: tokenData.scope,
        },
        update: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: tokenData.expiresAt,
          scope: tokenData.scope,
        },
      });

      this.logger.log(`Token saved for provider: ${provider}`);
    } catch (error) {
      this.logger.error(`Failed to save token for ${provider}: ${error.message}`);
      throw error;
    }
  }

  async getToken(provider: string): Promise<TokenData | null> {
    try {
      const token = await this.prisma.oAuthToken.findUnique({
        where: { provider },
      });

      if (!token) {
        return null;
      }

      return {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken || undefined,
        expiresAt: token.expiresAt,
        scope: token.scope || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get token for ${provider}: ${error.message}`);
      return null;
    }
  }

  async deleteToken(provider: string): Promise<void> {
    try {
      await this.prisma.oAuthToken.delete({
        where: { provider },
      });

      this.logger.log(`Token deleted for provider: ${provider}`);
    } catch (error) {
      this.logger.error(`Failed to delete token for ${provider}: ${error.message}`);
    }
  }

  async isTokenExpired(provider: string): Promise<boolean> {
    const token = await this.getToken(provider);

    if (!token) {
      return true;
    }

    // Consider token expired if it expires in less than 5 minutes
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    return new Date().getTime() + expiryBuffer >= token.expiresAt.getTime();
  }
}
