/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { TELEMETRY_EVENT_NAMES } from "../lib/telemetry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  TELEMETRY_DASHBOARD_PASSWORD?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const TELEMETRY_EVENT_NAME_SET = new Set<string>(TELEMETRY_EVENT_NAMES);
const TELEMETRY_ALLOWED_ORIGINS = new Set([
  "https://shadesanna.com",
  "https://www.shadesanna.com",
  "https://parsannak.github.io",
]);

const EVENT_LABELS: Record<string, string> = {
  site_entered: "Entered the world",
  letter_opened: "Opened the letter",
  letter_narration_played: "Played the narrated letter",
  memory_opened: "Opened a memory",
  firefly_clicked: "Found a firefly",
  memory_walk_completed: "Reached the end of the walk",
  wish_sent: "Sent a wish",
};

const MEMORY_LABELS: Record<string, string> = {
  "first-time-we-showed-up": "The First Time We Showed Up",
  "loving-across-the-distance": "Loving Across the Distance",
  "making-a-home-wherever-we-were": "Making a Home Wherever We Were",
  "crossing-the-distance": "Crossing the Distance",
  "ordinary-days-extraordinary-love": "Ordinary Days, Extraordinary Love",
  "the-life-we-kept-choosing": "The Life We Kept Choosing",
};

type TelemetrySummary = {
  visits: number;
  visitsLastSevenDays: number;
  letterOpens: number;
  narrationPlays: number;
  memoryOpens: number;
  fireflyClicks: number;
  completedWalks: number;
  wishesSent: number;
  lastVisit: number | null;
};

type CountRow = {
  label: string;
  count: number;
};

type RecentEventRow = {
  eventName: string;
  detail: string;
  createdAt: number;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function safeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function timingSafeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function dashboardAuthorized(request: Request, password: string): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return false;

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;

    const username = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);
    return (
      timingSafeEqual(username, "sanna") &&
      timingSafeEqual(suppliedPassword, password)
    );
  } catch {
    return false;
  }
}

function privateHeaders(contentType = "text/html; charset=utf-8") {
  return {
    "Cache-Control": "no-store, private",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "Content-Type": contentType,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function dashboardAccessError(request: Request, env: Env): Response | null {
  const password = env.TELEMETRY_DASHBOARD_PASSWORD;
  if (!password) {
    return new Response("Dashboard configuration is unavailable.", {
      status: 503,
      headers: privateHeaders("text/plain; charset=utf-8"),
    });
  }

  if (!dashboardAuthorized(request, password)) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        ...privateHeaders("text/plain; charset=utf-8"),
        "WWW-Authenticate":
          'Basic realm="Sanna private insights", charset="UTF-8"',
      },
    });
  }

  return null;
}

function telemetryCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !TELEMETRY_ALLOWED_ORIGINS.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

function telemetryResponse(status: number, origin: string | null) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...telemetryCorsHeaders(origin),
    },
  });
}

function telemetryPreflight(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const originAllowed =
    origin === requestUrl.origin ||
    (origin !== null && TELEMETRY_ALLOWED_ORIGINS.has(origin));

  if (!originAllowed) {
    return telemetryResponse(403, origin);
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store",
      ...telemetryCorsHeaders(origin),
    },
  });
}

