# -*- coding: GBK -*-
import sqlite3
import os
import time

# SQLite file path (absolute). Must match DB_PATH in server.js.
DB_PATH = r"C:\Users\Public\dataview\market_data.db"

# Full stock universe: (code, market, name, sector)
# 169 securities across 7 sectors: Technology, HK/Foreign, Consumer, Medical, New Energy, Cyclical, Broad-based
# Deduplicated from board specification (BIT-33 comment b14a3b96)
UNIVERSE = [
    # 一、科技行业（含ETF与个股）
    ("588000", "SH", "科创50ETF", "科技行业（含ETF与个股）"),
    ("515070", "SH", "人工智能AIETF", "科技行业（含ETF与个股）"),
    ("516630", "SH", "云计算50ETF", "科技行业（含ETF与个股）"),
    ("515050", "SH", "5G通信ETF", "科技行业（含ETF与个股）"),
    ("512480", "SH", "半导体ETF", "科技行业（含ETF与个股）"),
    ("512760", "SH", "芯片ETF", "科技行业（含ETF与个股）"),
    ("159869", "SZ", "游戏ETF", "科技行业（含ETF与个股）"),
    ("516620", "SH", "影视ETF", "科技行业（含ETF与个股）"),
    ("512980", "SH", "传媒ETF", "科技行业（含ETF与个股）"),
    ("562500", "SH", "机器人ETF", "科技行业（含ETF与个股）"),
    ("159807", "SZ", "科技ETF", "科技行业（含ETF与个股）"),
    ("562910", "SH", "高端制造ETF", "科技行业（含ETF与个股）"),
    ("688229", "SH", "博睿数据", "科技行业（含ETF与个股）"),
    ("300418", "SZ", "昆仑万维", "科技行业（含ETF与个股）"),
    ("002558", "SZ", "巨人网络", "科技行业（含ETF与个股）"),
    ("002555", "SZ", "三七互娱", "科技行业（含ETF与个股）"),
    ("300002", "SZ", "神州泰岳", "科技行业（含ETF与个股）"),
    ("002415", "SZ", "海康威视", "科技行业（含ETF与个股）"),
    ("600986", "SH", "浙文互娱", "科技行业（含ETF与个股）"),
    ("300308", "SZ", "中际旭创", "科技行业（含ETF与个股）"),
    ("300502", "SZ", "新易盛", "科技行业（含ETF与个股）"),
    ("603019", "SH", "中科曙光", "科技行业（含ETF与个股）"),
    ("688008", "SH", "澜起科技", "科技行业（含ETF与个股）"),
    ("688111", "SH", "金山办公", "科技行业（含ETF与个股）"),
    ("688256", "SH", "寒武纪-U", "科技行业（含ETF与个股）"),
    ("000938", "SZ", "紫光股份", "科技行业（含ETF与个股）"),
    ("002230", "SZ", "科大讯飞", "科技行业（含ETF与个股）"),
    ("300124", "SZ", "汇川技术", "科技行业（含ETF与个股）"),
    ("300024", "SZ", "机器人", "科技行业（含ETF与个股）"),
    ("002236", "SZ", "大华股份", "科技行业（含ETF与个股）"),
    ("688777", "SH", "中控技术", "科技行业（含ETF与个股）"),
    ("688169", "SH", "石头科技", "科技行业（含ETF与个股）"),
    ("002371", "SZ", "北方华创", "科技行业（含ETF与个股）"),
    ("688981", "SH", "中芯国际", "科技行业（含ETF与个股）"),
    ("000062", "SZ", "深圳华强", "科技行业（含ETF与个股）"),
    ("002185", "SZ", "华天科技", "科技行业（含ETF与个股）"),
    ("688012", "SH", "中微公司", "科技行业（含ETF与个股）"),
    ("688041", "SH", "海光信息", "科技行业（含ETF与个股）"),
    ("000628", "SZ", "高新发展", "科技行业（含ETF与个股）"),
    ("603501", "SH", "豪威集团", "科技行业（含ETF与个股）"),
    ("002475", "SZ", "立讯精密", "科技行业（含ETF与个股）"),
    ("000063", "SZ", "中兴通讯", "科技行业（含ETF与个股）"),
    ("601138", "SH", "工业富联", "科技行业（含ETF与个股）"),
    ("300182", "SZ", "捷成股份", "科技行业（含ETF与个股）"),
    ("300251", "SZ", "光线传媒", "科技行业（含ETF与个股）"),
    ("300413", "SZ", "芒果超媒", "科技行业（含ETF与个股）"),
    ("600637", "SH", "东方明珠", "科技行业（含ETF与个股）"),
    ("002624", "SZ", "完美世界", "科技行业（含ETF与个股）"),
    ("002739", "SZ", "万达电影", "科技行业（含ETF与个股）"),
    ("002027", "SZ", "分众传媒", "科技行业（含ETF与个股）"),
    ("002131", "SZ", "利欧股份", "科技行业（含ETF与个股）"),
    ("002517", "SZ", "恺英网络", "科技行业（含ETF与个股）"),
    ("300058", "SZ", "蓝色光标", "科技行业（含ETF与个股）"),
    ("300766", "SZ", "每日互动", "科技行业（含ETF与个股）"),
    ("600570", "SZ", "恒生电子", "科技行业（含ETF与个股）"),
    ("600206", "SH", "有研新材", "科技行业（含ETF与个股）"),
    ("002241", "SZ", "歌尔股份", "科技行业（含ETF与个股）"),
    ("300039", "SZ", "润和软件", "科技行业（含ETF与个股）"),

    # 二、香港/国外（含ETF）
    ("513100", "SH", "纳指ETF", "香港/国外（含ETF）"),
    ("513130", "SH", "恒生互联网ETF", "香港/国外（含ETF）"),
    ("513330", "SH", "恒生互联网ETF", "香港/国外（含ETF）"),
    ("513050", "SH", "中概互联网ETF", "香港/国外（含ETF）"),
    ("159792", "SZ", "港股通互联网ETF", "香港/国外（含ETF）"),
    ("513180", "SH", "恒生科技指数ETF", "香港/国外（含ETF）"),
    ("159636", "SZ", "港股通科技30ETF", "香港/国外（含ETF）"),
    ("513160", "SH", "港股科技30ETF", "香港/国外（含ETF）"),
    ("159920", "SZ", "恒生ETF", "香港/国外（含ETF）"),
    ("513520", "SH", "日经ETF", "香港/国外（含ETF）"),

    # 三、消费行业（含ETF与个股）
    ("512690", "SH", "酒ETF", "消费行业（含ETF与个股）"),
    ("159928", "SZ", "消费ETF", "消费行业（含ETF与个股）"),
    ("513970", "SH", "恒生消费ETF", "消费行业（含ETF与个股）"),
    ("600519", "SH", "贵州茅台", "消费行业（含ETF与个股）"),
    ("000858", "SZ", "五粮液", "消费行业（含ETF与个股）"),
    ("000568", "SZ", "泸州老窖", "消费行业（含ETF与个股）"),
    ("600809", "SH", "山西汾酒", "消费行业（含ETF与个股）"),
    ("000596", "SZ", "古井贡酒", "消费行业（含ETF与个股）"),
    ("002304", "SZ", "洋河股份", "消费行业（含ETF与个股）"),
    ("600600", "SH", "青岛啤酒", "消费行业（含ETF与个股）"),
    ("603369", "SH", "今世缘", "消费行业（含ETF与个股）"),
    ("603589", "SH", "口子窖", "消费行业（含ETF与个股）"),
    ("600702", "SH", "舍得酒业", "消费行业（含ETF与个股）"),
    ("601689", "SH", "拓普集团", "消费行业（含ETF与个股）"),

    # 四、医药基金（含ETF与个股）
    ("512010", "SH", "医药ETF", "医药基金（含ETF与个股）"),
    ("560080", "SH", "中药ETF", "医药基金（含ETF与个股）"),
    ("512170", "SH", "医疗ETF", "医药基金（含ETF与个股）"),
    ("159992", "SZ", "创新药ETF", "医药基金（含ETF与个股）"),
    ("513120", "SH", "港股创新药ETF", "医药基金（含ETF与个股）"),
    ("000538", "SZ", "云南白药", "医药基金（含ETF与个股）"),
    ("600436", "SH", "片仔癀", "医药基金（含ETF与个股）"),
    ("000423", "SZ", "东阿阿胶", "医药基金（含ETF与个股）"),
    ("600085", "SH", "同仁堂", "医药基金（含ETF与个股）"),
    ("603259", "SH", "药明康德", "医药基金（含ETF与个股）"),
    ("300015", "SZ", "爱尔眼科", "医药基金（含ETF与个股）"),
    ("300760", "SZ", "迈瑞医疗", "医药基金（含ETF与个股）"),
    ("688271", "SH", "联影医疗", "医药基金（含ETF与个股）"),
    ("300896", "SZ", "爱美客", "医药基金（含ETF与个股）"),
    ("600276", "SH", "恒瑞医药", "医药基金（含ETF与个股）"),

    # 五、新能源（含ETF与个股）
    ("159755", "SZ", "电池ETF", "新能源（含ETF与个股）"),
    ("515790", "SH", "光伏ETF", "新能源（含ETF与个股）"),
    ("159806", "SZ", "新能源车ETF", "新能源（含ETF与个股）"),
    ("159790", "SZ", "碳中和ETF", "新能源（含ETF与个股）"),
    ("516110", "SH", "汽车ETF", "新能源（含ETF与个股）"),
    ("002466", "SZ", "天齐锂业", "新能源（含ETF与个股）"),
    ("300014", "SZ", "亿纬锂能", "新能源（含ETF与个股）"),
    ("002460", "SZ", "赣锋锂业", "新能源（含ETF与个股）"),
    ("300750", "SZ", "宁德时代", "新能源（含ETF与个股）"),
    ("002594", "SZ", "比亚迪", "新能源（含ETF与个股）"),
    ("600885", "SH", "宏发股份", "新能源（含ETF与个股）"),
    ("600563", "SH", "法拉电子", "新能源（含ETF与个股）"),
    ("002709", "SZ", "天赐材料", "新能源（含ETF与个股）"),
    ("002738", "SZ", "中矿资源", "新能源（含ETF与个股）"),
    ("002074", "SZ", "国轩高科", "新能源（含ETF与个股）"),
    ("300274", "SZ", "阳光电源", "新能源（含ETF与个股）"),
    ("601012", "SH", "隆基绿能", "新能源（含ETF与个股）"),
    ("000100", "SZ", "TCL科技", "新能源（含ETF与个股）"),
    ("600089", "SH", "特变电工", "新能源（含ETF与个股）"),
    ("600438", "SH", "通威股份", "新能源（含ETF与个股）"),
    ("688223", "SH", "晶科能源", "新能源（含ETF与个股）"),
    ("601877", "SH", "正泰电器", "新能源（含ETF与个股）"),
    ("600900", "SH", "长江电力", "新能源（含ETF与个股）"),
    ("601985", "SH", "中国核电", "新能源（含ETF与个股）"),
    ("600886", "SH", "国投电力", "新能源（含ETF与个股）"),
    ("600732", "SH", "爱旭股份", "新能源（含ETF与个股）"),
    ("002202", "SZ", "金风科技", "新能源（含ETF与个股）"),
    ("600995", "SH", "南网储能", "新能源（含ETF与个股）"),
    ("300763", "SZ", "锦浪科技", "新能源（含ETF与个股）"),
    ("002050", "SZ", "三花智控", "新能源（含ETF与个股）"),
    ("603799", "SH", "华友钴业", "新能源（含ETF与个股）"),
    ("002340", "SZ", "格林美", "新能源（含ETF与个股）"),
    ("300450", "SZ", "先导智能", "新能源（含ETF与个股）"),
    ("000887", "SZ", "中鼎股份", "新能源（含ETF与个股）"),

    # 六、其他周期（含ETF与个股）
    ("512000", "SH", "券商ETF", "其他周期（含ETF与个股）"),
    ("513090", "SH", "香港证券ETF", "其他周期（含ETF与个股）"),
    ("159851", "SZ", "金融科技ETF", "其他周期（含ETF与个股）"),
    ("512800", "SH", "银行ETF", "其他周期（含ETF与个股）"),
    ("515220", "SH", "煤炭ETF", "其他周期（含ETF与个股）"),
    ("159930", "SZ", "能源ETF", "其他周期（含ETF与个股）"),
    ("510880", "SH", "红利ETF", "其他周期（含ETF与个股）"),
    ("518880", "SH", "黄金ETF", "其他周期（含ETF与个股）"),
    ("512400", "SH", "有色金属ETF", "其他周期（含ETF与个股）"),
    ("516780", "SH", "稀土ETF", "其他周期（含ETF与个股）"),
    ("512660", "SH", "军工ETF", "其他周期（含ETF与个股）"),
    ("600030", "SH", "中信证券", "其他周期（含ETF与个股）"),
    ("300059", "SZ", "东方财富", "其他周期（含ETF与个股）"),
    ("600036", "SH", "招商银行", "其他周期（含ETF与个股）"),
    ("601166", "SH", "兴业银行", "其他周期（含ETF与个股）"),
    ("601088", "SH", "中国神华", "其他周期（含ETF与个股）"),
    ("601225", "SH", "陕西煤业", "其他周期（含ETF与个股）"),
    ("600157", "SH", "永泰能源", "其他周期（含ETF与个股）"),
    ("600508", "SH", "上海能源", "其他周期（含ETF与个股）"),
    ("601899", "SH", "紫金矿业", "其他周期（含ETF与个股）"),
    ("601600", "SH", "中国铝业", "其他周期（含ETF与个股）"),
    ("600111", "SH", "北方稀土", "其他周期（含ETF与个股）"),
    ("603993", "SH", "洛阳钼业", "其他周期（含ETF与个股）"),
    ("002716", "SZ", "湖南白银", "其他周期（含ETF与个股）"),
    ("600580", "SH", "卧龙电驱", "其他周期（含ETF与个股）"),
    ("000831", "SZ", "中国稀土", "其他周期（含ETF与个股）"),
    ("002600", "SZ", "领益智造", "其他周期（含ETF与个股）"),
    ("600150", "SH", "中国船舶", "其他周期（含ETF与个股）"),
    ("002625", "SZ", "光启技术", "其他周期（含ETF与个股）"),
    ("002179", "SZ", "中航光电", "其他周期（含ETF与个股）"),
    ("601989", "SH", "中国重工", "其他周期（含ETF与个股）"),
    ("600893", "SH", "航发动力", "其他周期（含ETF与个股）"),

    # 七、宽基金（仅ETF）
    ("159901", "SZ", "深证100ETF", "宽基金（仅ETF）"),
    ("159902", "SZ", "中小100ETF", "宽基金（仅ETF）"),
    ("159781", "SZ", "科创创业ETF", "宽基金（仅ETF）"),
    ("159915", "SZ", "创业板ETF", "宽基金（仅ETF）"),
    ("510300", "SH", "沪深300ETF", "宽基金（仅ETF）"),
    ("510500", "SH", "中证500ETF", "宽基金（仅ETF）"),
]

