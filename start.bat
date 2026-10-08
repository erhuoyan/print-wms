@echo off
chcp 65001 >nul
title 仓库管理
cd /d %~dp0

set "PY=runtime\python.exe"
set "PKGS=runtime\site-packages"

if not exist "%PY%" (
  echo [首次运行] 解压内置 Python ...
  if not exist offline\python-embed.zip (
    echo 错误：找不到 offline\python-embed.zip，请把整个文件夹完整拷贝过来。
    pause & exit /b 1
  )
  mkdir runtime 2>nul
  tar -xf offline\python-embed.zip -C runtime
)

if not exist "%PKGS%\fastapi" (
  echo [首次运行] 离线安装依赖（约 1-3 分钟，只此一次）...
  "%PY%" -m ensurepip 2>nul
  "%PY%" -m pip install --no-index --find-links offline\wheels --target "%PKGS%" -r requirements.txt
  if errorlevel 1 (
    echo 依赖安装失败，请把本窗口截图发给管理员。
    pause & exit /b 1
  )
)

if not exist "app\static\web\index.html" (
  echo 错误：前端文件缺失（app\static\web 为空）。请完整拷贝整个文件夹。
  pause & exit /b 1
)

set "PYTHONPATH=%CD%\%PKGS%;%CD%"
start "" http://127.0.0.1:8000
echo.
echo 服务已启动，浏览器会自动打开 http://127.0.0.1:8000
echo 初始管理员账号 admin / admin123（登录后请立即改密）
echo.
echo 同局域网手机 / 平板访问：http://本机IP:8000 （查 IP：ipconfig）
echo 关闭本窗口即停止服务。
echo.
"%PY%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