async function recordTelemetry(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== requestUrl.origin &&
    !TELEMETRY_ALLOWED_ORIGINS.has(origin)
  ) {
    return telemetryResponse(403, origin);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return telemetryResponse(415, origin);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2048) {
    return telemetryResponse(413, origin);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return telemetryResponse(400, origin);
  }

  if (!payload || typeof payload !== "object") {
    return telemetryResponse(400, origin);
  }

  const { eventName, sessionId, detail = "" } = payload as Record<
    string,
    unknown
  >;

  if (
    typeof eventName !== "string" ||
    !TELEMETRY_EVENT_NAME_SET.has(eventName) ||
    typeof sessionId !== "string" ||
    !/^[a-zA-Z0-9-]{8,64}$/.test(sessionId) ||
    typeof detail !== "string" ||
    detail.length > 64 ||
    !/^[a-zA-Z0-9_-]*$/.test(detail)
  ) {
    return telemetryResponse(400, origin);
  }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO telemetry_events
      (event_name, session_id, detail)
     VALUES (?, ?, ?)`,
  )
    .bind(eventName, sessionId, detail)
    .run();

  return telemetryResponse(204, origin);
}

function formatDashboardDate(timestamp: number | null): string {
  if (!timestamp) return "No visits yet";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(timestamp * 1000));
}

function renderBars(rows: CountRow[], emptyCopy: string): string {
  if (rows.length === 0) {
    return `<p class="empty">${escapeHtml(emptyCopy)}</p>`;
  }

  const largest = Math.max(...rows.map((row) => row.count), 1);
  return rows
    .map((row) => {
      const width = Math.max(5, Math.round((row.count / largest) * 100));
      return `<div class="bar-row">
        <div class="bar-label"><span>${escapeHtml(row.label)}</span><strong>${row.count}</strong></div>
        <div class="bar-track"><span style="width:${width}%"></span></div>
      </div>`;
    })
    .join("");
}

async function renderInsights(request: Request, env: Env): Promise<Response> {
  const accessError = dashboardAccessError(request, env);
  if (accessError) return accessError;

  const [summaryRow, eventResult, memoryResult, visitResult, recentResult] =
    await Promise.all([
      env.DB.prepare(
        `SELECT
          SUM(CASE WHEN event_name = 'site_entered' THEN 1 ELSE 0 END) AS visits,
          SUM(CASE WHEN event_name = 'site_entered' AND created_at >= unixepoch() - 604800 THEN 1 ELSE 0 END) AS visitsLastSevenDays,
          SUM(CASE WHEN event_name = 'letter_opened' THEN 1 ELSE 0 END) AS letterOpens,
          SUM(CASE WHEN event_name = 'letter_narration_played' THEN 1 ELSE 0 END) AS narrationPlays,
          SUM(CASE WHEN event_name = 'memory_opened' THEN 1 ELSE 0 END) AS memoryOpens,
          SUM(CASE WHEN event_name = 'firefly_clicked' THEN 1 ELSE 0 END) AS fireflyClicks,
          SUM(CASE WHEN event_name = 'memory_walk_completed' THEN 1 ELSE 0 END) AS completedWalks,
          SUM(CASE WHEN event_name = 'wish_sent' THEN 1 ELSE 0 END) AS wishesSent,
          MAX(CASE WHEN event_name = 'site_entered' THEN created_at ELSE NULL END) AS lastVisit
         FROM telemetry_events`,
      ).first<TelemetrySummary>(),
      env.DB.prepare(
        `SELECT event_name AS label, COUNT(*) AS count
         FROM telemetry_events
         GROUP BY event_name
         ORDER BY count DESC, event_name ASC`,
      ).all<CountRow>(),
      env.DB.prepare(
        `SELECT detail AS label, COUNT(*) AS count
         FROM telemetry_events
         WHERE event_name = 'memory_opened' AND detail != ''
         GROUP BY detail
         ORDER BY count DESC, detail ASC`,
      ).all<CountRow>(),
      env.DB.prepare(
        `SELECT strftime('%Y-%m-%d', created_at, 'unixepoch') AS label, COUNT(*) AS count
         FROM telemetry_events
         WHERE event_name = 'site_entered' AND created_at >= unixepoch() - 1209600
         GROUP BY label
         ORDER BY label ASC`,
      ).all<CountRow>(),
      env.DB.prepare(
        `SELECT event_name AS eventName, detail, created_at AS createdAt
         FROM telemetry_events
         ORDER BY created_at DESC, id DESC
         LIMIT 20`,
      ).all<RecentEventRow>(),
    ]);

  const summary: TelemetrySummary = {
    visits: safeNumber(summaryRow?.visits),
    visitsLastSevenDays: safeNumber(summaryRow?.visitsLastSevenDays),
    letterOpens: safeNumber(summaryRow?.letterOpens),
    narrationPlays: safeNumber(summaryRow?.narrationPlays),
    memoryOpens: safeNumber(summaryRow?.memoryOpens),
    fireflyClicks: safeNumber(summaryRow?.fireflyClicks),
    completedWalks: safeNumber(summaryRow?.completedWalks),
    wishesSent: safeNumber(summaryRow?.wishesSent),
    lastVisit: summaryRow?.lastVisit ? safeNumber(summaryRow.lastVisit) : null,
  };
  const revisits = Math.max(0, summary.visits - 1);
  const eventRows = (eventResult.results ?? []).map((row) => ({
    label: EVENT_LABELS[row.label] ?? row.label,
    count: safeNumber(row.count),
  }));
  const memoryRows = (memoryResult.results ?? []).map((row) => ({
    label: MEMORY_LABELS[row.label] ?? row.label,
    count: safeNumber(row.count),
  }));
  const visitRows = (visitResult.results ?? []).map((row) => ({
    label: row.label,
    count: safeNumber(row.count),
  }));
  const recentRows = (recentResult.results ?? []).map((row) => ({
    eventName: row.eventName,
    detail: row.detail,
    createdAt: safeNumber(row.createdAt),
  }));

  const cards = [
    ["Visits", summary.visits, `${revisits} revisit${revisits === 1 ? "" : "s"}`],
    ["Last 7 days", summary.visitsLastSevenDays, "successful entries"],
    ["Letter opens", summary.letterOpens, `${summary.narrationPlays} narration play${summary.narrationPlays === 1 ? "" : "s"}`],
    ["Memories opened", summary.memoryOpens, `${summary.completedWalks} completed walk${summary.completedWalks === 1 ? "" : "s"}`],
    ["Fireflies found", summary.fireflyClicks, "unique per visit"],
    ["Wishes sent", summary.wishesSent, "contents never recorded"],
  ]
    .map(
      ([label, value, note]) => `<article class="metric">
        <span>${escapeHtml(String(label))}</span>
        <strong>${value}</strong>
        <small>${escapeHtml(String(note))}</small>
      </article>`,
    )
    .join("");

  const recentMarkup =
    recentRows.length === 0
      ? '<p class="empty">The first visit will appear here.</p>'
      : `<ol class="timeline">${recentRows
          .map((row) => {
            const detail = row.detail
              ? ` · ${row.eventName === "memory_opened" ? (MEMORY_LABELS[row.detail] ?? row.detail) : row.eventName === "firefly_clicked" ? `Firefly ${row.detail.replace("firefly-", "")}` : row.detail}`
              : "";
            return `<li><span>${escapeHtml(EVENT_LABELS[row.eventName] ?? row.eventName)}${escapeHtml(detail)}</span><time>${escapeHtml(formatDashboardDate(row.createdAt))}</time></li>`;
          })
          .join("")}</ol>`;

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex,nofollow,noarchive" />
      <title>Sanna’s private insights</title>
      <style>
        :root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#171221;color:#fff7ea}
        *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 85% 4%,rgba(119,169,255,.1),transparent 25%),#171221}
        main{width:min(1120px,calc(100% - 32px));margin:auto;padding:64px 0 96px}.eyebrow{color:#ffd166;font-size:.78rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
        h1{max-width:760px;margin:10px 0 12px;font-family:Arial,sans-serif;font-size:clamp(2.7rem,7vw,6.4rem);line-height:.95;letter-spacing:-.04em}.intro{max-width:720px;color:#bfc7df;font-family:Arial,sans-serif;font-size:1.05rem;line-height:1.7}.updated{color:#ffe1a1;margin:26px 0 42px}
        .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.metric,.panel{border:2px solid rgba(255,209,102,.48);background:rgba(11,9,19,.72);box-shadow:6px 6px 0 rgba(0,0,0,.28)}
        .metric{display:grid;gap:8px;padding:24px}.metric>span,.panel h2{color:#ffd166;font-size:.76rem;letter-spacing:.08em;text-transform:uppercase}.metric>strong{font-family:Arial,sans-serif;font-size:clamp(2.3rem,5vw,4rem)}.metric small{color:#929bb7;line-height:1.5}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.panel{padding:26px}.panel h2{margin:0 0 24px}.bar-row{margin:0 0 18px}.bar-label{display:flex;justify-content:space-between;gap:16px;margin-bottom:8px;color:#dfe8ff;font-size:.82rem}.bar-track{height:10px;border:1px solid rgba(255,209,102,.44);background:#231b31}.bar-track span{display:block;height:100%;background:linear-gradient(90deg,#c96868,#ffd166)}
        .timeline{list-style:none;margin:0;padding:0}.timeline li{display:grid;grid-template-columns:1fr auto;gap:14px;padding:12px 0;border-bottom:1px solid rgba(255,225,161,.12);color:#dfe8ff;font-size:.79rem;line-height:1.5}.timeline time{color:#8791ae;text-align:right}.empty{color:#929bb7;line-height:1.6}.privacy{margin-top:26px;color:#8791ae;font-size:.75rem;line-height:1.7}
        .cleared{margin:0 0 28px;padding:16px 18px;border:1px solid rgba(137,221,173,.5);background:rgba(40,105,72,.2);color:#c8f5d8;line-height:1.6}.danger{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:42px;padding:24px;border:1px solid rgba(255,143,143,.26);background:rgba(73,24,35,.18)}.danger h2{margin:0 0 8px;font-family:Arial,sans-serif;font-size:1.18rem}.danger p{max-width:720px;margin:0;color:#929bb7;font-family:Arial,sans-serif;line-height:1.55}.reset-link{flex:0 0 auto;padding:13px 16px;border:1px solid rgba(255,143,143,.62);color:#ffd7d7;text-decoration:none;font-weight:800}.reset-link:hover,.reset-link:focus-visible{background:rgba(255,143,143,.14);outline:2px solid #ffd166;outline-offset:3px}
        @media(max-width:760px){main{padding-top:40px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.grid{grid-template-columns:1fr}.timeline li{grid-template-columns:1fr}.timeline time{text-align:left}}
        @media(max-width:600px){.danger{align-items:stretch;flex-direction:column}.reset-link{text-align:center}}@media(max-width:480px){.metrics{grid-template-columns:1fr}.metric,.panel{padding:20px}}
      </style>
    </head>
    <body>
      <main>
        <p class="eyebrow">For Sanna’s eyes only</p>
        <h1>Little signs that Shadé came home.</h1>
        <p class="intro">A private, anonymous view of visits and moments explored in your little universe. Counting begins with this release.</p>
        ${new URL(request.url).searchParams.get("cleared") === "1" ? '<p class="cleared" role="status">All test data has been cleared. The next successful entry will begin your true count at one.</p>' : ""}
        <p class="updated">Last visit: ${escapeHtml(formatDashboardDate(summary.lastVisit))} ET</p>
        <section class="metrics" aria-label="Key totals">${cards}</section>
        <div class="grid">
          <section class="panel"><h2>What she explored</h2>${renderBars(eventRows, "Her first moment will appear here.")}</section>
          <section class="panel"><h2>Visits · last 14 days</h2>${renderBars(visitRows, "No visits in the last 14 days yet.")}</section>
          <section class="panel"><h2>Memory chapters opened</h2>${renderBars(memoryRows, "No memory chapters opened yet.")}</section>
          <section class="panel"><h2>Recent moments</h2>${recentMarkup}</section>
        </div>
        <p class="privacy">Privacy by design: this dashboard stores random session IDs, event names, optional memory/firefly numbers, and timestamps only. It never stores passcodes, wishes, letter text, IP-derived locations, or device details.</p>
        <section class="danger" aria-labelledby="reset-heading">
          <div><h2 id="reset-heading">Finished testing?</h2><p>Clear every recorded visit and interaction so the next successful entry becomes visit one.</p></div>
          <a class="reset-link" href="/sanna-insights/reset">Reset test data</a>
        </section>
      </main>
    </body>
  </html>`;

  return new Response(html, { headers: privateHeaders() });
}

