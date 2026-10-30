// Правила розыгрыша R1-R6 (README.md) и выбор победителей - чистые функции без базы и
// фреймворка: результат может пересчитать любой (ADR-3).
import { createHash, createHmac } from 'node:crypto';

export const MIN_AGE = 18; // R3
export const CONFIRM_DAYS = 3; // R6

export type Rule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';

export class RuleViolation extends Error {
  readonly rule: Rule;
  constructor(rule: Rule, message: string) {
    super(`${rule}: ${message}`);
    this.rule = rule;
  }
}

export interface Period {
  opensAt: Date;
  closesAt: Date;
}

// Полных лет на дату (дата рождения - ГГГГ-ММ-ДД).
export function ageOn(birthDate: string, on: Date): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) throw new RuleViolation('R3', 'дата рождения - в виде ГГГГ-ММ-ДД');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = on.getUTCFullYear() - y;
  if (on.getUTCMonth() + 1 < mo || (on.getUTCMonth() + 1 === mo && on.getUTCDate() < d)) age--;
  return age;
}

// R2 и R3: заявка принимается только в период розыгрыша и только от совершеннолетнего.
// R1 (одна заявка) держит уникальный ключ базы (ADR-2).
export function checkEntry(period: Period, birthDate: string, now: Date): void {
  if (now < period.opensAt || now >= period.closesAt)
    throw new RuleViolation('R2', 'заявки принимаются только в период розыгрыша');
  if (ageOn(birthDate, now) < MIN_AGE) throw new RuleViolation('R3', `участнику должно быть ${MIN_AGE} лет`);
}

export function seedHash(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

// R4, R5: участники - без повторов, по возрастанию (как Array.prototype.sort), затем выбор без
// возвращения: на шаге i индекс - первые 8 байт HMAC-SHA256(зерно, "pick:i") по модулю остатка.
export function pickWinners(seed: string, participants: string[], prizes: number): string[] {
  const pool = [...new Set(participants)].sort();
  const winners: string[] = [];
  for (let i = 0; i < prizes && pool.length > 0; i++) {
    const n = createHmac('sha256', seed).update(`pick:${i}`).digest().readBigUInt64BE(0);
    const [w] = pool.splice(Number(n % BigInt(pool.length)), 1);
    if (w !== undefined) winners.push(w);
  }
  return winners;
}

// R6: приз подтверждают в течение CONFIRM_DAYS дней после выбора победителей.
export function confirmDeadline(drawnAt: Date): Date {
  return new Date(drawnAt.getTime() + CONFIRM_DAYS * 24 * 60 * 60 * 1000);
}

export function checkConfirm(drawnAt: Date, now: Date): void {
  if (now > confirmDeadline(drawnAt))
    throw new RuleViolation('R6', `приз не подтверждён за ${CONFIRM_DAYS} дня и не востребован`);
}

export const TITLE_MIN = 3;
export const TITLE_MAX = 120;

// Название розыгрыша: от TITLE_MIN до TITLE_MAX символов, без пробелов по краям.
// Возвращает сообщение об ошибке по-русски или null, если название верное.
export function checkTitle(title: unknown): string | null {
  if (typeof title !== 'string') return 'название должно быть строкой';
  if (title !== title.trim()) return 'название не должно начинаться или заканчиваться пробелом';
  if (title.length < TITLE_MIN || title.length > TITLE_MAX)
    return `название должно быть от ${TITLE_MIN} до ${TITLE_MAX} символов`;
  return null;
}

// Повтор использует следующий шаг и исключает всю историю выбора, включая невостребованные призы.
export function pickReplacement(seed: string, participants: string[], selected: string[]): string | undefined {
  const excluded = new Set(selected);
  const pool = [...new Set(participants)].sort().filter((participant) => !excluded.has(participant));
  if (!pool.length) return undefined;
  const n = createHmac('sha256', seed).update(`pick:${selected.length}`).digest().readBigUInt64BE(0);
  return pool[Number(n % BigInt(pool.length))];
}

export function checkRedraw(selectedAt: Date, confirmedAt: Date | null, now: Date): void {
  if (confirmedAt) throw new RuleViolation('R6', 'приз уже подтверждён');
  if (now <= confirmDeadline(selectedAt)) throw new RuleViolation('R6', 'срок подтверждения ещё не истёк');
}
