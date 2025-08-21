import { createMigration } from 'jv-noorm';

setTimeout(async () => {
  await createMigration();

  process.exit(0);
}, 500);