async function renderResetConfirmation(
  request: Request,
  env: Env,
): Promise<Response> {
  const accessError = dashboardAccessError(request, env);
  if (accessError) return accessError;

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM telemetry_events",
  ).first<{ count: number }>();
  const eventCount = safeNumber(countRow?.count);

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex,nofollow,noarchive" />
      <title>Reset Sanna’s private insights</title>
      <style>
        :root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#171221;color:#fff7ea}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 25%,rgba(201,104,104,.12),transparent 38%),#171221}.card{width:min(680px,100%);padding:clamp(28px,7vw,64px);border:2px solid rgba(255,209,102,.48);background:rgba(11,9,19,.86);box-shadow:8px 8px 0 rgba(0,0,0,.3)}.eyebrow{margin:0;color:#ffd166;font-size:.78rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}h1{margin:14px 0 20px;font-family:Arial,sans-serif;font-size:clamp(2.5rem,8vw,5.2rem);line-height:.95;letter-spacing:-.04em}p{color:#bfc7df;font-family:Arial,sans-serif;font-size:1rem;line-height:1.7}.count{color:#ffe1a1;font-family:inherit;font-weight:800}.actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:32px}.actions form{display:grid}.actions button,.actions a{min-height:52px;display:grid;place-items:center;padding:13px 16px;border:1px solid rgba(255,209,102,.52);font:800 .84rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none;cursor:pointer}.actions button{width:100%;background:#8b3f4f;color:#fff7ea}.actions a{background:#211a2d;color:#fff7ea}.actions button:hover,.actions button:focus-visible,.actions a:hover,.actions a:focus-visible{outline:2px solid #ffd166;outline-offset:3px;filter:brightness(1.12)}.note{margin:18px 0 0;color:#929bb7;font-family:inherit;font-size:.78rem}@media(max-width:520px){.actions{grid-template-columns:1fr}}
      </style>
    </head>
    <body>
      <main class="card">
        <p class="eyebrow">One last check</p>
        <h1>Clear every little footprint?</h1>
        <p>This permanently deletes <span class="count">${eventCount} recorded moment${eventCount === 1 ? "" : "s"}</span>, including all visits and interactions collected so far.</p>
        <p>Nothing from the website itself will be changed. Afterward, the next successful passcode entry starts the true count at one.</p>
        <div class="actions">
          <form method="post" action="/sanna-insights/reset">
            <input type="hidden" name="confirmation" value="clear-all" />
            <button type="submit">Yes, clear all data</button>
          </form>
          <a href="/sanna-insights">Keep my stats</a>
        </div>
        <p class="note">This cannot be undone.</p>
      </main>
    </body>
  </html>`;

  return new Response(html, { headers: privateHeaders() });
}

async function clearTelemetry(request: Request, env: Env): Promise<Response> {
  const accessError = dashboardAccessError(request, env);
  if (accessError) return accessError;

  const requestUrl = new URL(request.url);
  if (request.headers.get("origin") !== requestUrl.origin) {
    return new Response("This reset request was not accepted.", {
      status: 403,
      headers: privateHeaders("text/plain; charset=utf-8"),
    });
  }

  if (
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  ) {
    return new Response("This reset request was not accepted.", {
      status: 415,
      headers: privateHeaders("text/plain; charset=utf-8"),
    });
  }

  const form = await request.formData();
  if (form.get("confirmation") !== "clear-all") {
    return new Response("Confirmation is required.", {
      status: 400,
      headers: privateHeaders("text/plain; charset=utf-8"),
    });
  }

  await env.DB.prepare("DELETE FROM telemetry_events").run();

  return new Response(null, {
    status: 303,
    headers: {
      ...privateHeaders(),
      Location: "/sanna-insights?cleared=1",
    },
  });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/telemetry") {
      if (request.method === "OPTIONS") {
        return telemetryPreflight(request);
      }

      if (request.method === "POST") {
        return recordTelemetry(request, env);
      }
    }

    if (url.pathname === "/sanna-insights" && request.method === "GET") {
      return renderInsights(request, env);
    }

    if (url.pathname === "/sanna-insights/reset") {
      if (request.method === "GET") {
        return renderResetConfirmation(request, env);
      }

      if (request.method === "POST") {
        return clearTelemetry(request, env);
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
