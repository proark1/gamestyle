/* eslint-disable typescript/no-require-imports, typescript/unbound-method -- Electron's bootstrap uses CommonJS; destructured Node filesystem/path helpers are static functions. */
const {
  app,
  BrowserWindow,
  net,
  protocol,
  session,
  shell,
} = require('electron');
const { existsSync, readFileSync } = require('node:fs');
const { resolve, sep } = require('node:path');
const { pathToFileURL } = require('node:url');

const here = __dirname;
const client = app.isPackaged
  ? resolve(here, 'client')
  : resolve(here, '../dist/native');
const config = existsSync(resolve(here, 'runtime.json'))
  ? JSON.parse(readFileSync(resolve(here, 'runtime.json'), 'utf8'))
  : {};
const backend = new URL(
  config.apiOrigin ??
    process.env.GAME_API_ORIGIN ??
    'https://www.jumbleyard.com',
);
if (backend.protocol !== 'https:' || backend.username || backend.password)
  throw Error('A trusted HTTPS backend is required.');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'jumbleyard-app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

void app.whenReady().then(() => {
  protocol.handle('jumbleyard-app', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'client')
      return new Response('Not found', { status: 404 });
    if (url.pathname.startsWith('/api/')) {
      const headers = new Headers(request.headers);
      headers.delete('cookie');
      headers.delete('host');
      headers.set('Origin', backend.origin);
      let response;
      try {
        response = await session.defaultSession.fetch(
          new URL(url.pathname + url.search, backend.origin).href,
          {
            method: request.method,
            headers,
            credentials: 'include',
            redirect: 'error',
            ...(request.method === 'GET' || request.method === 'HEAD'
              ? {}
              : { body: await request.arrayBuffer() }),
          },
        );
      } catch {
        return Response.json(
          { error: 'Online service unavailable' },
          { status: 503 },
        );
      }
      const returned = new Headers(response.headers);
      returned.delete('content-encoding');
      returned.delete('content-length');
      returned.delete('set-cookie');
      return new Response(response.body, {
        status: response.status,
        headers: returned,
      });
    }
    let file;
    try {
      file = resolve(client, '.' + decodeURIComponent(url.pathname));
    } catch {
      return new Response('Bad path', { status: 400 });
    }
    if (file !== client && !file.startsWith(client + sep))
      return new Response('Forbidden', { status: 403 });
    if (!existsSync(file) || !url.pathname.split('/').at(-1)?.includes('.'))
      file = resolve(client, 'index.html');
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler(
    (_contents, permission, callback, details) => {
      callback(
        details.requestingUrl?.startsWith('jumbleyard-app://client/') &&
          (permission === 'clipboard-sanitized-write' ||
            (permission === 'media' &&
              details.mediaTypes?.every((type) => type === 'audio'))),
      );
    },
  );
  const createWindow = () => {
    const window = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 640,
      minHeight: 480,
      show: false,
      backgroundColor: '#b7d0c3',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    window.removeMenu();
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('jumbleyard-app://client/')) event.preventDefault();
    });
    window.once('ready-to-show', () => {
      if (process.env.GAME_DESKTOP_SMOKE !== '1') window.show();
    });
    void window.loadURL('jumbleyard-app://client/');
  };
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
});
