import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { closeDatabase, initDatabase, getDatabase } from "../../../../packages/server/src/db/sqlite";
import { BackupService } from "../../../../packages/server/src/backup/backupService";

describe("BackupService", () => {
  let tempRoot = "";

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cc-backup-test-"));
    process.env.SQLITE_PATH = path.join(tempRoot, "live.db");
    process.env.BACKUP_DIR = path.join(tempRoot, "backups");
    process.env.BACKUP_ENABLED = "true";
    process.env.BACKUP_ON_STARTUP = "false";
    process.env.BACKUP_INTERVAL_MS = "60000";
    process.env.BACKUP_RETENTION_COUNT = "3";

    closeDatabase();
    initDatabase();
    getDatabase()
      .prepare("INSERT INTO system_meta (key, value) VALUES ('probe', 'ok')")
      .run();
  });

  afterEach(() => {
    closeDatabase();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates a backup with checksum metadata", async () => {
    const service = new BackupService();
    const backup = await service.runBackup("manual");

    expect(fs.existsSync(backup.path)).toBe(true);
    expect(backup.sha256).toHaveLength(64);
    expect(backup.sizeBytes).toBeGreaterThan(0);

    const listed = service.listBackups();
    expect(listed.some((entry) => entry.id === backup.id)).toBe(true);
  });

  it("enforces retention by removing older backups", async () => {
    const service = new BackupService();

    await service.runBackup("manual");
    await service.runBackup("manual");
    await service.runBackup("manual");
    await service.runBackup("manual");

    expect(service.listBackups().length).toBeLessThanOrEqual(3);
  });

  it("restores from a backup and creates a pre-restore safety snapshot", async () => {
    const service = new BackupService();
    const original = await service.runBackup("manual");

    getDatabase()
      .prepare("INSERT INTO system_meta (key, value) VALUES ('after_backup', 'mutated')")
      .run();

    const restore = await service.restore(original.id);
    expect(restore.restoredFrom).toBe(original.id);
    expect(restore.preRestoreBackupId).toBeTruthy();

    closeDatabase();
    initDatabase();
    const row = getDatabase()
      .prepare("SELECT value FROM system_meta WHERE key = 'probe'")
      .get() as { value: string };

    expect(row.value).toBe("ok");
    expect(
      getDatabase()
        .prepare("SELECT value FROM system_meta WHERE key = 'after_backup'")
        .get(),
    ).toBeUndefined();
  });

  it("reports backup status for health checks", async () => {
    const service = new BackupService();
    await service.runBackup("manual");

    const status = service.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.backupCount).toBeGreaterThan(0);
    expect(status.lastBackupAt).toBeTruthy();
    expect(status.healthy).toBe(true);
  });
});
