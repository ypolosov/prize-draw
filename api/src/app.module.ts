import { Module } from '@nestjs/common';
import { Db } from './db';
import { DrawsController } from './draws/draws.controller';
import { DrawsService } from './draws/draws.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController, DrawsController],
  providers: [Db, DrawsService],
})
export class AppModule {}
