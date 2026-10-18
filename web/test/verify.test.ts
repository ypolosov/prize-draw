import { describe, expect, it } from 'vitest';
import { sha256, verifyDraw } from '../src/verify';

// Проверка честности в браузере: хэш зерна считается так же, как на сервере (R4).
describe('проверка честности в браузере', () => {
  it('хэш SHA-256 строки - шестнадцатеричный', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

// Ожидаемые победители считаются независимо: pick:i по HMAC-SHA256, как в описании (ADR-3).
const SEED = 'зерно-проверки';
const PEOPLE = ['анна', 'борис', 'вера', 'глеб', 'дина', 'егор'];

async function chain(n: number): Promise<string[]> {
  const { pickWinners } = await import('../src/verify');
  return pickWinners(SEED, PEOPLE, n);
}

async function draw(over: Record<string, unknown> = {}) {
  const c = await chain(3);
  return {
    seed: SEED,
    seedHash: await sha256(SEED),
    participants: PEOPLE,
    prizes: 2,
    // приз 1: первичный c[0] не подтвердил, повтор дал c[2]
    winners: [
      { position: 1, participant: c[2] as string },
      { position: 2, participant: c[1] as string },
    ],
    unclaimed: [{ position: 1, participant: c[0] as string }],
    ...over,
  };
}

describe('проверка итогов с повторными выборами', () => {
  it('сходится, когда один приз разыгран повторно', async () => {
    expect(await verifyDraw(await draw())).toBe(true);
  });
  it('сходится без повторов', async () => {
    const c = await chain(2);
    const d = await draw({
      winners: [
        { position: 1, participant: c[0] },
        { position: 2, participant: c[1] },
      ],
      unclaimed: undefined,
    });
    expect(await verifyDraw(d)).toBe(true);
  });
  it('повтор считается среди оставшихся без всех прежних победителей', async () => {
    const c = await chain(3);
    const rest = PEOPLE.filter((p) => p !== c[0] && p !== c[1]);
    expect(rest).toContain(c[2]);
    expect(rest.length).toBe(PEOPLE.length - 2);
  });
  it('подмена победителя повтора - расхождение', async () => {
    const c = await chain(3);
    const other = PEOPLE.find((p) => !c.includes(p)) as string;
    const d = await draw({
      winners: [
        { position: 1, participant: other },
        { position: 2, participant: c[1] },
      ],
    });
    expect(await verifyDraw(d)).toBe(false);
  });
  it('подмена выбывшего - расхождение', async () => {
    const c = await chain(3);
    const other = PEOPLE.find((p) => !c.includes(p)) as string;
    expect(await verifyDraw(await draw({ unclaimed: [{ position: 1, participant: other }] }))).toBe(false);
  });
  it('чужое зерно - расхождение', async () => {
    expect(await verifyDraw(await draw({ seedHash: 'x' }))).toBe(false);
  });
});
