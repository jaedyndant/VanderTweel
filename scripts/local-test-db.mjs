import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
const server = new EmbeddedPostgres({ databaseDir: '/tmp/vdt-platform-postgres', user: 'postgres', password: 'vdt-local-fixture-only', port: 55439, persistent: true, autoRehydrateSymlinks: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
if (!existsSync('/tmp/vdt-platform-postgres/PG_VERSION')) await server.initialise();
await server.start();
try { await server.createDatabase('vdt_completion_test'); } catch (e) { if (!String(e).includes('already exists')) throw e; }
console.log('Isolated local PostgreSQL ready on 127.0.0.1:55439');
process.on('SIGTERM', async () => { await server.stop(); process.exit(); });
process.on('SIGINT', async () => { await server.stop(); process.exit(); });
setInterval(() => {}, 30_000);
