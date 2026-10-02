# DOC-A: Real data collection

The runtime entry point is `fetchRawCompany(input)` in `lib/data/fetcher.ts`.
It returns `RawCompanyData` from `lib/types.ts`. The HTTP endpoint is
`GET /api/raw/<stock code or exact A-share short name>`.

No mock, preset company, or pre-fetched JSON is read by this path. A company
must be resolved through Eastmoney's live A-share suggestion API. An unknown
name/code returns 404. If identity resolves but every source fails, the endpoint
returns 503 (`NO_VERIFIED_DATA`).

## Live sources

| Source status | Endpoint | Returned slice |
|---|---|---|
| `eastmoney_financial` | Eastmoney F10 main financial data and cash flow statement | Up to three complete annual `financial.years` records |
| `eastmoney_announcements` | Eastmoney listed-company announcement API | Up to 100 recent announcements with source links |
| `eastmoney_pledge` | Eastmoney datacenter `RPT_CSDC_LIST` (CSDC pledge ratio, the underlying source of akshare `stock_pledge_ratio`) | One `people` pledge event whose `amount` is the pledged-ratio percent |
| `eastmoney_holders` | Eastmoney F10 top-ten holders (`RPT_F10_EH_HOLDERS`, same origin as akshare holder analysis) | Latest-period `shareholders` slice, sorted by ratio desc |
| `gdelt` | GDELT DOC `TimelineTone` and `ArtList` (serialized ≥5s apart with 429 backoff) | Monthly sentiment only when both tone and a headline exist |

All sources use timeouts and return `null` on failure. Each adapter additionally runs under a 6s overall deadline (`ADAPTER_TIMEOUT`) so a slow source — typically GDELT retrying through rate limits — never blocks the page beyond it; the slice is simply omitted and its status recorded `ok:false`. The response omits
unavailable slices and records `ok:false, fallback:false` in `meta.sources`.
`legal` is omitted until a verifiable source supplies records in the
contract's required units. `people` currently carries the CSDC pledge-ratio
event only. `FinancialYear.currentRatio` is optional — banks do not disclose
it, and a missing value must not drop the whole year. `shareholders` (v1.2)
lists top-ten holders with ratio percent, institution flag and report date. Announcement headlines are not treated as
court records or shareholder pledge ratios.

GDELT can be disabled with `GDELT_ENABLED=false`. It is enabled by default,
but if the service is unreachable or has no matching data, `gdelt.ok` is false.
The optional `GDELT_API_URL` override is intended for local integration tests.

## Verify

```bash
npm run dev
curl http://localhost:3000/api/raw/600519
curl http://localhost:3000/api/raw/%E8%B4%B5%E5%B7%9E%E8%8C%85%E5%8F%B0
curl http://localhost:3000/api/raw/not-a-real-company
```

Amounts are in 10,000 CNY. Debt ratios are percentages (for example, `16.42`),
and current ratios are multiples (for example, `5.09`). Dates use `YYYY-MM-DD`.
The separate `scripts/prefetch-akshare.py` utility remains available for
explicit offline exports, but runtime requests do not load its output.
