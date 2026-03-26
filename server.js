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
const os = require("os");
const path = require("path");
const url = require("url");

// SQLite support: prefer better-sqlite3, fall back to built-in node:sqlite
const sqliteConnectionFactories = [];
try {
  const BetterSqlite3 = require("better-sqlite3");
  sqliteConnectionFactories.push((dbPath) => new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true }));
} catch (_) {}
try {
  const { DatabaseSync } = require("node:sqlite");
  sqliteConnectionFactories.push((dbPath) => new DatabaseSync(dbPath, { open: true, readOnly: true }));
} catch (_) {}
let activeSqliteFactory = null;

// Path must match DB_PATH in iquant_data_export.py
const DB_PATH = process.env.DB_PATH || "C:\\Users\\Public\\dataview\\market_data.db";

// ─── SQLite Readers ───────────────────────────────────────────────────────────

function openReadOnlyDb() {
  if (activeSqliteFactory) {
    return activeSqliteFactory(DB_PATH);
  }

  for (const factory of sqliteConnectionFactories) {
    try {
      const db = factory(DB_PATH);
      activeSqliteFactory = factory;
      return db;
    } catch (_) {}
  }

  throw new Error("SQLite driver unavailable");
}

function dbAvailable() {
  if (!sqliteConnectionFactories.length) return false;
  try {
    const db = openReadOnlyDb();
    db.close();
    return true;
  } catch (_) {
    return false;
  }
}

function formatExchangeCode(code) {
  const codeStr = String(code || "").trim();
  if (!codeStr) return codeStr;
  if (codeStr.includes(".")) return codeStr;
  if (codeStr.startsWith("6") || codeStr.startsWith("5") || codeStr.startsWith("688")) {
    return `${codeStr}.SH`;
  }
  return `${codeStr}.SZ`;
}

function normalizeIndustry(industry) {
  if (!industry) return "-";
  return String(industry)
    .replace(/^[一二三四五六七八九十]+、/, "")
    .replace(/（仅ETF）/g, "")
    .replace(/（含ETF与个股）/g, "")
    .replace(/（含ETF）/g, "")
    .trim();
}

function normalizeSignal(signal) {
  if (signal === null || signal === undefined) return null;
  const value = String(signal).trim().toUpperCase();
  if (["BUY", "买", "多", "TRUE", "1"].includes(value)) return "BUY";
  if (["SELL", "卖", "空", "FALSE", "0"].includes(value)) return "SELL";
  return value || null;
}

function normalizeBoolean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "买", "多"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "卖", "空"].includes(normalized)) return false;
  return null;
}

function normalizeCode(rawCode) {
  const code = String(rawCode || "").trim();
  if (!code) return code;
  return code.includes(".") ? code.slice(0, code.indexOf(".")) : code;
}

function isTrackedEtfCode(stockCode) {
  const code = formatExchangeCode(stockCode);
  return ETF_CODE_SET.has(code);
}

function roundNumber(value, decimals = 4) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 0;
  return parseFloat(Number(value).toFixed(decimals));
}

function normalizeCountPair(stockCode, totalValue, growthValue, fallbackRatio) {
  const rawTotal = totalValue;
  const rawGrowth = growthValue;
  const hasTotal = rawTotal !== null && rawTotal !== undefined && rawTotal !== "";
  const hasGrowth = rawGrowth !== null && rawGrowth !== undefined && rawGrowth !== "";

  if (!hasTotal && !hasGrowth) {
    return { totalStockCount: null, growthStockCount: null };
  }

  if (!isTrackedEtfCode(stockCode)) {
    return { totalStockCount: null, growthStockCount: null };
  }

  const totalStockCount = Math.max(0, Number(rawTotal) || 0);
  const growthStockCount = hasGrowth
    ? Math.min(totalStockCount, Math.max(0, Number(rawGrowth) || 0))
    : Math.min(totalStockCount, Math.max(0, Math.round((Number(fallbackRatio) || 0) * totalStockCount)));

  return { totalStockCount, growthStockCount };
}

