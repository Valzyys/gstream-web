// ================================================================
//  middleware.js  —  Taruh di ROOT project (sejajar package.json)
//  Vercel Edge Middleware — intercept SEMUA request sebelum
//  sampai ke index.html
//  
//  Cara kerja:
//  Bot/scraper/curl/fetch → langsung dapat BLOCKED_MSG
//  Browser asli          → lanjut ke index.html seperti biasa
// ================================================================

import { NextResponse } from "next/server";

const BLOCKED_MSG = "lu ngapain kocak ini udah di secure sama JKT48Connect";

// ── Bot User-Agent patterns ──────────────────────────────────────
const BOT_UA = [
  "headless", "phantomjs", "selenium", "puppeteer", "playwright",
  "webdriver", "scrapy", "wget", "python-requests", "python-urllib",
  "python-httpx", "axios/", "node-fetch", "node-http", "got/",
  "httpie", "pycurl", "aiohttp", "httpx", "curl/", "libwww",
  "lwp-", "java/", "apache-httpclient", "go-http-client",
  "okhttp", "guzzlehttp", "faraday", "rest-client",
  "postmanruntime", "insomnia", "dart/", "reactor-netty",
  "zgrab", "masscan", "nikto", "sqlmap", "nmap",
  "dotbot", "semrushbot", "ahrefsbot", "mj12bot",
  "bingbot", "googlebot", "yandexbot", "baiduspider",
  "facebookexternalhit", "twitterbot", "slackbot",
  "discordbot", "telegrambot", "whatsapp",
  "mechanize", "scrapy", "casperjs", "zombie",
  "nightmare", "electron/", "phantomas",
];

// ── Allowed origins ───────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://gstreamlive.com",
  "https://www.gstreamlive.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
];

// ── Suspicious path patterns ──────────────────────────────────────
const SUSPICIOUS_PATHS = [
  /\.env/i, /\.git/i, /\.htaccess/i, /\.htpasswd/i,
  /wp-admin/i, /wp-login/i, /wp-config/i, /phpmyadmin/i,
  /adminer/i, /\/etc\/passwd/i, /\/etc\/shadow/i,
  /backup\.(zip|sql|tar|gz)/i, /dump\.sql/i,
  /config\.(json|yml|yaml|php|env)/i,
  /eval\(/i, /base64_decode/i,
  /union.*select/i, /select.*from/i, /drop.*table/i,
  /<script/i, /javascript:/i, /onerror=/i, /onload=/i,
  /\.php$/i, /\.asp$/i, /\.aspx$/i, /\.jsp$/i, /\.cgi$/i,
  /\/proc\//i, /\/sys\//i,
];

// ── Helper: kirim blocked response ───────────────────────────────
function blocked(reason) {
  return new Response(BLOCKED_MSG, {
    status:  200,  // tetap 200 supaya scraper tidak tau diblokir
    headers: {
      "Content-Type":             "text/plain; charset=utf-8",
      "X-Robots-Tag":             "noindex, nofollow, noarchive, nosnippet",
      "Cache-Control":            "no-store, no-cache",
      "X-Content-Type-Options":   "nosniff",
      "X-Frame-Options":          "DENY",
      "X-Blocked-Reason":         reason,
    },
  });
}

// ── Helper: cek apakah Accept header seperti browser ─────────────
function hasBrowserAccept(accept) {
  if (!accept) return false;
  return accept.includes("text/html") || accept.includes("*/*");
}

// ── Rate limiter (in-memory per edge instance) ────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT   = 100;
const RATE_WINDOW  = 60_000; // 1 menit

function isRateLimited(ip) {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip) ?? { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) { entry.count = 1; entry.start = now; }
  else entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

// ================================================================
//  MAIN MIDDLEWARE
// ================================================================
export function middleware(request) {
  const { pathname, search } = request.nextUrl ?? new URL(request.url);
  const url      = pathname + search;
  const ua       = (request.headers.get("user-agent") ?? "").toLowerCase();
  const origin   = request.headers.get("origin")   ?? "";
  const accept   = request.headers.get("accept")   ?? "";
  const method   = request.method;
  const ip       = request.headers.get("x-forwarded-for")?.split(",")[0].trim()
                ?? request.headers.get("x-real-ip")
                ?? "unknown";

  // ── 1. Tanpa User-Agent sama sekali → bot/curl ──────────────────
  if (!ua.trim()) return blocked("no-ua");

  // ── 2. UA mengandung pola bot/scraper ───────────────────────────
  if (BOT_UA.some((p) => ua.includes(p))) return blocked("bot-ua");

  // ── 3. Path mencurigakan (probe sensitif / injeksi) ─────────────
  if (SUSPICIOUS_PATHS.some((p) => p.test(url))) return blocked("suspicious-path");

  // ── 4. Rate limit ────────────────────────────────────────────────
  if (isRateLimited(ip)) {
    return new Response(BLOCKED_MSG, {
      status: 429,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After":  "60",
      },
    });
  }

  // ── 5. Cross-origin dari domain asing ───────────────────────────
  if (origin && !ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o))) {
    return blocked("unknown-origin");
  }

  // ── 6. Request ke halaman HTML tapi tidak ada Accept: text/html ─
  //    curl, wget, axios tanpa config tidak kirim Accept: text/html
  const isAsset = /\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot|map|webp|avif|json|txt)$/.test(pathname);
  if (method === "GET" && !isAsset && !pathname.startsWith("/api/")) {
    if (!hasBrowserAccept(accept)) return blocked("no-html-accept");
  }

  // ── 7. sec-fetch-site: cross-site dari origin asing ─────────────
  const secFetchSite = request.headers.get("sec-fetch-site") ?? "";
  const secFetchMode = request.headers.get("sec-fetch-mode") ?? "";
  if (secFetchSite === "cross-site" && origin) {
    const isAllowedOrigin = ALLOWED_ORIGINS.some(
      (o) => origin === o || origin.startsWith(o)
    );
    if (!isAllowedOrigin) return blocked("cross-site-foreign");
  }

  // ── 8. Tambah security headers ke semua response ─────────────────
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options",  "nosniff");
  response.headers.set("X-Frame-Options",          "DENY");
  response.headers.set("X-XSS-Protection",         "1; mode=block");
  response.headers.set("Referrer-Policy",          "strict-origin-when-cross-origin");
  response.headers.set("X-Robots-Tag",             "index, follow");

  return response;
}

// ── Matcher: jalankan middleware di SEMUA route ───────────────────
export const config = {
  matcher: [
    // Semua route kecuali _next internal Vercel
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
