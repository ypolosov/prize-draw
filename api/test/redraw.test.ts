import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clock from '../src/clock';
import type { Db } from '../src/db';
import { pickWinners } from '../src/domain/rules';
import { DrawsService } from '../src/draws/draws.service';

afterEach(() => vi.restoreAllMocks());

function fixture() {
  const drawn = new Date('2026-10-10T00:00:00Z');
  const current = new Date('2026-10-14T00:00:00Z');
  vi.spyOn(clock, 'now').mockReturnValue(current);
  const participants = ['a', 'b', 'c'];
  const sequence = pickWinners('seed', participants, 3);
  const draw = {
    id: 1,
    title: 'Розыгрыш',
    prizes: 1,
    opens_at: drawn,
    closes_at: drawn,
    drawn_at: drawn,
    seed: 'seed',
    seed_hash: 'hash',
  };
  const winners = [
    {
      position: 1,
      participant: sequence[0],
      selection: 1,
      selected_at: null as Date | null,
      confirmed_at: null as Date | null,
      replaced_at: null as Date | null,
    },
  ];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('SELECT * FROM draws')) return [draw];
    if (sql.includes('FROM winners')) return winners;
    if (sql.includes('count(*)')) return [{ n: participants.length }];
    if (sql.includes('FROM entries')) return participants.map((participant) => ({ participant }));
    if (sql.startsWith('UPDATE winners SET replaced_at'))
      winners.at(0) && Object.assign(winners.at(0) as object, { replaced_at: params[2] });
    if (sql.startsWith('INSERT INTO winners'))
      winners.push({
        position: params[1] as number,
        participant: params[2] as string,
        selection: params[3] as number,
        selected_at: params[4] as Date,
        confirmed_at: null,
        replaced_at: null,
      });
    return [];
  });
  const db = {
    query,
    tx: async (work: (client: unknown) => Promise<unknown>) =>
      work({ query: async (sql: string, params: unknown[]) => ({ rows: await query(sql, params) }) }),
  } as unknown as Db;
  return { service: new DrawsService(db), winners, query, drawn, current, sequence, participants };
}

describe('DRAW-143: API повтора', () => {
  it('сохраняет повтор на том же месте и отдаёт данные для пересчёта', async () => {
    const f = fixture();
    const result = await f.service.redraw(1, 1);
    expect(f.winners).toHaveLength(2);
    expect(result.winners).toEqual([
      expect.objectContaining({
        position: 1,
        participant: f.sequence[1],
        status: 'pending',
        confirmBy: '2026-10-17T00:00:00.000Z',
      }),
    ]);
    expect(result.selectionHistory).toEqual([
      expect.objectContaining({ participant: f.sequence[0], status: 'unclaimed', selection: 1 }),
      expect.objectContaining({ participant: f.sequence[1], selection: 2 }),
    ]);
    const read = await f.service.get(1);
    expect(read.seed).toBe('seed');
    expect(read.participants).toEqual(f.participants);
    expect(read.selectionHistory).toEqual(result.selectionHistory);
  });

  it('определяет невостребованный приз через часы приложения', async () => {
    const f = fixture();
    vi.spyOn(clock, 'now').mockReturnValue(f.drawn);
    expect((await f.service.get(1)).winners[0]?.status).toBe('pending');
    vi.spyOn(clock, 'now').mockReturnValue(f.current);
    expect((await f.service.get(1)).winners[0]?.status).toBe('unclaimed');
  });

  it.each(['срок', 'подтверждение', 'нет кандидатов'])('отклоняет повтор: %s', async (reason) => {
    const f = fixture();
    if (reason === 'срок') vi.spyOn(clock, 'now').mockReturnValue(f.drawn);
    if (reason === 'подтверждение') Object.assign(f.winners.at(0) as object, { confirmed_at: f.drawn });
    if (reason === 'нет кандидатов') {
      for (let i = 1; i < 3; i++)
        f.winners.push({
          ...f.winners.at(0),
          selection: i + 1,
          position: i + 1,
          participant: f.sequence[i],
        });
    }
    await expect(f.service.redraw(1, 1)).rejects.toMatchObject({ status: 409 });
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });
});
