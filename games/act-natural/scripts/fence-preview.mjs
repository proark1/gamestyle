// Local-only visual QA of the real farm renderer, simulation and audio player.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  cacheDir: fileURLToPath(
    new URL('../../../work/fence-preview-cache', import.meta.url),
  ),
  server: {
    host: '127.0.0.1',
    port: 3015,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3014' },
  },
});
await server.listen();
console.log(
  'Fence validation: http://127.0.0.1:3015/games/act-natural/scripts/fence-preview.html',
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    void server.close().then(() => process.exit());
  });
