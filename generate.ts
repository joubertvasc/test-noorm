import { generate } from 'jv-noorm/generate';

setTimeout(async () => {
  await generate();

  process.exit(0);
}, 500);