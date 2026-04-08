import './config/env.js'; // Validate env first — will exit if invalid
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { pgPool } from './lib/pgPool.js';

async function main() {
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`API running on http://localhost:${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}

main().catch(async (err) => {
  console.error('Fatal startup error:', err);
  await prisma.$disconnect();
  await pgPool.end();
  process.exit(1);
});
