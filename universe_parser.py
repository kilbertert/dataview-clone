#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parse the board's stock universe comment and generate UNIVERSE list for iquant_data_export.py
"""

# Raw data from board comment (BIT-33, comment b14a3b96)
UNIVERSE_DATA = """
### 一、科技行业（含ETF与个股）
**ETF**：
588000.SH 科创50ETF
515070.SH 人工智能AIETF
516630.SH 云计算50ETF
515050.SH 5G通信ETF
512480.SH 半导体ETF
512760.SH 芯片ETF
159869.SZ 游戏ETF
516620.SH 影视ETF
512980.SH 传媒ETF
562500.SH 机器人ETF
159807.SZ 科技ETF
562910.SH 高端制造ETF

**个股**：
688229.SH 博睿数据
300418.SZ 昆仑万维
002558.SZ 巨人网络
002555.SZ 三七互娱
300002.SZ 神州泰岳
002415.SZ 海康威视
600986.SH 浙文互娱
300308.SZ 中际旭创
300502.SZ 新易盛
603019.SH 中科曙光
688008.SH 澜起科技
688111.SH 金山办公
688256.SH 寒武纪-U
000938.SZ 紫光股份
002230.SZ 科大讯飞
300124.SZ 汇川技术
300024.SZ 机器人
002236.SZ 大华股份
688777.SH 中控技术
688169.SH 石头科技
002371.SZ 北方华创
688981.SH 中芯国际
000062.SZ 深圳华强
002185.SZ 华天科技
688012.SH 中微公司
688041.SH 海光信息
000628.SZ 高新发展
603501.SH 豪威集团
002475.SZ 立讯精密
000063.SZ 中兴通讯
601138.SH 工业富联
300182.SZ 捷成股份
300251.SZ 光线传媒
300413.SZ 芒果超媒
600637.SH 东方明珠
002624.SZ 完美世界
002739.SZ 万达电影
600986.SH 浙文互联
002027.SZ 分众传媒
002131.SZ 利欧股份
002517.SZ 恺英网络
300058.SZ 蓝色光标
300766.SZ 每日互动
600570.SZ 恒生电子
600206.SH 有研新材
002241.SZ 歌尔股份
300039.SZ 润和软件

### 二、香港/国外（含ETF）
**ETF**：
513100.SH 纳指ETF
513130.SH 恒生互联网ETF
513330.SH 恒生互联网ETF
513050.SH 中概互联网ETF
159792.SZ 港股通互联网ETF
513180.SH 恒生科技指数ETF
159636.SZ 港股通科技30ETF
513160.SH 港股科技30ETF
159920.SZ 恒生ETF
513520.SH 日经ETF

### 三、消费行业（含ETF与个股）
**ETF**：
512690.SH 酒ETF
159928.SZ 消费ETF
513970.SH 恒生消费ETF

**个股**：
600519.SH 贵州茅台
000858.SZ 五粮液
000568.SZ 泸州老窖
600809.SH 山西汾酒
000596.SZ 古井贡酒
002304.SZ 洋河股份
600600.SH 青岛啤酒
603369.SH 今世缘
603589.SH 口子窖
600702.SH 舍得酒业
601689.SH 拓普集团

### 四、医药基金（含ETF与个股）
**ETF**：
512010.SH 医药ETF
560080.SH 中药ETF
512170.SH 医疗ETF
159992.SZ 创新药ETF
513120.SH 港股创新药ETF

**个股**：
000538.SZ 云南白药
600436.SH 片仔癀
000423.SZ 东阿阿胶
600085.SH 同仁堂
603259.SH 药明康德
300015.SZ 爱尔眼科
300760.SZ 迈瑞医疗
688271.SH 联影医疗
300896.SZ 爱美客
600276.SH 恒瑞医药

### 五、新能源（含ETF与个股）
**ETF**：
159755.SZ 电池ETF
515790.SH 光伏ETF
159806.SZ 新能源车ETF
159790.SZ 碳中和ETF
516110.SH 汽车ETF

