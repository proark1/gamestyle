import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const distClient = path.resolve('dist/client');
if (!existsSync(distClient)) {
  mkdirSync(distClient, { recursive: true });
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="theme-color" content="#315e53" />
  <title>Jumbleyard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #b7d0c3;
      color: #294a43;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: env(safe-area-inset-top, 20px) env(safe-area-inset-right, 20px) env(safe-area-inset-bottom, 20px) env(safe-area-inset-left, 20px);
      text-align: center;
    }
    .card {
      background: #fff6df;
      padding: 32px 24px;
      border-radius: 24px;
      box-shadow: 0 12px 36px rgba(41, 74, 67, 0.15);
      max-width: 380px;
      width: 100%;
    }
    .logo {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 26px;
      margin-bottom: 8px;
      color: #294a43;
    }
    p {
      font-size: 15px;
      color: #526e5e;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 4px solid #cddcd4;
      border-top-color: #315e53;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto;
    }
    .btn {
      display: none;
      margin-top: 20px;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 600;
      color: #fff6df;
      background: #315e53;
      border: none;
      border-radius: 12px;
      cursor: pointer;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="card">
    <svg class="logo" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#294a43"/><rect x="17" y="12" width="27" height="20" rx="3" fill="#efbd51" transform="rotate(-7 30 22)"/><path d="M10 40q7-8 14 0t14 0t14 0M10 51q7-8 14 0t14 0t14 0" fill="none" stroke="#fff3d3" stroke-width="4" stroke-linecap="round"/></svg>
    <h1>Jumbleyard</h1>
    <p id="msg">Connecting to game servers...</p>
    <div class="spinner" id="spinner"></div>
    <button class="btn" id="retryBtn" onclick="tryConnect()">Retry Connection</button>
  </div>
  <script>
    const TARGET = window.CAPACITOR_SERVER_URL || 'https://www.jumbleyard.com';
    function tryConnect() {
      document.getElementById('msg').textContent = 'Connecting to game servers...';
      document.getElementById('spinner').style.display = 'block';
      document.getElementById('retryBtn').style.display = 'none';
      fetch(TARGET + '/api/health', { mode: 'cors' })
        .then(res => {
          if (res.ok) {
            window.location.replace(TARGET + window.location.search);
          } else {
            showRetry('Server unavailable. Please try again.');
          }
        })
        .catch(() => {
          showRetry('Could not connect. Please check your internet connection.');
        });
    }
    function showRetry(err) {
      document.getElementById('msg').textContent = err;
      document.getElementById('spinner').style.display = 'none';
      document.getElementById('retryBtn').style.display = 'inline-block';
    }
    tryConnect();
  </script>
</body>
</html>
`;

writeFileSync(path.join(distClient, 'index.html'), html, 'utf8');
console.log('Prepared dist/client/index.html native bootstrapper.');
