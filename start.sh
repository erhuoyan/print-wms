#!/bin/bash
# 开发机（mac）快速启动。Windows 部署用 start.bat，不要用本脚本。
set -e
cd "$(dirname "$0")"
PY="${PY:-python3}"
if [ ! -d .venv ]; then
  "$PY" -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi
exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
