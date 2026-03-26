import { DashboardStatePayload } from "./presenter";

export function renderDashboardPage(initialState: DashboardStatePayload, csrfToken: string): string {
  const stateJson = JSON.stringify(initialState).replace(/</g, "\\u003c");
  const safeCsrf = escapeAttribute(csrfToken);

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="csrf-token" content="${safeCsrf}" />
    <title>Discord Mafia Dashboard</title>
    <link rel="stylesheet" href="/client/app.css" />
  </head>
  <body>
    <div class="shell">
      <header class="hero">
        <div class="hero-top">
          <div class="hero-meta" id="hero-meta"></div>
        </div>
      </header>
      <div id="app"></div>
      <div id="mobile-dock-root"></div>
    </div>
    <div class="toast-container" id="toast-container"></div>
    <script id="initial-state" type="application/json">${stateJson}</script>
    <script src="/client/app.js"></script>
  </body>
</html>`;
  }

  function escapeAttribute(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
