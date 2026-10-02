#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
离线预跑脚本：用 AKShare 拉取 A 股公司财务数据，落地为 data/akshare/<id>.json。

黑客松策略：现场环境不依赖 Python，提前在有网环境跑本脚本，
运行时 lib/data/adapters/akshare.ts 直接读 JSON 文件。

用法：
    pip install akshare
    python scripts/prefetch-akshare.py                # 拉取下方 WATCHLIST 全部
    python scripts/prefetch-akshare.py 600519 000001  # 指定股票代码

输出 JSON 结构（与 RawCompanyData.financial 对齐，金额统一换算为万元）：
    { "financial": { "years": [ { "year", "revenue", "netProfit",
      "operatingCashFlow", "debtRatio", "currentRatio" }, ... ] } }
"""

import json
import sys
from pathlib import Path

# (股票代码, 内部 companyId) —— companyId 即 /report/[id] 与 API 使用的 id
WATCHLIST = [
    ("600519", "moutai"),
    # TODO(feat/data-engine): 按演示需要补充更多公司
]

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "akshare"


def fetch_one(stock_code: str, company_id: str) -> None:
    import akshare as ak  # 延迟导入：无 akshare 环境时其余流程不受影响

    # TODO(feat/data-engine): 下列接口字段名以 akshare 实际返回为准，注意单位换算（元→万元）
    # 参考接口：
    #   ak.stock_financial_abstract_ths(symbol=code)          # 同花顺财务摘要
    #   ak.stock_financial_analysis_indicator(symbol=code)    # 新浪财务指标
    years = []
    try:
        df = ak.stock_financial_analysis_indicator(symbol=stock_code, start_year="2023")
        for _, row in df.tail(3).iterrows():
            years.append(
                {
                    "year": str(row.get("日期", ""))[:4],
                    "revenue": 0,          # TODO: 映射字段并换算万元
                    "netProfit": 0,
                    "operatingCashFlow": 0,
                    "debtRatio": 0.0,
                    "currentRatio": 0.0,
                }
            )
    except Exception as e:  # 单公司失败不阻断其他公司
        print(f"[skip] {stock_code} 拉取失败: {e}")
        return

    if not years:
        print(f"[skip] {stock_code} 无数据")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / f"{company_id}.json"
    out.write_text(json.dumps({"financial": {"years": years}}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] {stock_code} -> {out.relative_to(OUTPUT_DIR.parent.parent)}")


def main() -> None:
    targets = [(code, code) for code in sys.argv[1:]] or WATCHLIST
    for code, company_id in targets:
        fetch_one(code, company_id)


if __name__ == "__main__":
    main()
