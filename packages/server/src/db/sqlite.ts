import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { resolveBackupConfig } from "../backup/backupConfig";

let db: Database.Database | null = null;

export function getSqlitePath(): string {
  return resolveBackupConfig().dbPath;
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const connection = new Database(dbPath);
  connection.pragma("journal_mode = WAL");
  connection.pragma("synchronous = NORMAL");
  connection.pragma("foreign_keys = ON");

  connection.exec(`
    CREATE TABLE IF NOT EXISTS system_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS state_snapshots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      payload    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS backup_audit (
      id         TEXT PRIMARY KEY,
      filename   TEXT NOT NULL,
      sha256     TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      trigger    TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  connection
    .prepare(
      `INSERT INTO system_meta (key, value, updated_at)
       VALUES ('schema_version', '1', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET updated_at = datetime('now')`,
    )
    .run();

  db = connection;
  return connection;
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function reopenDatabase(): Database.Database {
  closeDatabase();
  return initDatabase();
}
