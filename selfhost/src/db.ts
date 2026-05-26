import mysql from "mysql2/promise";
import { env } from "./env.js";

export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

export async function query<T = any>(sql: string, params?: any): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function exec(sql: string, params?: any): Promise<mysql.ResultSetHeader> {
  const [res] = await pool.execute(sql, params);
  return res as mysql.ResultSetHeader;
}
