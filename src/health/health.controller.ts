import {
  Controller,
  Get,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('health/live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('health/ready')
  getReadiness() {
    const readiness = this.healthService.getReadiness();

    if (readiness.status !== 'ok') {
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('health')
  getHealth() {
    const health = this.healthService.getHealth();

    if (health.status !== 'ok') {
      throw new ServiceUnavailableException(health);
    }

    return health;
  }
}