function mapSnapshotRow(row) {
  const stockCode = row.etf_code ?? row.etfCode ?? row.stock_code ?? row.stockCode;
  const { totalStockCount, growthStockCount } = normalizeCountPair(
    stockCode,
    row.total_stock_count ?? row.totalStockCount,
    row.growth_stock_count ?? row.growthStockCount,
    row.m5_percent ?? row.m5Percent
  );
  const totalScore = row.total_score ?? row.totalScore ?? null;
  const buySellSignal = normalizeSignal(
    row.buy_sell_signal
    ?? row.buySellSignal
    ?? row.m5_signal
    ?? row.m5Signal
  ) || (totalScore === null || totalScore === undefined ? null : totalScore >= 4 ? "BUY" : "SELL");
  const stockName = row.etf_name ?? row.etfName ?? row.stock_name ?? row.stockName ?? row.name;
  const createTime = row.create_time ?? row.createTime ?? row.updateTime ?? formatDateTime(new Date());

  return {
    industry: normalizeIndustry(row.industry),
    etfCode: formatExchangeCode(stockCode),
    rawCode: normalizeCode(stockCode),
    etfName: stockName || "-",
    totalScore,
    buySellSignal,
    m5Signal: buySellSignal === "BUY" ? "多" : buySellSignal === "SELL" ? "空" : null,
    greaterThanM5Price: normalizeBoolean(row.greater_m5 ?? row.greaterThanM5Price),
    greaterThanM10Price: normalizeBoolean(row.greater_m10 ?? row.greaterThanM10Price),
    greaterThanM20Price: normalizeBoolean(row.greater_m20 ?? row.greaterThanM20Price),
    greaterThanM0Price: normalizeBoolean(row.greater_m0 ?? row.greaterThanM0Price),
    holdStatus: normalizeBoolean(row.hold_status ?? row.holdStatus),
    m0Percent: roundNumber(row.m0_percent ?? row.m0Percent),
    m5Percent: roundNumber(row.m5_percent ?? row.m5Percent),
    m10Percent: roundNumber(row.m10_percent ?? row.m10Percent),
    m20Percent: roundNumber(row.m20_percent ?? row.m20Percent),
    maMeanRatio: roundNumber(row.ma_mean_ratio ?? row.maMeanRatio),
    growthStockCount,
    totalStockCount,
    latestPrice: row.close ?? row.latestPrice ?? null,
    createTime,
    updateTime: createTime,
  };
}

function buildStatistics(stockDataList, lastUpdateTime) {
  const list = Array.isArray(stockDataList) ? stockDataList : [];
  const aggregated = list.reduce((acc, item) => {
    const totalStockCount = item.totalStockCount === null || item.totalStockCount === undefined
      ? null
      : Math.max(0, Number(item.totalStockCount) || 0);
    const growthStockCount = totalStockCount === null
      ? null
      : Math.min(totalStockCount, Math.max(0, Number(item.growthStockCount) || 0));

    if (totalStockCount === null) {
      return acc;
    }

    acc.growthStockCount += growthStockCount;
    acc.totalStockCount += totalStockCount;
    acc.m5Weighted += (Number(item.m5Percent) || 0) * totalStockCount;
    acc.m10Weighted += (Number(item.m10Percent) || 0) * totalStockCount;
    acc.m20Weighted += (Number(item.m20Percent) || 0) * totalStockCount;
    acc.maMeanWeighted += (Number(item.maMeanRatio) || 0) * totalStockCount;
    return acc;
  }, {
    growthStockCount: 0,
    totalStockCount: 0,
    m5Weighted: 0,
    m10Weighted: 0,
    m20Weighted: 0,
    maMeanWeighted: 0,
  });

  const divisor = aggregated.totalStockCount || 1;
  const m5Percent = aggregated.m5Weighted / divisor;
  const m10Percent = aggregated.m10Weighted / divisor;
  const m20Percent = aggregated.m20Weighted / divisor;
  const maMeanPercent = aggregated.maMeanWeighted / divisor;
  const marketTrend = m5Percent >= 0.5 ? "BUY" : "SELL";

  return {
    lastUpdateTime,
    dataCount: list.length,
    marketTrend,
    m5Percent: roundNumber(m5Percent),
    m10Percent: roundNumber(m10Percent),
    m20Percent: roundNumber(m20Percent),
    maMeanPercent: roundNumber(maMeanPercent),
    growthStockCount: aggregated.growthStockCount,
    totalStockCount: aggregated.totalStockCount,
  };
}

function createSuccessResponse(data) {
  return {
    code: "0",
    msg: "操作成功",
    success: true,
    timestamp: Date.now(),
    data,
  };
}

