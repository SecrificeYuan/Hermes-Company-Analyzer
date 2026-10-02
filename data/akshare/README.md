# data/akshare/

离线预跑脚本 `scripts/prefetch-akshare.py` 的输出目录。
可显式运行 `python scripts/prefetch-akshare.py <六位股票代码>` 生成离线快照。
实时 `/api/company/<代码或准确简称>/raw` 不读取本目录，也不使用预设数据。
本目录的 JSON 不进 Git（见 .gitignore）。
