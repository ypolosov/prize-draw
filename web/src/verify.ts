// Проверка честности в браузере (R4): хэш раскрытого зерна совпадает с опубликованным, а
// победители пересчитываются из зерна тем же способом, что в API (ADR-3).
const enc = new TextEncoder();

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function hmac(key: string, msg: string): Promise<DataView> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new DataView(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}

export async function pickWinners(seed: string, participants: string[], prizes: number): Promise<string[]> {
  const pool = [...new Set(participants)].sort();
  const winners: string[] = [];
  for (let i = 0; i < prizes && pool.length > 0; i++) {
    const n = (await hmac(seed, `pick:${i}`)).getBigUint64(0);
    const [w] = pool.splice(Number(n % BigInt(pool.length)), 1);
    if (w !== undefined) winners.push(w);
  }
  return winners;
}

export type WinnersCheck = 'exact' | 'partial' | 'mismatch';

// Победители против зерна (ADR-3): 'exact' - все призы совпадают с исходным выбором;
// 'partial' - часть призов заменена кандидатами из продолжения последовательности (повтор),
// но порядок и число повторов API не отдаёт, поэтому полностью их подтвердить нельзя;
// 'mismatch' - неполный список, дубли, лишние или повторные позиции, чужой участник.
export function checkWinners(
  sequence: string[],
  prizes: number,
  winners: { position: number; participant: string }[],
): WinnersCheck {
  if (winners.length !== prizes) return 'mismatch';
  const positions = new Set(winners.map((w) => w.position));
  if (positions.size !== prizes || [...positions].some((p) => !Number.isInteger(p) || p < 1 || p > prizes))
    return 'mismatch';
  if (new Set(winners.map((w) => w.participant)).size !== prizes) return 'mismatch';
  const tail = new Set(sequence.slice(prizes));
  let redrawn = false;
  for (const w of winners) {
    if (sequence[w.position - 1] === w.participant) continue;
    if (!tail.has(w.participant)) return 'mismatch';
    redrawn = true;
  }
  return redrawn ? 'partial' : 'exact';
}
