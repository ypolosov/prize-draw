import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { demoClock, now, shiftDays, shiftedDays } from './clock';

// Часы стенда демо: только при DEMO_CLOCK=on, иначе адрес не существует.
@Controller('demo/clock')
export class DemoController {
  @Get()
  get(): { now: string; days: number } {
    if (!demoClock()) throw new NotFoundException();
    return { now: now().toISOString(), days: shiftedDays() };
  }

  @Post()
  @HttpCode(200)
  set(@Body() body: Record<string, unknown>): { now: string; days: number } {
    if (!demoClock()) throw new NotFoundException();
    try {
      shiftDays(Number(body?.days));
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return { now: now().toISOString(), days: shiftedDays() };
  }
}
