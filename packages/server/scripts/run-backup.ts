import "dotenv/config";
import { enforceEnv } from "../src/validateEnv";
import { initDatabase, closeDatabase } from "../src/db/sqlite";
import { BackupService } from "../src/backup";

enforceEnv();
initDatabase();

const service = new BackupService();

service
  .runBackup("manual")
  .then((backup) => {
    console.log(JSON.stringify({ success: true, backup }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDatabase();
  });
