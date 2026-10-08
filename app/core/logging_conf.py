"""统一日志：控制台 + 文件（data/logs/wms.log，按大小轮转）。

用法：任何模块 `log = logging.getLogger(__name__)` 即可；
关键业务事件（建单/定价/导出/OCR）用 info，异常自动带全栈。
"""
from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path

from . import db as dbm

LOG_DIR = dbm.DATA_DIR / "logs"
LOG_FILE = LOG_DIR / "wms.log"

_FMT = "%(asctime)s %(levelname)-7s [%(name)s] %(message)s"


def setup_logging(level: int = logging.INFO) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    root.setLevel(level)
    if root.handlers:  # 避免重复初始化（uvicorn reload 场景）
        return
    fmt = logging.Formatter(_FMT, datefmt="%Y-%m-%d %H:%M:%S")
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    file_h = logging.handlers.RotatingFileHandler(LOG_FILE, maxBytes=2_000_000, backupCount=5, encoding="utf-8")
    file_h.setFormatter(fmt)
    root.addHandler(console)
    root.addHandler(file_h)
    # 降噪：uvicorn access 已有行级日志，不再重复记通用 INFO
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
