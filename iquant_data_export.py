# -*- coding: utf-8 -*-
"""
iQuant 行情数据导出策略 — 后台常驻
=====================================
功能：每根 K 线（1分钟）将 ETF/指数行情写入本地 SQLite，
      Node.js 后端读取 SQLite 替换 mock 数据。

使用方法：
  1. 在 iQuant 客户端「策略编辑器」中新建 Python 策略
  2. 将本文件内容粘贴进去
  3. 设置周期为 1分钟，运行模式为「实盘」
  4. 点击「运行」，策略后台常驻，每分钟写入一次数据

数据库路径：DB_PATH（默认与策略同目录，可自行修改）
"""

import sqlite3
import os
import time

# ── 配置 ──────────────────────────────────────────────────────────────────────

# SQLite 文件路径（绝对路径，Node.js 后端需与此一致）
DB_PATH = r"C:\Users\Public\dataview\market_data.db"

# 监控标的列表：(股票代码, 市场, ETF名称, 行业)
UNIVERSE = [
    ("510300", "SH", "沪深300ETF",  "宽基指数"),
    ("510500", "SH", "中证500ETF",  "宽基指数"),
    ("159915", "SZ", "创业板ETF",   "创业板"),
    ("512880", "SH", "证券ETF",     "金融"),
    ("512690", "SH", "酒ETF",       "消费"),
    ("515080", "SH", "新能源ETF",   "新能源"),
    ("512760", "SH", "芯片ETF",     "科技"),
    ("159601", "SZ", "医药ETF",     "医疗健康"),
    ("515030", "SH", "新能源车ETF", "新能源"),
    ("512480", "SH", "半导体ETF",   "科技"),
    ("159740", "SZ", "军工ETF",     "军工"),
    ("512000", "SH", "券商ETF",     "金融"),
]

# MA 周期
MA_PERIODS = [5, 10, 20]

# 时间序列保留天数（超过此天数的旧数据自动清理）
RETENTION_DAYS = 30

# ── 数据库初始化 ───────────────────────────────────────────────────────────────

