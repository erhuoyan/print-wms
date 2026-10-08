#!/bin/bash
# 在有外网的机器（如 mac 打包机）运行一次：下载 Windows 离线部署所需的全部内容到 offline/。
# 产物：offline/python-embed.zip（Python 3.12 绿色版）+ offline/wheels/（全部依赖的 win_amd64 wheel）
# 之后把整个 print-wms 文件夹拷到目标 Windows 机，双击 start.bat 即可，全程无需联网。
set -euo pipefail
cd "$(dirname "$0")/.."

PY_VER=3.12.10
EMBED_URL="https://www.python.org/ftp/python/${PY_VER}/python-${PY_VER}-embed-amd64.zip"

mkdir -p offline/wheels
echo "==> 下载 Python ${PY_VER} 绿色嵌入版 ..."
curl -fL -o offline/python-embed.zip "$EMBED_URL"

echo "==> 下载全部依赖的 Windows wheel ..."
pip download -r requirements.txt -d offline/wheels \
  --platform win_amd64 --python-version 3.12 --implementation cp --abi cp312 \
  --only-binary=:all:

echo "==> 完成。offline/ 目录内容："
ls -lh offline offline/wheels
echo "==> 把整个项目文件夹拷到 Windows 目标机，双击 start.bat。"
