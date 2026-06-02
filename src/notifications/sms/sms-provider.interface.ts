export interface SmsProviderResult {
  success: boolean;
  providerMessageId?: string;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface SmsProvider {
  sendSms(
    to: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<SmsProviderResult>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
