export type BackupTrigger = "scheduled" | "manual" | "pre-restore" | "shutdown" | "startup";

export interface BackupRecord {
  id: string;
  filename: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
  sha256: string;
  trigger: BackupTrigger;
}

export interface BackupStatus {
  enabled: boolean;
  dbPath: string;
  backupDir: string;
  intervalMs: number;
  retentionCount: number;
  lastBackupAt: string | null;
  lastBackupId: string | null;
  lastError: string | null;
  backupCount: number;
  healthy: boolean;
  stale: boolean;
}

export interface RestoreResult {
  restoredFrom: string;
  restoredAt: string;
  preRestoreBackupId: string;
  sha256: string;
}
