import { Pool } from 'pg';
import { DB_URL } from './env';


export const pool = new Pool({ connectionString: DB_URL, max: 10 });

export async function schema() {
    await pool.query(`
        CREATE EXTENSION IF NOT EXISTS timescaledb;
        CREATE TABLE IF NOT EXISTS md_trades (
          ts timestamptz NOT NULL,
          symbol text NOT NULL,
          price double precision NOT NULL,
          qty   double precision NOT NULL,
          agg_id bigint NOT NULL,
          first_id bigint,
          last_id  bigint,
          maker boolean,
          event_ts timestamptz,
          source text NOT NULL DEFAULT 'binance',
          PRIMARY KEY (symbol, agg_id, ts)
        );
        SELECT create_hypertable('md_trades','ts', if_not_exists => TRUE);
        CREATE INDEX IF NOT EXISTS idx_md_trades_symbol_ts ON md_trades(symbol, ts DESC);
      `);
}