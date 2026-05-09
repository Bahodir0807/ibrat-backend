import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { RATE_LIMIT_STORE } from './rate-limit-store';
import { MemoryRateLimitStore } from './memory-rate-limit.store';
import { RedisRateLimitStore } from './redis-rate-limit.store';
import { TcpRedisRateLimitClient } from './redis-rate-limit.client';

@Global()
@Module({
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      inject: [AppConfigService],
      useFactory: async (appConfig: AppConfigService) => {
        if (appConfig.rateLimit.provider === 'redis') {
          const store = new RedisRateLimitStore(
            new TcpRedisRateLimitClient(appConfig.rateLimit.redisUrl as string),
          );
          await store.assertReady();
          return store;
        }

        return new MemoryRateLimitStore();
      },
    },
  ],
  exports: [RATE_LIMIT_STORE],
})
export class RateLimitModule {}
