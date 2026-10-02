#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cache complete annual A-share financial records for the data adapter.

Usage: python scripts/prefetch-akshare.py 600519 [000001 ...]
Output: data/akshare/<stock code>.json (amounts in 10,000 CNY).
"""

import json
import math
import re
import sys
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "akshare"
AMOUNT_DIVISOR = 10_000


def market_suffix(stock_code: str) -> str:
    if re.fullmatch(r"6\d{5}", stock_code):
        return "SH"
    if re.fullmatch(r"[03]\d{5}", stock_code):
        return "SZ"
    if re.fullmatch(r"[489]\d{5}", stock_code):
        return "BJ"
    raise ValueError(f"不支持的 A 股代码: {stock_code}")


def number(value: object) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def annual_rows(frame: object) -> dict[str, dict]:
    rows = {}
    for row in frame.to_dict("records"):
        date = str(row.get("REPORT_DATE", ""))[:10]
        if re.fullmatch(r"\d{4}-12-31", date):
            rows[date[:4]] = row
    return rows


def map_financial_years(summary: object, balance: object, cash: object) -> list[dict]:
    summary_by_year = annual_rows(summary)
    balance_by_year = annual_rows(balance)
    cash_by_year = annual_rows(cash)
    years = []
    for year in sorted(summary_by_year.keys() & balance_by_year.keys() & cash_by_year.keys()):
        income = summary_by_year[year]
        assets = balance_by_year[year]
        flows = cash_by_year[year]
        revenue = number(income.get("TOTALOPERATEREVE"))
        profit = number(income.get("PARENTNETPROFIT"))
        operating_cash = number(flows.get("NETCASH_OPERATE"))
        total_assets = number(assets.get("TOTAL_ASSETS"))
        liabilities = number(assets.get("TOTAL_LIABILITIES"))
        current_assets = number(assets.get("TOTAL_CURRENT_ASSETS"))
        current_liabilities = number(assets.get("TOTAL_CURRENT_LIAB"))
        values = (revenue, profit, operating_cash, total_assets, liabilities, current_assets, current_liabilities)
        if any(value is None for value in values):
            continue
        if revenue < 0 or total_assets <= 0 or liabilities < 0 or current_assets < 0 or current_liabilities <= 0:
            continue
        years.append({
            "year": year,
            "revenue": round(revenue / AMOUNT_DIVISOR, 2),
            "netProfit": round(profit / AMOUNT_DIVISOR, 2),
            "operatingCashFlow": round(operating_cash / AMOUNT_DIVISOR, 2),
            "debtRatio": round(liabilities / total_assets * 100, 2),
            "currentRatio": round(current_assets / current_liabilities, 2),
        })
    return years[-3:]


def fetch_one(stock_code: str) -> None:
    try:
        import akshare as ak

        suffix = market_suffix(stock_code)
        summary = ak.stock_financial_analysis_indicator_em(symbol=f"{stock_code}.{suffix}")
        balance = ak.stock_balance_sheet_by_yearly_em(symbol=f"{suffix}{stock_code}")
        cash = ak.stock_cash_flow_sheet_by_yearly_em(symbol=f"{suffix}{stock_code}")
        years = map_financial_years(summary, balance, cash)
        if not years:
            print(f"[skip] {stock_code} 没有字段齐全的年度记录")
            return

        name = str(summary.iloc[0].get("SECURITY_NAME_ABBR", "")).strip()
        if not name:
            print(f"[skip] {stock_code} 缺少公司名称")
            return
        payload = {
            "company": {"name": name, "stockCode": f"{stock_code}.{suffix}"},
            "financial": {"years": years},
        }
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output = OUTPUT_DIR / f"{stock_code}.json"
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[ok] {stock_code} -> {output} ({len(years)} 年)")
    except Exception as error:
        print(f"[skip] {stock_code} 拉取失败: {error}")


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: python scripts/prefetch-akshare.py <六位股票代码> [更多代码...]")
        raise SystemExit(2)
    for code in sys.argv[1:]:
        fetch_one(code)


if __name__ == "__main__":
    main()
