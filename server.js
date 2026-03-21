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

// ─── SQLite Readers ───────────────────────────────────────────────────────────

function dbAvailable() {
  if (!Database) return false;
  try {
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    db.close();
    return true;
  } catch (_) {
    return false;
  }
}

function getAllDataFromDb() {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const rows = db.prepare("SELECT * FROM latest_snapshot ORDER BY etf_code").all();
    if (!rows.length) return null;

    const now = rows[0].create_time;
    const growthCount = rows.filter(r => r.greater_m5).length;
    const m5Avg  = rows.reduce((s, r) => s + r.m5_percent,  0) / rows.length;
    const m10Avg = rows.reduce((s, r) => s + r.m10_percent, 0) / rows.length;
    const m20Avg = rows.reduce((s, r) => s + r.m20_percent, 0) / rows.length;
    const maAvg  = rows.reduce((s, r) => s + r.ma_mean_ratio, 0) / rows.length;

    return {
      dataStatistics: {
        lastUpdateTime: now,
        marketTrend: growthCount > rows.length / 2 ? "BUY" : "SELL",
        m5Percent:      parseFloat(m5Avg.toFixed(4)),
        m10Percent:     parseFloat(m10Avg.toFixed(4)),
        m20Percent:     parseFloat(m20Avg.toFixed(4)),
        maMeanPercent:  parseFloat(maAvg.toFixed(4)),
        growthStockCount: growthCount,
        totalStockCount:  rows.length,
      },
      stockDataList: rows.map(r => ({
        etfCode:           r.etf_code,
        etfName:           r.etf_name,
        industry:          r.industry,
        totalScore:        r.total_score,
        createTime:        r.create_time,
        greaterThanM5Price:  !!r.greater_m5,
        greaterThanM10Price: !!r.greater_m10,
        greaterThanM20Price: !!r.greater_m20,
        greaterThanM0Price:  !!r.greater_m0,
        holdStatus:        !!r.hold_status,
        m0Percent:         r.m0_percent,
        m5Percent:         r.m5_percent,
        m10Percent:        r.m10_percent,
        m20Percent:        r.m20_percent,
        maMeanRatio:       r.ma_mean_ratio,
        growthStockCount:  r.growth_stock_count,
        totalStockCount:   r.total_stock_count,
      })),
    };
  } finally {
    db.close();
  }
}

function getTimeSeriesDataFromDb(startTimeStr, endTimeStr, page, size) {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const start = startTimeStr || new Date(Date.now() - 7 * 86400000).toISOString().replace("T", " ").slice(0, 19);
    const end   = endTimeStr   || new Date().toISOString().replace("T", " ").slice(0, 19);

    // Distinct time points in range
    const timePoints = db.prepare(
      "SELECT DISTINCT create_time FROM timeseries WHERE create_time BETWEEN ? AND ? ORDER BY create_time"
    ).all(start, end).map(r => r.create_time);

    // Distinct products (paginated)
    const allProducts = db.prepare(
      "SELECT DISTINCT etf_code, etf_name, industry FROM timeseries ORDER BY etf_code"
    ).all();
    const total      = allProducts.length;
    const totalPages = Math.ceil(total / size) || 1;
    const safePage   = Math.max(1, Math.min(page, totalPages));
    const products   = allProducts.slice((safePage - 1) * size, safePage * size);
    const codes      = products.map(p => p.etf_code);

    const records = codes.length && timePoints.length
      ? db.prepare(
          `SELECT * FROM timeseries
           WHERE etf_code IN (${codes.map(() => "?").join(",")})
             AND create_time BETWEEN ? AND ?
           ORDER BY etf_code, create_time`
        ).all(...codes, start, end).map(r => ({
          etfCode:           r.etf_code,
          etfName:           r.etf_name,
          industry:          r.industry,
          totalScore:        r.total_score,
          createTime:        r.create_time,
          greaterThanM5Price:  !!r.greater_m5,
          greaterThanM10Price: !!r.greater_m10,
          greaterThanM20Price: !!r.greater_m20,
          greaterThanM0Price:  !!r.greater_m0,
          holdStatus:        !!r.hold_status,
          m0Percent:         r.m0_percent,
          m5Percent:         r.m5_percent,
          m10Percent:        r.m10_percent,
          m20Percent:        r.m20_percent,
          maMeanRatio:       r.ma_mean_ratio,
          growthStockCount:  r.growth_stock_count,
          totalStockCount:   r.total_stock_count,
        }))
      : [];

    return {
      data: { timePoints, products, records },
      pagination: { page: safePage, size, total, totalPages },
      lastUpdateTime: formatDateTime(new Date()),
    };
  } finally {
    db.close();
  }
}

const PORT = 8000;

// ─── Mock Data ──────────────────────────────────────────────────────────────

const ETF_LIST = [
  { etfCode: "300364", etfName: "中文在线",  industry: "512980-传媒ETF" },
  { etfCode: "600986", etfName: "浙文互联",  industry: "512980-传媒ETF" },
  { etfCode: "000156", etfName: "华数传媒",  industry: "512980-传媒ETF" },
  { etfCode: "600977", etfName: "中国电影",  industry: "516620-影视ETF" },
  { etfCode: "300133", etfName: "华策影视",  industry: "516620-影视ETF" },
  { etfCode: "002195", etfName: "岩山科技",  industry: "515070-人工智能ETF" },
  { etfCode: "600633", etfName: "浙数文化",  industry: "159869-游戏ETF" },
  { etfCode: "002436", etfName: "兴森科技",  industry: "512760-芯片ETF" },
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

function getAllData() {
  if (dbAvailable()) {
    try { const r = getAllDataFromDb(); if (r) return r; } catch (_) {}
  }
  return generateAllData();
}

function getTimeSeriesData(startTime, endTime, page, size) {
  if (dbAvailable()) {
    try { const r = getTimeSeriesDataFromDb(startTime, endTime, page, size); if (r) return r; } catch (_) {}
  }
  return generateTimeSeriesData(startTime, endTime, page, size);
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
    let result;
    if (dbAvailable()) {
      try { result = getAllDataFromDb(); } catch (_) {}
    }
    if (!result) result = generateAllData();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: result }));
    return;
  }

  if (pathname === "/api/dataApi/getTimeSeriesData") {
    const { startTime, endTime } = parsed.query;
    const page = parseInt(parsed.query.page) || 1;
    const size = parseInt(parsed.query.size) || 10;
    let result;
    if (dbAvailable()) {
      try { result = getTimeSeriesDataFromDb(startTime, endTime, page, size); } catch (_) {}
    }
    if (!result) result = generateTimeSeriesData(startTime, endTime, page, size);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
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
  const usingDb = dbAvailable();
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   Data source    : ${usingDb ? "SQLite (" + DB_PATH + ")" : "mock data (iQuant DB not found)"}`);
  console.log(`   Main dashboard : http://localhost:${PORT}/`);
  console.log(`   Time series    : http://localhost:${PORT}/stockTimeseries.html`);
  console.log(`   API getAllData  : http://localhost:${PORT}/api/dataApi/getAllData`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