def _ensure_db(db_path):
    """建表（幂等）"""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 最新快照表（每个标的只保留最新一条）
    c.execute("""
        CREATE TABLE IF NOT EXISTS latest_snapshot (
            etf_code         TEXT PRIMARY KEY,
            etf_name         TEXT,
            industry         TEXT,
            close            REAL,
            m5               REAL,
            m10              REAL,
            m20              REAL,
            m0               REAL,
            greater_m5       INTEGER,
            greater_m10      INTEGER,
            greater_m20      INTEGER,
            greater_m0       INTEGER,
            hold_status      INTEGER,
            m0_percent       REAL,
            m5_percent       REAL,
            m10_percent      REAL,
            m20_percent      REAL,
            ma_mean_ratio    REAL,
            growth_stock_count  INTEGER,
            total_stock_count   INTEGER,
            total_score      INTEGER,
            create_time      TEXT
        )
    """)

    # 时间序列表（历史记录，用于 stockTimeseries 页面）
    c.execute("""
        CREATE TABLE IF NOT EXISTS timeseries (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            etf_code         TEXT,
            etf_name         TEXT,
            industry         TEXT,
            close            REAL,
            m5               REAL,
            m10              REAL,
            m20              REAL,
            m0               REAL,
            greater_m5       INTEGER,
            greater_m10      INTEGER,
            greater_m20      INTEGER,
            greater_m0       INTEGER,
            hold_status      INTEGER,
            m0_percent       REAL,
            m5_percent       REAL,
            m10_percent      REAL,
            m20_percent      REAL,
            ma_mean_ratio    REAL,
            growth_stock_count  INTEGER,
            total_stock_count   INTEGER,
            total_score      INTEGER,
            create_time      TEXT
        )
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_ts_code_time ON timeseries(etf_code, create_time)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_ts_time ON timeseries(create_time)")

    conn.commit()
    conn.close()


# ── 辅助函数 ───────────────────────────────────────────────────────────────────

def _safe_float(val, default=0.0):
    try:
        return float(val)
    except Exception:
        return default


def _calc_ma(prices, period):
    """简单移动平均，prices 为列表（最新在末尾），返回最新 MA 值"""
    if len(prices) < period:
        return None
    return sum(prices[-period:]) / period


def _calc_percent_above_ma(close_list, ma_val):
    """close_list 中高于 ma_val 的比例"""
    if not ma_val or not close_list:
        return 0.0
    above = sum(1 for c in close_list if c > ma_val)
    return round(above / len(close_list), 4)


def _total_score(row):
    """根据 4 个 MA 布尔值计算总分（0-4）"""
    return sum([
        int(row["greater_m5"]),
        int(row["greater_m10"]),
        int(row["greater_m20"]),
        int(row["greater_m0"]),
    ])


def _purge_old_records(conn, days):
    """清理超过 retention_days 的时间序列数据"""
    cutoff = time.strftime(
        "%Y-%m-%d %H:%M:%S",
        time.localtime(time.time() - days * 86400)
    )
    conn.execute("DELETE FROM timeseries WHERE create_time < ?", (cutoff,))


# ── iQuant 策略入口 ────────────────────────────────────────────────────────────

def init(ContextInfo):
    """策略初始化：设置股票池、建库"""
    codes = [f"{code}.{mkt}" for code, mkt, _, _ in UNIVERSE]
    ContextInfo.set_universe(codes)
    _ensure_db(DB_PATH)


def handlebar(ContextInfo):
    """每根 K 线触发（1分钟周期）"""
    now_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

    rows = []
    close_values = {}  # etf_code -> close price（用于统计 growth_stock_count）

    for code, mkt, name, industry in UNIVERSE:
        full_code = f"{code}.{mkt}"

        try:
            # 获取最近 21 根 K 线（够算 MA20）
            df = ContextInfo.get_market_data(
                fields=["close"],
                stock_code=[full_code],
                period="1m",
                count=21,
                dividend_type="none",
                fill_data=True,
            )
            if df is None or df.empty:
                continue

            closes = [_safe_float(v) for v in df["close"].tolist()]
            if not closes:
                continue

            current_close = closes[-1]
            close_values[code] = current_close

            m5  = _calc_ma(closes, 5)
            m10 = _calc_ma(closes, 10)
            m20 = _calc_ma(closes, 20)
            # m0 = 当日开盘均价（用 close 列表均值近似）
            m0  = sum(closes) / len(closes)

            greater_m5  = current_close > m5  if m5  else False
            greater_m10 = current_close > m10 if m10 else False
            greater_m20 = current_close > m20 if m20 else False
            greater_m0  = current_close > m0

            # percent = 该标的 close 列表中高于对应 MA 的比例
            m5_pct  = _calc_percent_above_ma(closes, m5)
            m10_pct = _calc_percent_above_ma(closes, m10)
            m20_pct = _calc_percent_above_ma(closes, m20)
            m0_pct  = _calc_percent_above_ma(closes, m0)
            ma_mean_ratio = round((m5_pct + m10_pct + m20_pct + m0_pct) / 4, 4)

            row = {
                "etf_code":    code,
                "etf_name":    name,
                "industry":    industry,
                "close":       current_close,
                "m5":          m5  or 0.0,
                "m10":         m10 or 0.0,
                "m20":         m20 or 0.0,
                "m0":          m0,
                "greater_m5":  int(greater_m5),
                "greater_m10": int(greater_m10),
                "greater_m20": int(greater_m20),
                "greater_m0":  int(greater_m0),
                "hold_status": int(greater_m5 and greater_m10),
                "m0_percent":  m0_pct,
                "m5_percent":  m5_pct,
                "m10_percent": m10_pct,
                "m20_percent": m20_pct,
                "ma_mean_ratio": ma_mean_ratio,
                "growth_stock_count": 0,   # 填充后更新
                "total_stock_count":  len(UNIVERSE),
                "create_time": now_str,
            }
            row["total_score"] = _total_score(row)
            rows.append(row)

        except Exception as e:
            # 单个标的失败不影响其他标的
            pass

    if not rows:
        return

    # 统计 growth_stock_count（价格高于 MA5 的标的数）
    growth_count = sum(1 for r in rows if r["greater_m5"])
    for r in rows:
        r["growth_stock_count"] = growth_count

    # 写入数据库
    try:
        conn = sqlite3.connect(DB_PATH, timeout=5)

        cols = [
            "etf_code", "etf_name", "industry", "close",
            "m5", "m10", "m20", "m0",
            "greater_m5", "greater_m10", "greater_m20", "greater_m0",
            "hold_status", "m0_percent", "m5_percent", "m10_percent",
            "m20_percent", "ma_mean_ratio", "growth_stock_count",
            "total_stock_count", "total_score", "create_time",
        ]
        placeholders = ", ".join(["?"] * len(cols))
        col_names    = ", ".join(cols)

        upsert_sql = f"""
            INSERT OR REPLACE INTO latest_snapshot ({col_names})
            VALUES ({placeholders})
        """
        insert_sql = f"""
            INSERT INTO timeseries ({col_names})
            VALUES ({placeholders})
        """

        data = [[r[c] for c in cols] for r in rows]
        conn.executemany(upsert_sql, data)
        conn.executemany(insert_sql, data)

        _purge_old_records(conn, RETENTION_DAYS)
        conn.commit()
        conn.close()

    except Exception as e:
        pass  # 写库失败静默，不影响策略运行
