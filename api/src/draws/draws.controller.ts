import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { DrawsService, type DrawView } from './draws.service';

@Controller('draws')
export class DrawsController {
  constructor(private readonly draws: DrawsService) {}

  @Get()
  list(): Promise<DrawView[]> {
    return this.draws.list();
  }

  @Post()
  create(@Body() body: Record<string, unknown>): Promise<DrawView> {
    return this.draws.create(body ?? {});
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): Promise<DrawView> {
    return this.draws.get(id);
  }

  @Post(':id/entries')
  enter(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ): Promise<{ participant: string }> {
    return this.draws.enter(id, body ?? {});
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@Param('id', ParseIntPipe) id: number): Promise<DrawView> {
    return this.draws.close(id);
  }

  @Post(':id/draw')
  @HttpCode(200)
  draw(@Param('id', ParseIntPipe) id: number): Promise<DrawView> {
    return this.draws.draw(id);
  }

  @Post(':id/winners/:position/redraw')
  @HttpCode(200)
  redraw(
    @Param('id', ParseIntPipe) id: number,
    @Param('position', ParseIntPipe) position: number,
  ): Promise<DrawView> {
    return this.draws.redraw(id, position);
  }

  @Post(':id/winners/:position/confirm')
  @HttpCode(200)
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @Param('position', ParseIntPipe) position: number,
    @Body() body: Record<string, unknown>,
  ): Promise<DrawView> {
    return this.draws.confirm(id, position, body ?? {});
  }
}
