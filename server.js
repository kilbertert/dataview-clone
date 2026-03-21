/**
 * Mock backend server for 指数数据监控面板
 *
 * Serves static files and provides two API endpoints:
 *   GET /api/dataApi/getAllData
 *   GET /api/dataApi/getTimeSeriesData?startTime&endTime&page&size
 *
 * Run: node server.js
 * Then open: http://localhost:8000
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// SQLite support (optional — falls back to mock if not available)
let Database;
try { Database = require("better-sqlite3"); } catch (_) {}

// Path must match DB_PATH in iquant_data_export.py
const DB_PATH = process.env.DB_PATH || "C:\\Users\\Public\\dataview\\market_data.db";

const PORT = 8000;

// ─── Mock Data ──────────────────────────────────────────────────────────────

const ETF_LIST = [
  { etfCode: "510300", etfName: "沪深300ETF", industry: "宽基指数" },
  { etfCode: "510500", etfName: "中证500ETF", industry: "宽基指数" },
  { etfCode: "159915", etfName: "创业板ETF", industry: "创业板" },
  { etfCode: "512880", etfName: "证券ETF", industry: "金融" },
  { etfCode: "512690", etfName: "酒ETF", industry: "消费" },
  { etfCode: "515080", etfName: "新能源ETF", industry: "新能源" },
  { etfCode: "512760", etfName: "芯片ETF", industry: "科技" },
  { etfCode: "159601", etfName: "医药ETF", industry: "医疗健康" },
  { etfCode: "515030", etfName: "新能源车ETF", industry: "新能源" },
  { etfCode: "512480", etfName: "半导体ETF", industry: "科技" },
  { etfCode: "159740", etfName: "军工ETF", industry: "军工" },
  { etfCode: "512000", etfName: "券商ETF", industry: "金融" },
];

function randomFloat(min, max, decimals = 4) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomBool() {
  return Math.random() > 0.5;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function generateStockRecord(etf, timeStr) {
  const totalScore = randomInt(0, 5);
  return {
    etfCode: etf.etfCode,
    etfName: etf.etfName,
    industry: etf.industry,
    totalScore,
    createTime: timeStr || formatDateTime(new Date()),
    greaterThanM5Price: randomBool(),
    greaterThanM10Price: randomBool(),
    greaterThanM20Price: randomBool(),
    greaterThanM0Price: randomBool(),
    holdStatus: randomBool(),
    m0Percent: randomFloat(0.2, 0.9),
    m5Percent: randomFloat(0.2, 0.9),
    m10Percent: randomFloat(0.2, 0.9),
    m20Percent: randomFloat(0.2, 0.9),
    maMeanRatio: randomFloat(0.2, 0.9),
    growthStockCount: randomInt(5, 50),
    totalStockCount: randomInt(50, 200),
  };
}

function generateAllData() {
  const now = new Date();
  const timeStr = formatDateTime(now);
  const stockDataList = ETF_LIST.map((etf) => generateStockRecord(etf, timeStr));
  const growthCount = stockDataList.filter((s) => s.greaterThanM5Price).length;

  return {
    dataStatistics: {
      lastUpdateTime: timeStr,
      marketTrend: Math.random() > 0.5 ? "BUY" : "SELL",
      m5Percent: randomFloat(0.3, 0.8),
      m10Percent: randomFloat(0.3, 0.8),
      m20Percent: randomFloat(0.3, 0.8),
      maMeanPercent: randomFloat(0.3, 0.8),
      growthStockCount: growthCount,
      totalStockCount: ETF_LIST.length,
    },
    stockDataList,
  };
}

function generateTimeSeriesData(startTimeStr, endTimeStr, page, size) {
  // Build a list of time points between start and end (every 2 hours, max 20 points)
  const start = startTimeStr ? new Date(startTimeStr.replace(" ", "T")) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = endTimeStr ? new Date(endTimeStr.replace(" ", "T")) : new Date();

  const interval = 2 * 60 * 60 * 1000; // 2 hours
  const allTimePoints = [];
  let cursor = new Date(start);
  while (cursor <= end && allTimePoints.length < 20) {
    allTimePoints.push(formatDateTime(new Date(cursor)));
    cursor = new Date(cursor.getTime() + interval);
  }

  // Paginate products
  const total = ETF_LIST.length;
  const totalPages = Math.ceil(total / size);
  const safePage = Math.max(1, Math.min(page, totalPages));
  const slicedProducts = ETF_LIST.slice((safePage - 1) * size, safePage * size);

  // Generate records for each product × time point
  const records = [];
  slicedProducts.forEach((etf) => {
    allTimePoints.forEach((tp) => {
      records.push(generateStockRecord(etf, tp));
    });
  });

  const lastUpdateTime = formatDateTime(new Date());

  return {
    data: {
      timePoints: allTimePoints,
      products: slicedProducts.map((e) => ({
        etfCode: e.etfCode,
        etfName: e.etfName,
        industry: e.industry,
      })),
      records,
    },
    pagination: {
      page: safePage,
      size,
      total,
      totalPages,
    },
    lastUpdateTime,
  };
}

// ─── Mime Types ──────────────────────────────────────────────────────────────

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// ─── Request Handler ─────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS headers for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── API routes ──────────────────────────────────────────────────────────
  if (pathname === "/api/dataApi/getAllData") {
    const body = JSON.stringify({ data: generateAllData() });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);
    return;
  }

  if (pathname === "/api/dataApi/getTimeSeriesData") {
    const { startTime, endTime } = parsed.query;
    const page = parseInt(parsed.query.page) || 1;
    const size = parseInt(parsed.query.size) || 10;
    const body = JSON.stringify(generateTimeSeriesData(startTime, endTime, page, size));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);
    return;
  }

  // ── Static file serving ─────────────────────────────────────────────────
  let filePath = pathname === "/" ? "/index.html" : pathname;
  // Strip query string from file path
  filePath = filePath.split("?")[0];
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found: " + filePath);
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Mock server running at http://localhost:${PORT}`);
  console.log(`   Main dashboard : http://localhost:${PORT}/`);
  console.log(`   Time series    : http://localhost:${PORT}/stockTimeseries.html`);
  console.log(`   API getAllData  : http://localhost:${PORT}/api/dataApi/getAllData`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
