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

// Победитель, не подтвердивший приз: его место занял повтор (ADR-3).
export interface Replaced {
  position: number;
  participant: string;
}

// Итог по последовательности выборов: сначала призы, затем повторы по порядку. На каждом шаге
// i равно числу уже сделанных выборов, выбранный выходит из списка (R5). Возвращает победителей
// по местам (место - индекс + 1) или undefined, если повтор не сходится с последовательностью.
export async function recomputeWinners(
  seed: string,
  participants: string[],
  prizes: number,
  replaced: Replaced[] = [],
): Promise<string[] | undefined> {
  const pool = [...new Set(participants)].sort();
  const winners: string[] = [];
  let step = 0;
  const pick = async (): Promise<string | undefined> => {
    if (pool.length === 0) return undefined;
    const n = (await hmac(seed, `pick:${step++}`)).getBigUint64(0);
    return pool.splice(Number(n % BigInt(pool.length)), 1)[0];
  };
  for (let i = 0; i < prizes; i++) {
    const w = await pick();
    if (w !== undefined) winners.push(w);
  }
  for (const r of replaced) {
    if (winners[r.position - 1] !== r.participant) return undefined;
    const next = await pick();
    if (next === undefined) return undefined;
    winners[r.position - 1] = next;
  }
  return winners;
}
