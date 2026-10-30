import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clock from '../src/clock';
import { Db } from '../src/db';
import { pickWinners } from '../src/domain/rules';
import { DrawsService } from '../src/draws/draws.service';

// TEST_DATABASE_URL указывает на PostgreSQL; каждый тест работает в отдельной временной схеме.
const databaseUrl = process.env.TEST_DATABASE_URL;
const legacySchema = `
CREATE TABLE draws (
  id serial PRIMARY KEY, title text NOT NULL, prizes int NOT NULL,
  opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL,
  seed text NOT NULL, seed_hash text NOT NULL, drawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE entries (
  id serial PRIMARY KEY, draw_id int NOT NULL REFERENCES draws(id),
  participant text NOT NULL, birth_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (draw_id, participant)
);
CREATE TABLE winners (
  draw_id int NOT NULL REFERENCES draws(id), position int NOT NULL,
  participant text NOT NULL, confirmed_at timestamptz,
  PRIMARY KEY (draw_id, position), UNIQUE (draw_id, participant)
);`;
const participants = ['a', 'b', 'c'];
const sequence = pickWinners('seed', participants, 3);
const current = new Date('2026-10-14T00:00:00Z');

describe.skipIf(!databaseUrl).each(['пустая база', 'прежняя схема'])('DRAW-143: PostgreSQL, %s', (mode) => {
  let admin: Pool;
  let db: Db;
  let schema: string;
  let service: DrawsService;

  async function seed() {
    await db.query(`INSERT INTO draws (id, title, prizes, opens_at, closes_at, seed, seed_hash, drawn_at)
      VALUES (1, 'Розыгрыш', 1, '2026-10-01Z', '2026-10-10Z', 'seed', 'hash', '2026-10-10Z')`);
    for (const participant of participants) {
      await db.query("INSERT INTO entries (draw_id, participant, birth_date) VALUES (1, $1, '2000-01-01')", [
        participant,
      ]);
    }
    await db.query('INSERT INTO winners (draw_id, position, participant) VALUES (1, 1, $1)', [sequence[0]]);
  }

  beforeEach(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    schema = `draw143_${randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl as string);
    url.searchParams.set('options', `-c search_path=${schema}`);
    vi.stubEnv('DATABASE_URL', url.toString());
    db = new Db();
    service = new DrawsService(db);
    vi.spyOn(clock, 'now').mockReturnValue(current);
    if (mode === 'прежняя схема') {
      await db.query(legacySchema);
      await seed();
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await db?.onModuleDestroy();
    if (schema) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin?.end();
  });

  async function initialize() {
    await db.onModuleInit();
    if (mode === 'пустая база') {
      // Первичный выбор записывается с новыми обязательными колонками.
      await db.query(`INSERT INTO draws (id, title, prizes, opens_at, closes_at, seed, seed_hash, drawn_at)
        VALUES (1, 'Розыгрыш', 1, '2026-10-01Z', '2026-10-10Z', 'seed', 'hash', '2026-10-10Z')`);
      for (const participant of participants) {
        await db.query("INSERT INTO entries (draw_id, participant, birth_date) VALUES (1, $1, '2000-01-01')", [
          participant,
        ]);
      }
      await db.query('INSERT INTO winners (draw_id, position, participant, selection) VALUES (1, 1, $1, 1)', [
        sequence[0],
      ]);
    }
  }

  it('инициализирует схему повторно и сохраняет прежнего победителя', async () => {
    await initialize();
    await db.onModuleInit();
    expect(await db.query('SELECT position, participant, selection FROM winners')).toEqual([
      { position: 1, participant: sequence[0], selection: 1 },
    ]);
    expect((await service.get(1)).winners[0]?.status).toBe('unclaimed');
  });

  it('сохраняет повтор и отдаёт историю для пересчёта после нового подключения', async () => {
    await initialize();
    await service.redraw(1, 1);
    await db.onModuleDestroy();
    db = new Db();
    const result = await new DrawsService(db).get(1);
    expect(result.seed).toBe('seed');
    expect(result.participants).toEqual(participants);
    expect(result.winners).toEqual([
      expect.objectContaining({ position: 1, participant: sequence[1], selection: 2, status: 'pending' }),
    ]);
    expect(result.selectionHistory).toEqual([
      expect.objectContaining({ participant: sequence[0], selection: 1, status: 'unclaimed' }),
      expect.objectContaining({ participant: sequence[1], selection: 2, status: 'pending' }),
    ]);
  });

  it('отклоняет дубликат ключом базы и откатывает всю операцию повтора', async () => {
    await initialize();
    const before = await db.query('SELECT * FROM winners');
    // Имитируем ошибочную запись на стороне БД: запрос сервиса и все ограничения выполняются реально.
    await db.query(`CREATE FUNCTION duplicate_winner() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW.participant := (SELECT participant FROM winners WHERE draw_id = NEW.draw_id ORDER BY selection LIMIT 1);
        RETURN NEW;
      END $$;
      CREATE TRIGGER duplicate_winner BEFORE INSERT ON winners FOR EACH ROW EXECUTE FUNCTION duplicate_winner();`);
    await expect(service.redraw(1, 1)).rejects.toMatchObject({
      code: '23505',
      constraint: 'winners_draw_id_participant_key',
    });
    expect(await db.query('SELECT * FROM winners')).toEqual(before);
    await db.query('DROP TRIGGER duplicate_winner ON winners');
    await service.redraw(1, 1);
    expect(await db.query('SELECT * FROM winners')).toHaveLength(2);
  });
});
