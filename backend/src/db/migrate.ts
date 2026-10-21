import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';

export async function runMigrations(): Promise<void> {
  try {
    await migrate(db, { migrationsFolder: './src/db/migrations' });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes('migrate')) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err: unknown) => {
      process.stderr.write(`Migration failed: ${err}\n`);
      process.exit(1);
    });
}
