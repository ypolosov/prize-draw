// Подключение к PostgreSQL и схема. R1 и R5 держат уникальные ключи (ADR-2).
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS draws (
  id serial PRIMARY KEY,
  title text NOT NULL,
  prizes int NOT NULL CHECK (prizes > 0),
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  seed text NOT NULL,
  seed_hash text NOT NULL,
  drawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS entries (
  id serial PRIMARY KEY,
  draw_id int NOT NULL REFERENCES draws(id),
  participant text NOT NULL,
  birth_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draw_id, participant)
);
CREATE TABLE IF NOT EXISTS winners (
  draw_id int NOT NULL REFERENCES draws(id),
  position int NOT NULL,
  participant text NOT NULL,
  confirmed_at timestamptz,
  PRIMARY KEY (draw_id, position),
  UNIQUE (draw_id, participant)
);
ALTER TABLE winners ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
CREATE TABLE IF NOT EXISTS unclaimed_winners (
  id serial PRIMARY KEY,
  draw_id int NOT NULL REFERENCES draws(id),
  position int NOT NULL,
  participant text NOT NULL,
  UNIQUE (draw_id, participant)
);`;

@Injectable()
export class Db implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleInit(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pool.query<T>(sql, params)).rows;
  }

  async tx<T>(work: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const out = await work(c);
      await c.query('COMMIT');
      return out;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
}
