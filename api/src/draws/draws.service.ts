// Розыгрыши, заявки, выбор и подтверждение призов. Правила - в domain/rules.ts; здесь - их
// применение к базе и ответы API.

import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as clock from '../clock';
import { Db } from '../db';
import {
  checkConfirm,
  checkEntry,
  checkRedraw,
  checkTitle,
  confirmDeadline,
  pickReplacement,
  pickWinners,
  RuleViolation,
  seedHash,
} from '../domain/rules';

interface DrawRow {
  id: number;
  title: string;
  prizes: number;
  opens_at: Date;
  closes_at: Date;
  seed: string;
  seed_hash: string;
  drawn_at: Date | null;
}

interface WinnerRow {
  position: number;
  participant: string;
  selection: number;
  selected_at: Date | null;
  confirmed_at: Date | null;
  replaced_at: Date | null;
}

export interface WinnerView {
  selection: number;
  position: number;
  participant: string;
  status: 'pending' | 'confirmed' | 'unclaimed';
  confirmBy: string;
}

export interface DrawView {
  id: number;
  title: string;
  prizes: number;
  opensAt: string;
  closesAt: string;
  seedHash: string;
  entries: number;
  // После выбора победителей: зерно и список участников - чтобы любой пересчитал итог (R4).
  seed?: string;
  drawnAt?: string;
  participants?: string[];
  winners: WinnerView[];
  selectionHistory?: WinnerView[];
}

const rule = (e: unknown): never => {
  if (e instanceof RuleViolation) throw new UnprocessableEntityException({ rule: e.rule, message: e.message });
  throw e;
};

const text = (v: unknown, name: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw new BadRequestException(`${name}: строка до ${max} символов`);
  return v.trim();
};

