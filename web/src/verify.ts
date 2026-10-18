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

interface Verifiable {
  seed?: string;
  seedHash: string;
  participants?: string[];
  prizes: number;
  winners: { position: number; participant: string }[];
  unclaimed?: { position: number; participant: string }[];
}

// Повторные выборы - следующие шаги той же последовательности (ADR-3): первые `prizes` шагов
// дают первичных победителей, дальше каждый повтор берёт следующий шаг среди оставшихся без всех
// прежних победителей. Пересчитываем всю цепочку и сверяем с опубликованными: по каждому призу
// первичный победитель на месте, а все названные участники - ровно те, что дала цепочка.
export async function verifyDraw(draw: Verifiable): Promise<boolean> {
  const { seed, participants } = draw;
  if (!seed || !participants) return false;
  if ((await sha256(seed)) !== draw.seedHash) return false;
  const old = draw.unclaimed ?? [];
  const chain = await pickWinners(seed, participants, draw.prizes + old.length);
  if (chain.length !== draw.prizes + old.length) return false;
  const named = [...draw.winners.map((w) => w.participant), ...old.map((u) => u.participant)];
  if (new Set(named).size !== named.length) return false;
  if (named.some((p) => !chain.includes(p))) return false;
  for (let p = 1; p <= draw.prizes; p++) {
    const mine = [...draw.winners.filter((w) => w.position === p), ...old.filter((u) => u.position === p)];
    if (!mine.some((w) => w.participant === chain[p - 1])) return false;
  }
  return draw.winners.length === draw.prizes;
}
