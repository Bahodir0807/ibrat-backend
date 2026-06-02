import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import {
  SMS_PROVIDER,
  SmsProvider,
  SmsProviderResult,
} from './sms-provider.interface';

export interface SmsSendOptions {
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
}

export type SmsServiceStatus = 'skipped' | 'dry_run' | 'sent' | 'failed';

export interface SmsServiceResult extends SmsProviderResult {
  status: SmsServiceStatus;
  normalizedPhone?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly appConfig: AppConfigService,
    @Inject(SMS_PROVIDER) private readonly provider: SmsProvider,
  ) {
    if (this.appConfig.sms.provider !== 'mock') {
      throw new Error(
        `Unsupported SMS_PROVIDER=${this.appConfig.sms.provider}. Only mock is available in this build.`,
      );
    }
  }

  async sendSms(
    to: string | undefined,
    message: string,
    options: SmsSendOptions = {},
  ): Promise<SmsServiceResult> {
    const normalizedPhone = this.normalizePhone(to);
    if (!normalizedPhone) {
      return {
        success: false,
        status: 'skipped',
        error: 'Missing phone number',
      };
    }

    const dryRun = options.dryRun ?? this.appConfig.sms.dryRun;
    if (dryRun) {
      this.logger.log(
        JSON.stringify({
          event: 'sms.dry_run',
          to: normalizedPhone,
          messageLength: message.length,
          metadata: options.metadata,
        }),
      );
      return {
        success: true,
        status: 'dry_run',
        normalizedPhone,
        rawResponse: { dryRun: true, provider: this.appConfig.sms.provider },
      };
    }

    if (!this.appConfig.sms.enabled) {
      this.logger.log(
        JSON.stringify({
          event: 'sms.skipped',
          reason: 'disabled',
          to: normalizedPhone,
          metadata: options.metadata,
        }),
      );
      return {
        success: false,
        status: 'skipped',
        normalizedPhone,
        error: 'SMS is disabled',
      };
    }

    const providerResult = await this.provider.sendSms(
      normalizedPhone,
      message,
      options.metadata,
    );

    return {
      ...providerResult,
      normalizedPhone,
      status: providerResult.success ? 'sent' : 'failed',
    };
  }

  normalizePhone(value?: string): string | undefined {
    const normalized = value?.trim().replace(/[^\d+]/g, '');
    return normalized ? normalized : undefined;
  }
}
