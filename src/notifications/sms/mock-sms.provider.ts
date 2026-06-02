import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SmsProviderResult } from './sms-provider.interface';

@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendSms(
    to: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<SmsProviderResult> {
    const providerMessageId = `mock-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    this.logger.log(
      JSON.stringify({
        event: 'sms.mock.sent',
        to,
        messageLength: message.length,
        metadata,
        providerMessageId,
      }),
    );

    return {
      success: true,
      providerMessageId,
      rawResponse: { provider: 'mock', dryRun: false },
    };
  }
}
