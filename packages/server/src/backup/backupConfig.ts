import path from "path";

export interface BackupConfig {
  enabled: boolean;
  dbPath: string;
  backupDir: string;
  intervalMs: number;
  retentionCount: number;
  backupOnStartup: boolean;
  staleThresholdMs: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function resolveBackupConfig(): BackupConfig {
  const intervalMs = parsePositiveInt(process.env.BACKUP_INTERVAL_MS, 3_600_000);
  const retentionCount = parsePositiveInt(process.env.BACKUP_RETENTION_COUNT, 24);

  return {
    enabled: parseBoolean(process.env.BACKUP_ENABLED, true),
    dbPath: process.env.SQLITE_PATH ?? path.join(process.cwd(), "data", "commit-conquer.db"),
    backupDir: process.env.BACKUP_DIR ?? path.join(process.cwd(), "data", "backups"),
    intervalMs,
    retentionCount,
    backupOnStartup: parseBoolean(process.env.BACKUP_ON_STARTUP, true),
    staleThresholdMs: intervalMs * 2,
  };
}