const date = (v: unknown, name: string, fallback: Date): Date => {
  if (v === undefined) return fallback;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${name}: дата ISO 8601`);
  return d;
};

@Injectable()
export class DrawsService {
  constructor(private readonly db: Db) {}

  private async row(id: number): Promise<DrawRow> {
    const [d] = await this.db.query<DrawRow>('SELECT * FROM draws WHERE id = $1', [id]);
    if (!d) throw new NotFoundException(`розыгрыш ${id} не найден`);
    return d;
  }

  private async view(d: DrawRow, now = clock.now()): Promise<DrawView> {
    const [count] = await this.db.query<{ n: number }>('SELECT count(*)::int AS n FROM entries WHERE draw_id = $1', [
      d.id,
    ]);
    const v: DrawView = {
      id: d.id,
      title: d.title,
      prizes: d.prizes,
      opensAt: d.opens_at.toISOString(),
      closesAt: d.closes_at.toISOString(),
      seedHash: d.seed_hash,
      entries: count?.n ?? 0,
      winners: [],
    };
    if (!d.drawn_at) return v;
    const winners = await this.db.query<WinnerRow>('SELECT * FROM winners WHERE draw_id = $1 ORDER BY selection', [
      d.id,
    ]);
    const history: WinnerView[] = winners.map((w) => {
      const deadline = confirmDeadline(w.selected_at ?? (d.drawn_at as Date));
      return {
        position: w.position,
        participant: w.participant,
        selection: w.selection,
        status: w.replaced_at ? 'unclaimed' : w.confirmed_at ? 'confirmed' : now > deadline ? 'unclaimed' : 'pending',
        confirmBy: deadline.toISOString(),
      };
    });
    const people = await this.db.query<{ participant: string }>('SELECT participant FROM entries WHERE draw_id = $1', [
      d.id,
    ]);
    return {
      ...v,
      seed: d.seed,
      drawnAt: d.drawn_at.toISOString(),
      participants: people.map((p) => p.participant).sort(),
      winners: history.filter((_, i) => !winners[i]?.replaced_at),
      selectionHistory: history,
    };
  }

  async create(input: Record<string, unknown>): Promise<DrawView> {
    const titleError = checkTitle(input.title);
    if (titleError) throw new BadRequestException(`title: ${titleError}`);
    const title = input.title as string;
    const prizes = Number(input.prizes ?? 1);
    if (!Number.isInteger(prizes) || prizes < 1 || prizes > 100)
      throw new BadRequestException('prizes: целое от 1 до 100');
    const now = clock.now();
    const opensAt = date(input.opensAt, 'opensAt', now);
    const closesAt = date(input.closesAt, 'closesAt', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    if (closesAt <= opensAt) throw new BadRequestException('closesAt: позже opensAt');
    // R4: зерно фиксируется при создании, его хэш публикуется сразу, само зерно - после выбора.
    const seed = randomBytes(32).toString('hex');
    const [d] = await this.db.query<DrawRow>(
      'INSERT INTO draws (title, prizes, opens_at, closes_at, seed, seed_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, prizes, opensAt, closesAt, seed, seedHash(seed)],
    );
    return this.view(d as DrawRow);
  }

  async list(): Promise<DrawView[]> {
    const rows = await this.db.query<DrawRow>('SELECT * FROM draws ORDER BY id DESC LIMIT 50');
    return Promise.all(rows.map((d) => this.view(d)));
  }

  async get(id: number): Promise<DrawView> {
    return this.view(await this.row(id));
  }

  async enter(id: number, input: Record<string, unknown>): Promise<{ participant: string }> {
    const d = await this.row(id);
    const participant = text(input.participant, 'participant', 100);
    const birthDate = text(input.birthDate, 'birthDate', 10);
    try {
      checkEntry({ opensAt: d.opens_at, closesAt: d.closes_at }, birthDate, clock.now());
    } catch (e) {
      rule(e);
    }
    try {
      await this.db.query('INSERT INTO entries (draw_id, participant, birth_date) VALUES ($1, $2, $3)', [
        id,
        participant,
        birthDate,
      ]);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException({ rule: 'R1', message: 'R1: участник уже подал заявку на этот розыгрыш' });
      }
      throw e;
    }
    return { participant };
  }

  // Организатор заканчивает приём заявок раньше срока.
  async close(id: number): Promise<DrawView> {
    await this.row(id);
    await this.db.query('UPDATE draws SET closes_at = now() WHERE id = $1 AND closes_at > now()', [id]);
    return this.get(id);
  }

  async draw(id: number): Promise<DrawView> {
    await this.db.tx(async (c) => {
      const d = (await c.query<DrawRow>('SELECT * FROM draws WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!d) throw new NotFoundException(`розыгрыш ${id} не найден`);
      if (d.drawn_at) throw new ConflictException('победители уже выбраны');
      if (clock.now() < d.closes_at) rule(new RuleViolation('R4', 'победителей выбирают после конца приёма заявок'));
      const people = (
        await c.query<{ participant: string }>('SELECT participant FROM entries WHERE draw_id = $1', [id])
      ).rows;
      const winners = pickWinners(
        d.seed,
        people.map((p) => p.participant),
        d.prizes,
      );
      for (const [i, w] of winners.entries()) {
        await c.query(
          'INSERT INTO winners (draw_id, position, participant, selection, selected_at) VALUES ($1, $2, $3, $2, $4)',
          [id, i + 1, w, clock.now()],
        );
      }
      await c.query('UPDATE draws SET drawn_at = $2 WHERE id = $1', [id, clock.now()]);
    });
    return this.get(id);
  }

  async redraw(id: number, position: number): Promise<DrawView> {
    await this.db.tx(async (c) => {
      const d = (await c.query<DrawRow>('SELECT * FROM draws WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!d) throw new NotFoundException('розыгрыш не найден');
      if (!d.drawn_at) throw new ConflictException('победители ещё не выбраны');
      const history = (await c.query<WinnerRow>('SELECT * FROM winners WHERE draw_id = $1 ORDER BY selection', [id]))
        .rows;
      const w = history.find((w) => w.position === position && !w.replaced_at);
      if (!w) throw new NotFoundException('приз не найден');
      const now = clock.now();
      try {
        checkRedraw(w.selected_at ?? d.drawn_at, w.confirmed_at, now);
      } catch (e) {
        if (e instanceof RuleViolation) throw new ConflictException({ rule: e.rule, message: e.message });
        throw e;
      }
      const people = (
        await c.query<{ participant: string }>('SELECT participant FROM entries WHERE draw_id = $1', [id])
      ).rows;
      const participant = pickReplacement(
        d.seed,
        people.map((p) => p.participant),
        history.map((w) => w.participant),
      );
      if (participant === undefined) throw new ConflictException('кандидатов для повтора не осталось');
      await c.query('UPDATE winners SET replaced_at = $3 WHERE draw_id = $1 AND selection = $2', [
        id,
        w.selection,
        now,
      ]);
      await c.query(
        'INSERT INTO winners (draw_id, position, participant, selection, selected_at) VALUES ($1, $2, $3, $4, $5)',
        [id, position, participant, history.length + 1, now],
      );
    });
    return this.get(id);
  }

  async confirm(id: number, position: number, input: Record<string, unknown>): Promise<DrawView> {
    const participant = text(input.participant, 'participant', 100);
    await this.db.tx(async (c) => {
      const d = (await c.query<DrawRow>('SELECT * FROM draws WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!d) throw new NotFoundException('розыгрыш не найден');
      if (!d.drawn_at) throw new ConflictException('победители ещё не выбраны');
      const w = (
        await c.query<WinnerRow>('SELECT * FROM winners WHERE draw_id = $1 AND position = $2 AND replaced_at IS NULL', [
          id,
          position,
        ])
      ).rows[0];
      if (!w || w.participant !== participant) throw new NotFoundException('нет такого приза у этого участника');
      const now = clock.now();
      try {
        checkConfirm(w.selected_at ?? d.drawn_at, now);
      } catch (e) {
        rule(e);
      }
      await c.query(
        'UPDATE winners SET confirmed_at = $3 WHERE draw_id = $1 AND selection = $2 AND confirmed_at IS NULL',
        [id, w.selection, now],
      );
    });
    return this.get(id);
  }
}
