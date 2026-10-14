import { Controller, Get } from '@nestjs/common';
import { Db } from './db';

@Controller('health')
export class HealthController {
  constructor(private readonly db: Db) {}

  @Get()
  async health(): Promise<{ status: 'ok' }> {
    await this.db.query('SELECT 1');
    return { status: 'ok' };
  }
}
