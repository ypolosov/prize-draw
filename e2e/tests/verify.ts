// Независимый пересчёт итога розыгрыша (R4, ADR-3): написан заново по описанию в README,
// без кода API, - так проверка ловит расхождение реализации с объявленным способом.
import { createHash, createHmac } from 'node:crypto';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function recompute(seed: string, participants: string[], prizes: number): string[] {
  const pool = [...new Set(participants)].sort();
  const out: string[] = [];
  for (let i = 0; i < prizes && pool.length; i++) {
    const n = createHmac('sha256', seed).update(`pick:${i}`).digest().readBigUInt64BE(0);
    out.push(...pool.splice(Number(n % BigInt(pool.length)), 1));
  }
  return out;
}
