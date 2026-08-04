// Conexão com o Redshift (dw_vissimo). Redshift fala protocolo Postgres na
// porta 5439, então usamos o driver `pg`. SÓ NO SERVIDOR (nunca no client).
//
// Uso: `const rows = await redshiftQuery("select * from schema.tabela limit 10");`
import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const {
    REDSHIFT_HOST,
    REDSHIFT_PORT,
    REDSHIFT_DATABASE,
    REDSHIFT_USER,
    REDSHIFT_PASSWORD,
  } = process.env;

  if (!REDSHIFT_HOST || !REDSHIFT_DATABASE || !REDSHIFT_USER || !REDSHIFT_PASSWORD) {
    throw new Error("Redshift não configurado: verifique as variáveis REDSHIFT_* no .env.");
  }

  pool = new Pool({
    host: REDSHIFT_HOST,
    port: Number(REDSHIFT_PORT) || 5439,
    database: REDSHIFT_DATABASE,
    user: REDSHIFT_USER,
    password: REDSHIFT_PASSWORD,
    ssl: { rejectUnauthorized: false }, // Redshift exige TLS
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
  return pool;
}

/** Executa uma query parametrizada e retorna as linhas. */
export async function redshiftQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as any[]);
  return res.rows;
}

/** Testa a conexão (retorna a hora atual do servidor Redshift). */
export async function redshiftPing(): Promise<{ ok: boolean; now?: string; error?: string }> {
  try {
    const rows = await redshiftQuery<{ now: string }>("select getdate() as now");
    return { ok: true, now: String(rows[0]?.now) };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
