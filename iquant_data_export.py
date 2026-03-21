# coding: utf-8
"""
iQuant market data export strategy - runs as background daemon.

Writes ETF/index market data to a local SQLite database on every 1-minute bar.
The Node.js backend reads from SQLite instead of using mock data.

Usage:
  1. Open iQuant client, create a new Python strategy in the strategy editor.
  2. Paste the contents of this file.
  3. Set period to 1 minute, mode to live trading.
  4. Click Run - the strategy runs in the background and writes data every minute.

DB path: DB_PATH (default below, must match server.js DB_PATH)
"""

import sqlite3
import os
import time

# ── Config ────────────────────────────────────────────────────────────────────

# SQLite file path (absolute). Must match DB_PATH in server.js.
DB_PATH = r"C:\Users\Public\dataview\market_data.db"

# ETF universe: (code, market, name, industry)
UNIVERSE = [
    ("510300", "SH", "CSI300ETF",       "broad-index"),
    ("510500", "SH", "CSI500ETF",       "broad-index"),
    ("159915", "SZ", "ChiNextETF",      "chinext"),
    ("512880", "SH", "SecuritiesETF",   "finance"),
    ("512690", "SH", "LiquorETF",       "consumer"),
    ("515080", "SH", "NewEnergyETF",    "new-energy"),
    ("512760", "SH", "ChipETF",         "tech"),
    ("159601", "SZ", "PharmaETF",       "healthcare"),
    ("515030", "SH", "NEVehicleETF",    "new-energy"),
    ("512480", "SH", "SemiETF",         "tech"),
    ("159740", "SZ", "DefenseETF",      "defense"),
    ("512000", "SH", "BrokerETF",       "finance"),
]

# MA periods
MA_PERIODS = [5, 10, 20]

# Days of timeseries history to retain
RETENTION_DAYS = 30

# ── DB init ───────────────────────────────────────────────────────────────────

def _ensure_db(db_path):
    """Create tables if they don't exist (idempotent)."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Latest snapshot: one row per ETF, replaced on every bar
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

    # Timeseries: full history, used by stockTimeseries page
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_float(val, default=0.0):
    try:
        return float(val)
    except Exception:
        return default


def _calc_ma(prices, period):
    """Simple moving average. prices list newest-last. Returns latest MA value."""
    if len(prices) < period:
        return None
    return sum(prices[-period:]) / period


def _calc_percent_above_ma(close_list, ma_val):
    """Fraction of close_list values above ma_val."""
    if not ma_val or not close_list:
        return 0.0
    above = sum(1 for c in close_list if c > ma_val)
    return round(above / len(close_list), 4)


def _total_score(row):
    """Score 0-4 based on how many MA conditions are met."""
    return sum([
        int(row["greater_m5"]),
        int(row["greater_m10"]),
        int(row["greater_m20"]),
        int(row["greater_m0"]),
    ])


def _purge_old_records(conn, days):
    """Delete timeseries rows older than retention_days."""
    cutoff = time.strftime(
        "%Y-%m-%d %H:%M:%S",
        time.localtime(time.time() - days * 86400)
    )
    conn.execute("DELETE FROM timeseries WHERE create_time < ?", (cutoff,))


# ── iQuant strategy entry points ──────────────────────────────────────────────

def init(ContextInfo):
    """Strategy init: set universe and create DB tables."""
    codes = ["{0}.{1}".format(code, mkt) for code, mkt, _, _ in UNIVERSE]
    ContextInfo.set_universe(codes)
    _ensure_db(DB_PATH)


def handlebar(ContextInfo):
    """Called on every bar (1-minute period)."""
    now_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

    rows = []
    close_values = {}

    for code, mkt, name, industry in UNIVERSE:
        full_code = "{0}.{1}".format(code, mkt)

        try:
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
            m0  = sum(closes) / len(closes)

            greater_m5  = current_close > m5  if m5  else False
            greater_m10 = current_close > m10 if m10 else False
            greater_m20 = current_close > m20 if m20 else False
            greater_m0  = current_close > m0

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
                "growth_stock_count": 0,
                "total_stock_count":  len(UNIVERSE),
                "create_time": now_str,
            }
            row["total_score"] = _total_score(row)
            rows.append(row)

        except Exception:
            pass

    if not rows:
        return

    growth_count = sum(1 for r in rows if r["greater_m5"])
    for r in rows:
        r["growth_stock_count"] = growth_count

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

        upsert_sql = "INSERT OR REPLACE INTO latest_snapshot ({0}) VALUES ({1})".format(col_names, placeholders)
        insert_sql = "INSERT INTO timeseries ({0}) VALUES ({1})".format(col_names, placeholders)

        data = [[r[c] for c in cols] for r in rows]
        conn.executemany(upsert_sql, data)
        conn.executemany(insert_sql, data)

        _purge_old_records(conn, RETENTION_DAYS)
        conn.commit()
        conn.close()

    except Exception:
        pass
