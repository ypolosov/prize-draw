import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clock from '../src/clock';
import type { Db } from '../src/db';
import { ageOn, RuleViolation } from '../src/domain/rules';
import { DrawsService } from '../src/draws/draws.service';

const current = new Date('2026-10-05T00:00:00Z');
const invalidDates = [
  '1876-13-45',
  '2000-00-01',
  '2000-13-01',
  '2000-01-00',
  '2000-01-32',
  '2000-04-31',
  '2001-02-29',
  '1900-02-29',
  '2000-02-30',
  '0000-01-01',
];

afterEach(() => vi.restoreAllMocks());

describe('DRAW-147: календарная дата рождения', () => {
  it.each(invalidDates)('домен отклоняет несуществующую дату %s', (birthDate) => {
    expect(() => ageOn(birthDate, current)).toThrow(RuleViolation);
    expect(() => ageOn(birthDate, current)).toThrow('R3:');
  });

  it.each([
    ['2000-02-29', 26],
    ['2004-02-29', 22],
    ['1900-02-28', 126],
    ['2000-04-30', 26],
    ['2000-01-31', 26],
    ['0001-01-01', 2025],
    ['0096-02-29', 1930],
  ])('домен принимает существующую дату %s', (birthDate, age) => {
    expect(ageOn(birthDate, current)).toBe(age);
  });

  it.each(invalidDates)('API отклоняет %s до записи в базу', async (birthDate) => {
    vi.spyOn(clock, 'now').mockReturnValue(current);
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { opens_at: new Date('2026-10-01T00:00:00Z'), closes_at: new Date('2026-10-10T00:00:00Z') },
      ]);
    const service = new DrawsService({ query } as unknown as Db);
    await expect(service.enter(1, { participant: 'Анна', birthDate })).rejects.toMatchObject({
      status: 422,
      response: { rule: 'R3', message: expect.stringContaining('дата рождения') },
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('API сохраняет корректную високосную дату без изменения', async () => {
    vi.spyOn(clock, 'now').mockReturnValue(current);
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { opens_at: new Date('2026-10-01T00:00:00Z'), closes_at: new Date('2026-10-10T00:00:00Z') },
      ])
      .mockResolvedValueOnce([]);
    const service = new DrawsService({ query } as unknown as Db);
    await expect(service.enter(1, { participant: 'Анна', birthDate: '2000-02-29' })).resolves.toEqual({
      participant: 'Анна',
    });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO entries'), [1, 'Анна', '2000-02-29']);
  });
});
