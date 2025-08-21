import { deploy } from 'jv-noorm/deploy';

setTimeout(async () => {
  await deploy();

  process.exit(0);
}, 500);