**个股**：
300124.SZ 汇川技术
002466.SZ 天齐锂业
300014.SZ 亿纬锂能
002460.SZ 赣锋锂业
300750.SZ 宁德时代
002594.SZ 比亚迪
600885.SH 宏发股份
600563.SH 法拉电子
002709.SZ 天赐材料
002738.SZ 中矿资源
002074.SZ 国轩高科
300274.SZ 阳光电源
601012.SH 隆基绿能
000100.SZ TCL科技
600089.SH 特变电工
600438.SH 通威股份
688223.SH 晶科能源
601877.SH 正泰电器
600900.SH 长江电力
601985.SH 中国核电
600886.SH 国投电力
600732.SH 爱旭股份
002202.SZ 金风科技
600995.SH 南网储能
300763.SZ 锦浪科技
002050.SZ 三花智控
603799.SH 华友钴业
002340.SZ 格林美
300450.SZ 先导智能
000887.SZ 中鼎股份

### 六、其他周期（含ETF与个股）
**ETF**：
512000.SH 券商ETF
513090.SH 香港证券ETF
159851.SZ 金融科技ETF
512800.SH 银行ETF
515220.SH 煤炭ETF
159930.SZ 能源ETF
510880.SH 红利ETF
518880.SH 黄金ETF
512400.SH 有色金属ETF
516780.SH 稀土ETF
512660.SH 军工ETF

**个股**：
600030.SH 中信证券
300059.SZ 东方财富
600036.SH 招商银行
601166.SH 兴业银行
601088.SH 中国神华
601225.SH 陕西煤业
600157.SH 永泰能源
600508.SH 上海能源
601899.SH 紫金矿业
601600.SH 中国铝业
600111.SH 北方稀土
603993.SH 洛阳钼业
002716.SZ 湖南白银
600580.SH 卧龙电驱
000831.SZ 中国稀土
002600.SZ 领益智造
600150.SH 中国船舶
002625.SZ 光启技术
002179.SZ 中航光电
601989.SH 中国重工
600893.SH 航发动力

### 七、宽基金（仅ETF）
**ETF**：
515050.SH 上证50ETF
159901.SZ 深证100ETF
159902.SZ 中小100ETF
159781.SZ 科创创业ETF
159915.SZ 创业板ETF
510300.SH 沪深300ETF
510500.SH 中证500ETF
"""

def parse_universe():
    """Parse the universe data and return structured list"""
    lines = UNIVERSE_DATA.strip().split('\n')

    universe = []
    current_sector = None
    current_type = None  # 'ETF' or '个股'

    for line in lines:
        line = line.strip()
        if not line or line.startswith('---'):
            continue

        # Sector header
        if line.startswith('###'):
            current_sector = line.replace('###', '').strip()
            continue

        # Type marker
        if line.startswith('**ETF**') or line.startswith('**个股**'):
            if 'ETF' in line:
                current_type = 'ETF'
            else:
                current_type = 'STOCK'
            continue

        # Parse stock/ETF line: "CODE.MARKET NAME"
        parts = line.split()
        if len(parts) >= 2:
            code_market = parts[0]
            name = ' '.join(parts[1:])

            if '.' in code_market:
                code, market = code_market.split('.')
                universe.append({
                    'code': code,
                    'market': market,
                    'name': name,
                    'sector': current_sector,
                    'type': current_type
                })

    return universe

def generate_python_universe(universe):
    """Generate Python UNIVERSE list for iquant_data_export.py"""
    lines = ['UNIVERSE = [']

    # Group by sector
    sectors = {}
    for item in universe:
        sector = item['sector']
        if sector not in sectors:
            sectors[sector] = []
        sectors[sector].append(item)

    for sector, items in sectors.items():
        lines.append(f'    # {sector}')
        for item in items:
            code = item['code']
            market = item['market']
            name = item['name']
            sector_tag = f"{item['type']}-{sector.split('、')[1] if '、' in sector else sector}"
            lines.append(f'    ("{code}", "{market}", "{name}", "{sector_tag}"),')
        lines.append('')

    lines.append(']')
    return '\n'.join(lines)

if __name__ == '__main__':
    universe = parse_universe()
    print(f"Total securities: {len(universe)}")
    print(f"ETFs: {sum(1 for u in universe if u['type'] == 'ETF')}")
    print(f"Stocks: {sum(1 for u in universe if u['type'] == 'STOCK')}")
    print("\nGenerated UNIVERSE:\n")
    print(generate_python_universe(universe))
