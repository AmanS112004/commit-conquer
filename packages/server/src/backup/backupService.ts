import crypto from "crypto";
import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { closeDatabase, getDatabase, getSqlitePath, reopenDatabase } from "../db/sqlite";
import { resolveBackupConfig, type BackupConfig } from "./backupConfig";
import type { BackupRecord, BackupStatus, BackupTrigger, RestoreResult } from "./types";

const MANIFEST_FILE = "manifest.json";

interface ManifestEntry {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  sha256: string;
  trigger: BackupTrigger;
}

interface Manifest {
  version: 1;
  backups: ManifestEntry[];
}

export class BackupService {
  private readonly config: BackupConfig;
  private lastBackupAt: string | null = null;
  private lastBackupId: string | null = null;
  private lastError: string | null = null;
  private running = false;

  constructor(config: BackupConfig = resolveBackupConfig()) {
    this.config = config;
    fs.mkdirSync(this.config.backupDir, { recursive: true });
    this.hydrateFromManifest();
  }

  getConfig(): BackupConfig {
    return { ...this.config };
  }

  async runBackup(trigger: BackupTrigger = "manual"): Promise<BackupRecord> {
    if (!this.config.enabled) {
      throw new Error("Backups are disabled (BACKUP_ENABLED=false)");
    }
    if (this.running) {
      throw new Error("A backup is already in progress");
    }

    this.running = true;
    try {
      const database = getDatabase();
      const id = this.createBackupId();
      const filename = `${id}.sqlite`;
      const destination = path.join(this.config.backupDir, filename);

      await this.createHotBackup(database, destination);

      const sizeBytes = fs.statSync(destination).size;
      const sha256 = await this.hashFile(destination);

      const record: BackupRecord = {
        id,
        filename,
        path: destination,
        createdAt: new Date().toISOString(),
        sizeBytes,
        sha256,
        trigger,
      };

      this.appendManifest(record);
      this.recordAudit(record);
      await this.enforceRetention();

      this.lastBackupAt = record.createdAt;
      this.lastBackupId = record.id;
      this.lastError = null;

      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      throw error;
    } finally {
      this.running = false;
    }
  }

  async restore(backupId: string): Promise<RestoreResult> {
    const backup = this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    await this.verifyBackupIntegrity(backup.path, backup.sha256);

    const preRestore = await this.runBackup("pre-restore");

    closeDatabase();

    const livePath = getSqlitePath();
    const liveDir = path.dirname(livePath);
    fs.mkdirSync(liveDir, { recursive: true });

    if (fs.existsSync(livePath)) {
      fs.unlinkSync(livePath);
    }
    fs.copyFileSync(backup.path, livePath);

    const sha256 = await this.hashFile(livePath);
    reopenDatabase();

    return {
      restoredFrom: backup.id,
      restoredAt: new Date().toISOString(),
      preRestoreBackupId: preRestore.id,
      sha256,
    };
  }

  listBackups(): BackupRecord[] {
    return this.readManifest()
      .backups
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => ({
        id: entry.id,
        filename: entry.filename,
        path: path.join(this.config.backupDir, entry.filename),
        createdAt: entry.createdAt,
        sizeBytes: entry.sizeBytes,
        sha256: entry.sha256,
        trigger: entry.trigger,
      }));
  }

  getBackup(id: string): BackupRecord | undefined {
    return this.listBackups().find((backup) => backup.id === id);
  }

  getStatus(): BackupStatus {
    const backups = this.listBackups();
    const stale =
      this.config.enabled &&
      this.lastBackupAt !== null &&
      Date.now() - new Date(this.lastBackupAt).getTime() > this.config.staleThresholdMs;

    const healthy =
      this.config.enabled &&
      backups.length > 0 &&
      !stale &&
      this.lastError === null;

    return {
      enabled: this.config.enabled,
      dbPath: this.config.dbPath,
      backupDir: this.config.backupDir,
      intervalMs: this.config.intervalMs,
      retentionCount: this.config.retentionCount,
      lastBackupAt: this.lastBackupAt,
      lastBackupId: this.lastBackupId,
      lastError: this.lastError,
      backupCount: backups.length,
      healthy,
      stale,
    };
  }

  private createBackupId(): string {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
    const suffix = crypto.randomBytes(3).toString("hex");
    return `backup_${stamp}_${suffix}`;
  }

  private async createHotBackup(database: Database.Database, destination: string): Promise<void> {
    await database.backup(destination);
  }

  private async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);
      stream.on("error", reject);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

  private async verifyBackupIntegrity(filePath: string, expectedSha256: string): Promise<void> {
    const actual = await this.hashFile(filePath);
    if (actual !== expectedSha256) {
      throw new Error(`Backup integrity check failed for ${path.basename(filePath)}`);
    }
  }

  private manifestPath(): string {
    return path.join(this.config.backupDir, MANIFEST_FILE);
  }

  private readManifest(): Manifest {
    const manifestFile = this.manifestPath();
    if (!fs.existsSync(manifestFile)) {
      return { version: 1, backups: [] };
    }
    const raw = fs.readFileSync(manifestFile, "utf8");
    return JSON.parse(raw) as Manifest;
  }

  private writeManifest(manifest: Manifest): void {
    fs.writeFileSync(this.manifestPath(), JSON.stringify(manifest, null, 2), "utf8");
  }

  private appendManifest(record: BackupRecord): void {
    const manifest = this.readManifest();
    manifest.backups.push({
      id: record.id,
      filename: record.filename,
      createdAt: record.createdAt,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      trigger: record.trigger,
    });
    this.writeManifest(manifest);
  }

  private recordAudit(record: BackupRecord): void {
    const database = getDatabase();
    database
      .prepare(
        `INSERT INTO backup_audit (id, filename, sha256, size_bytes, trigger, created_at)
         VALUES (@id, @filename, @sha256, @sizeBytes, @trigger, @createdAt)`,
      )
      .run({
        id: record.id,
        filename: record.filename,
        sha256: record.sha256,
        sizeBytes: record.sizeBytes,
        trigger: record.trigger,
        createdAt: record.createdAt,
      });
  }

  private async enforceRetention(): Promise<void> {
    const manifest = this.readManifest();
    const sorted = [...manifest.backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const keep = sorted.slice(0, this.config.retentionCount);
    const remove = sorted.slice(this.config.retentionCount);

    for (const entry of remove) {
      const filePath = path.join(this.config.backupDir, entry.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    manifest.backups = keep;
    this.writeManifest(manifest);
  }

  private hydrateFromManifest(): void {
    const backups = this.listBackups();
    if (backups.length === 0) return;
    const latest = backups[0];
    this.lastBackupAt = latest.createdAt;
    this.lastBackupId = latest.id;
  }
}
