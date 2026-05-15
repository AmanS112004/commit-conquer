import type { BackupService } from "./backupService";

let timer: NodeJS.Timeout | null = null;

export function startBackupScheduler(service: BackupService): void {
  const config = service.getConfig();
  if (!config.enabled) return;

  stopBackupScheduler();

  timer = setInterval(() => {
    void service.runBackup("scheduled").catch((error) => {
      console.error("[BackupScheduler] Scheduled backup failed:", error);
    });
  }, config.intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

export function stopBackupScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function runStartupBackup(service: BackupService): Promise<void> {
  const config = service.getConfig();
  if (!config.enabled || !config.backupOnStartup) return;

  try {
    await service.runBackup("startup");
  } catch (error) {
    console.error("[BackupScheduler] Startup backup failed:", error);
  }
}