# MA periods
MA_PERIODS = [5, 10, 20]

# Days of timeseries history to retain
RETENTION_DAYS = 30

def _ensure_db(db_path):
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


def _safe_float(val, default=0.0):
    try:
        return float(val)
    except Exception:
        return default


def _calc_ma(prices, period):
    if len(prices) < period:
        return None
    return sum(prices[-period:]) / period


def _calc_percent_above_ma(close_list, ma_val):
    if not ma_val or not close_list:
        return 0.0
    above = sum(1 for c in close_list if c > ma_val)
    return round(above / len(close_list), 4)


def _total_score(row):
    return sum([
        int(row["greater_m5"]),
        int(row["greater_m10"]),
        int(row["greater_m20"]),
        int(row["greater_m0"]),
    ])


def _purge_old_records(conn, days):
    cutoff = time.strftime(
        "%Y-%m-%d %H:%M:%S",
        time.localtime(time.time() - days * 86400)
    )
    conn.execute("DELETE FROM timeseries WHERE create_time < ?", (cutoff,))


def init(ContextInfo):
    codes = ["{0}.{1}".format(code, mkt) for code, mkt, _, _ in UNIVERSE]
    ContextInfo.set_universe(codes)
    _ensure_db(DB_PATH)
    print("[DataExport] init OK, DB=" + DB_PATH)
    if getattr(ContextInfo, "do_back_test", False):
        print("[DataExport] WARNING: BACKTEST mode - switch to LIVE (run) mode to export real data.")


def handlebar(ContextInfo):
    # do_back_test is True in backtest mode - no live quotes available, skip
    if getattr(ContextInfo, "do_back_test", False):
        return

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

        except Exception as e:
            print("[DataExport] error {0}: {1}".format(full_code, e))

    if not rows:
        print("[DataExport] no data collected, skipping DB write")
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
        print("[DataExport] wrote {0} rows at {1}".format(len(rows), now_str))

    except Exception as e:
        print("[DataExport] DB write error: " + str(e))