function createAllDataResponse(stockDataList, lastUpdateTime) {
  return createSuccessResponse({
    dataStatistics: buildStatistics(stockDataList, lastUpdateTime),
    stockDataList,
  });
}

function createTimeseriesCell(row) {
  const mapped = mapSnapshotRow(row);
  return {
    totalScore: mapped.totalScore,
    buySellSignal: mapped.buySellSignal,
    greaterThanM5Price: mapped.greaterThanM5Price,
    greaterThanM10Price: mapped.greaterThanM10Price,
    greaterThanM20Price: mapped.greaterThanM20Price,
    m0Percent: mapped.m0Percent,
    m5Percent: mapped.m5Percent,
    m10Percent: mapped.m10Percent,
    m20Percent: mapped.m20Percent,
    maMeanRatio: mapped.maMeanRatio,
    growthStockCount: mapped.growthStockCount,
    totalStockCount: mapped.totalStockCount,
    latestPrice: mapped.latestPrice,
  };
}

function getAllDataFromDb() {
  const db = openReadOnlyDb();
  try {
    const rows = db.prepare("SELECT * FROM latest_snapshot ORDER BY etf_code").all();
    if (!rows.length) return null;

    const lastUpdateTime = rows[0].create_time;
    const stockDataList = rows.map((row) => mapSnapshotRow(row));

    return createAllDataResponse(stockDataList, lastUpdateTime);
  } finally {
    db.close();
  }
}

function getTimeSeriesDataFromDb(startTimeStr, endTimeStr, page, size) {
  const db = openReadOnlyDb();
  try {
    const start = startTimeStr || new Date(Date.now() - 7 * 86400000).toISOString().replace("T", " ").slice(0, 19);
    const end   = endTimeStr   || new Date().toISOString().replace("T", " ").slice(0, 19);

    const timeColumns = db.prepare(
      "SELECT DISTINCT create_time FROM timeseries WHERE create_time BETWEEN ? AND ? ORDER BY create_time DESC"
    ).all(start, end).map(r => r.create_time.slice(0, 16));

    const allProducts = db.prepare(
      "SELECT etf_code, etf_name, industry, MAX(create_time) AS latest_time FROM timeseries GROUP BY etf_code, etf_name, industry ORDER BY etf_code"
    ).all();
    const total = allProducts.length;
    const totalPages = Math.ceil(total / size) || 1;
    const safePage = Math.max(1, Math.min(page, totalPages));
    const products = allProducts.slice((safePage - 1) * size, safePage * size);
    const codes = products.map(p => p.etf_code);

    const rows = codes.length && timeColumns.length
      ? db.prepare(
          `SELECT * FROM timeseries
           WHERE etf_code IN (${codes.map(() => "?").join(",")})
             AND create_time BETWEEN ? AND ?
           ORDER BY etf_code, create_time DESC`
        ).all(...codes, start, end)
      : [];

    const productRows = products.map((product) => {
      const productCode = product.etf_code;
      const rowRecords = rows.filter((row) => row.etf_code === productCode);
      const timeSeriesData = rowRecords.reduce((acc, row) => {
        acc[row.create_time.slice(0, 16)] = createTimeseriesCell(row);
        return acc;
      }, {});

      return {
        etfCode: formatExchangeCode(product.etf_code),
        industry: normalizeIndustry(product.industry),
        etfName: product.etf_name,
        timeSeriesData,
      };
    });

    return createSuccessResponse({
      timeColumns,
      productRows,
      total,
      page: safePage,
      size,
      totalPages,
      lastUpdateTime: rows[0]?.create_time || formatDateTime(new Date()),
    });
  } finally {
    db.close();
  }
}

const PORT = parseInt(process.env.PORT, 10) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = path.resolve(__dirname);

// ─── Mock Data ──────────────────────────────────────────────────────────────

// Full stock universe: 169 securities across 7 sectors
// Matches UNIVERSE in iquant_data_export.py (BIT-33 comment b14a3b96)
const ETF_LIST = [
  { etfCode: "588000", etfName: "科创50ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "515070", etfName: "人工智能AIETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "516630", etfName: "云计算50ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "515050", etfName: "5G通信ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "512480", etfName: "半导体ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "512760", etfName: "芯片ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "159869", etfName: "游戏ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "516620", etfName: "影视ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "512980", etfName: "传媒ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "562500", etfName: "机器人ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "159807", etfName: "科技ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "562910", etfName: "高端制造ETF", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "688229", etfName: "博睿数据", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300418", etfName: "昆仑万维", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002558", etfName: "巨人网络", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002555", etfName: "三七互娱", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300002", etfName: "神州泰岳", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002415", etfName: "海康威视", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "600986", etfName: "浙文互娱", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300308", etfName: "中际旭创", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300502", etfName: "新易盛", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "603019", etfName: "中科曙光", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "688008", etfName: "澜起科技", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "688111", etfName: "金山办公", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "688256", etfName: "寒武纪-U", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "000938", etfName: "紫光股份", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002230", etfName: "科大讯飞", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300124", etfName: "汇川技术", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300024", etfName: "机器人", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002236", etfName: "大华股份", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "688777", etfName: "中控技术", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "688169", etfName: "石头科技", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002371", etfName: "北方华创", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "688981", etfName: "中芯国际", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "000062", etfName: "深圳华强", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002185", etfName: "华天科技", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "688012", etfName: "中微公司", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "688041", etfName: "海光信息", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "000628", etfName: "高新发展", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "603501", etfName: "豪威集团", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002475", etfName: "立讯精密", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "000063", etfName: "中兴通讯", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "601138", etfName: "工业富联", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300182", etfName: "捷成股份", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300251", etfName: "光线传媒", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300413", etfName: "芒果超媒", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "600637", etfName: "东方明珠", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002624", etfName: "完美世界", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002739", etfName: "万达电影", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002027", etfName: "分众传媒", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002131", etfName: "利欧股份", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002517", etfName: "恺英网络", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300058", etfName: "蓝色光标", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300766", etfName: "每日互动", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "600570", etfName: "恒生电子", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "600206", etfName: "有研新材", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "002241", etfName: "歌尔股份", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "300039", etfName: "润和软件", industry: "一、科技行业（含ETF与个股）" },
  { etfCode: "513100", etfName: "纳指ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "513130", etfName: "恒生互联网ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "513330", etfName: "恒生互联网ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "513050", etfName: "中概互联网ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "159792", etfName: "港股通互联网ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "513180", etfName: "恒生科技指数ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "159636", etfName: "港股通科技30ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "513160", etfName: "港股科技30ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "159920", etfName: "恒生ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "513520", etfName: "日经ETF", industry: "二、香港/国外（含ETF）" },
  { etfCode: "512690", etfName: "酒ETF", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "159928", etfName: "消费ETF", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "513970", etfName: "恒生消费ETF", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "600519", etfName: "贵州茅台", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "000858", etfName: "五粮液", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "000568", etfName: "泸州老窖", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "600809", etfName: "山西汾酒", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "000596", etfName: "古井贡酒", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "002304", etfName: "洋河股份", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "600600", etfName: "青岛啤酒", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "603369", etfName: "今世缘", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "603589", etfName: "口子窖", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "600702", etfName: "舍得酒业", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "601689", etfName: "拓普集团", industry: "三、消费行业（含ETF与个股）" },
  { etfCode: "512010", etfName: "医药ETF", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "560080", etfName: "中药ETF", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "512170", etfName: "医疗ETF", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "159992", etfName: "创新药ETF", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "513120", etfName: "港股创新药ETF", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "000538", etfName: "云南白药", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "600436", etfName: "片仔癀", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "000423", etfName: "东阿阿胶", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "600085", etfName: "同仁堂", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "603259", etfName: "药明康德", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "300015", etfName: "爱尔眼科", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "300760", etfName: "迈瑞医疗", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "688271", etfName: "联影医疗", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "300896", etfName: "爱美客", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "600276", etfName: "恒瑞医药", industry: "四、医药基金（含ETF与个股）" },
  { etfCode: "159755", etfName: "电池ETF", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "515790", etfName: "光伏ETF", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "159806", etfName: "新能源车ETF", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "159790", etfName: "碳中和ETF", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "516110", etfName: "汽车ETF", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "002466", etfName: "天齐锂业", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "300014", etfName: "亿纬锂能", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "002460", etfName: "赣锋锂业", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "300750", etfName: "宁德时代", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "002594", etfName: "比亚迪", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "600885", etfName: "宏发股份", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "600563", etfName: "法拉电子", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "002709", etfName: "天赐材料", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "002738", etfName: "中矿资源", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "002074", etfName: "国轩高科", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "300274", etfName: "阳光电源", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "601012", etfName: "隆基绿能", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "000100", etfName: "TCL科技", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "600089", etfName: "特变电工", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "600438", etfName: "通威股份", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "688223", etfName: "晶科能源", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "601877", etfName: "正泰电器", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "600900", etfName: "长江电力", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "601985", etfName: "中国核电", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "600886", etfName: "国投电力", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "600732", etfName: "爱旭股份", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "002202", etfName: "金风科技", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "600995", etfName: "南网储能", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "300763", etfName: "锦浪科技", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "002050", etfName: "三花智控", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "603799", etfName: "华友钴业", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "002340", etfName: "格林美", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "300450", etfName: "先导智能", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "000887", etfName: "中鼎股份", industry: "五、新能源（含ETF与个股）" },
  { etfCode: "512000", etfName: "券商ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "513090", etfName: "香港证券ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "159851", etfName: "金融科技ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "512800", etfName: "银行ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "515220", etfName: "煤炭ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "159930", etfName: "能源ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "510880", etfName: "红利ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "518880", etfName: "黄金ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "512400", etfName: "有色金属ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "516780", etfName: "稀土ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "512660", etfName: "军工ETF", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "600030", etfName: "中信证券", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "300059", etfName: "东方财富", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "600036", etfName: "招商银行", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "601166", etfName: "兴业银行", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "601088", etfName: "中国神华", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "601225", etfName: "陕西煤业", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "600157", etfName: "永泰能源", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "600508", etfName: "上海能源", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "601899", etfName: "紫金矿业", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "601600", etfName: "中国铝业", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "600111", etfName: "北方稀土", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "603993", etfName: "洛阳钼业", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "002716", etfName: "湖南白银", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "600580", etfName: "卧龙电驱", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "000831", etfName: "中国稀土", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "002600", etfName: "领益智造", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "600150", etfName: "中国船舶", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "002625", etfName: "光启技术", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "002179", etfName: "中航光电", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "601989", etfName: "中国重工", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "600893", etfName: "航发动力", industry: "六、其他周期（含ETF与个股）" },
  { etfCode: "159901", etfName: "深证100ETF", industry: "七、宽基金（仅ETF）" },
  { etfCode: "159902", etfName: "中小100ETF", industry: "七、宽基金（仅ETF）" },
  { etfCode: "159781", etfName: "科创创业ETF", industry: "七、宽基金（仅ETF）" },
  { etfCode: "159915", etfName: "创业板ETF", industry: "七、宽基金（仅ETF）" },
  { etfCode: "510300", etfName: "沪深300ETF", industry: "七、宽基金（仅ETF）" },
  { etfCode: "510500", etfName: "中证500ETF", industry: "七、宽基金（仅ETF）" },
];

const ETF_CODE_SET = new Set(
  ETF_LIST.filter((item) => String(item.etfName || "").includes("ETF")).map((item) => formatExchangeCode(item.etfCode))
);

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
  const trackedEtf = isTrackedEtfCode(etf.etfCode);
  const totalStockCount = trackedEtf
    ? (Math.max(0, Number(etf.totalStockCount) || 0) || randomInt(20, 60))
    : null;
  const growthStockCount = trackedEtf ? randomInt(0, totalStockCount) : null;
  const latestPrice = randomFloat(0.8, 8, 3);

  return {
    industry: normalizeIndustry(etf.industry),
    etfCode: formatExchangeCode(etf.etfCode),
    etfName: etf.etfName,
    totalScore,
    buySellSignal: totalScore >= 4 ? "BUY" : "SELL",
    createTime: timeStr || formatDateTime(new Date()),
    greaterThanM5Price: randomBool(),
    greaterThanM10Price: randomBool(),
    greaterThanM20Price: randomBool(),
    greaterThanM0Price: randomBool(),
    holdStatus: randomBool(),
    m0Percent: randomFloat(0.02, 0.2),
    m5Percent: randomFloat(0.02, 0.2),
    m10Percent: randomFloat(0.02, 0.2),
    m20Percent: randomFloat(0.02, 0.2),
    maMeanRatio: randomFloat(0.02, 0.2),
    growthStockCount,
    totalStockCount,
    latestPrice,
  };
}

function generateAllData() {
  const now = new Date();
  const timeStr = formatDateTime(now);
  const stockDataList = ETF_LIST.map((etf) => generateStockRecord(etf, timeStr));
  return createAllDataResponse(stockDataList, timeStr);
}

function generateTimeSeriesData(startTimeStr, endTimeStr, page, size) {
  const start = startTimeStr ? new Date(startTimeStr.replace(" ", "T")) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = endTimeStr ? new Date(endTimeStr.replace(" ", "T")) : new Date();

  const interval = 2 * 60 * 60 * 1000;
  const timeColumns = [];
  let cursor = new Date(end);
  while (cursor >= start && timeColumns.length < 20) {
    timeColumns.push(formatDateTime(new Date(cursor)).slice(0, 16));
    cursor = new Date(cursor.getTime() - interval);
  }

  const total = ETF_LIST.length;
  const totalPages = Math.ceil(total / size) || 1;
  const safePage = Math.max(1, Math.min(page, totalPages));
  const slicedProducts = ETF_LIST.slice((safePage - 1) * size, safePage * size);

  const productRows = slicedProducts.map((etf) => {
    const timeSeriesData = timeColumns.reduce((acc, tp) => {
      acc[tp] = createTimeseriesCell(
        {
          etf_code: etf.etfCode,
          etf_name: etf.etfName,
          industry: etf.industry,
          total_score: randomInt(0, 5),
          greater_m5: randomBool(),
          greater_m10: randomBool(),
          greater_m20: randomBool(),
          greater_m0: randomBool(),
          hold_status: randomBool(),
          m0_percent: randomFloat(0.02, 0.2),
          m5_percent: randomFloat(0.02, 0.2),
          m10_percent: randomFloat(0.02, 0.2),
          m20_percent: randomFloat(0.02, 0.2),
          ma_mean_ratio: randomFloat(0.02, 0.2),
          growth_stock_count: isTrackedEtfCode(etf.etfCode) ? randomInt(0, 20) : null,
          total_stock_count: isTrackedEtfCode(etf.etfCode) ? randomInt(20, 80) : null,
          close: randomFloat(0.8, 8, 3),
        },
        randomInt(20, 80)
      );
      return acc;
    }, {});

    return {
      etfCode: formatExchangeCode(etf.etfCode),
      industry: normalizeIndustry(etf.industry),
      etfName: etf.etfName,
      timeSeriesData,
    };
  });

  return createSuccessResponse({
    timeColumns,
    productRows,
    total,
    page: safePage,
    size,
    totalPages,
    lastUpdateTime: formatDateTime(new Date()),
  });
}

function getLocalAccessUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.internal || entry.family !== "IPv4") return;
      urls.push(`http://${entry.address}:${port}`);
    });
  });

  return Array.from(new Set(urls));
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
    res.end(JSON.stringify(result));
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
  const normalizedPath = path.normalize(filePath).replace(/^([.][.][/\\])+/, "");
  const fullPath = path.resolve(ROOT_DIR, `.${path.sep}${normalizedPath}`);
  if (!fullPath.startsWith(ROOT_DIR + path.sep) && fullPath !== ROOT_DIR) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("403 Forbidden");
    return;
  }
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

server.listen(PORT, HOST, () => {
  const usingDb = dbAvailable();
  const localUrls = HOST === "0.0.0.0" ? getLocalAccessUrls(PORT) : [`http://${HOST}:${PORT}`];
  console.log(`\n🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`   Data source    : ${usingDb ? "SQLite (" + DB_PATH + ")" : "mock data (iQuant DB not found)"}`);
  console.log(`   Main dashboard : http://${HOST}:${PORT}/`);
  console.log(`   Time series    : http://${HOST}:${PORT}/stockTimeseries.html`);
  console.log(`   API getAllData : http://${HOST}:${PORT}/api/dataApi/getAllData`);
  if (localUrls.length) {
    console.log("   LAN access     :");
    localUrls.forEach((accessUrl) => console.log(`     - ${accessUrl}/`));
  }
  console.log("\n公网访问说明:");
  console.log("   - 当前服务已监听 0.0.0.0，可被同一局域网设备访问");
  console.log("   - 如需公网访问，请在路由器/云防火墙放行并映射该端口，或使用反向代理/内网穿透");
  console.log(`   - 可通过 PORT 环境变量修改端口，例如: PORT=8080 node server.js`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
