"""print-wms 入口：JSON API + 托管前端 SPA 构建产物。

架构：前端是独立 React SPA（web/，vite 构建产物拷到 app/static/web/），
后端只出 /api/*，其余路径回落到 index.html 交给前端路由。

部署：仍为单进程单端口——目标机不需要 Node（前端是已编译好的静态文件），
双击 start.bat 即用；离线部署包只需 Python 绿色版 + 后端 wheel。

鉴权：账号密码登录（users/sessions 表），角色权限由 app/core/auth.py 在各接口强制校验。
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .core import db as dbm
from .core.logging_conf import setup_logging
from .modules import auth_api
from .modules.inbound import api as inbound_api

log = logging.getLogger("wms")

APP_DIR = Path(__file__).resolve().parent
WEB_DIST = APP_DIR / "static" / "web"
INDEX_HTML = WEB_DIST / "index.html"


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    dbm.init_db()
    log.info("启动完成 | 数据库 %s | 前端 %s",
             dbm.DB_PATH, "已构建" if INDEX_HTML.exists() else "未构建（web: npm run build）")
    yield


app = FastAPI(title="print-wms 仓库管理", lifespan=lifespan)
app.include_router(auth_api.router)
app.include_router(inbound_api.router)


if (WEB_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(WEB_DIST / "assets")), name="assets")
app.mount("/uploads", StaticFiles(directory=str(dbm.UPLOAD_DIR)), name="uploads")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str):
    """SPA 回落：非 /api、非静态资源的路径都返回 index.html 交给前端路由。"""
    if full_path.startswith(("api/", "uploads/", "assets/")):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    candidate = WEB_DIST / full_path
    if full_path and candidate.is_file():
        return FileResponse(candidate)
    if INDEX_HTML.exists():
        return FileResponse(INDEX_HTML)
    return JSONResponse(
        {"detail": "前端尚未构建：cd web && npm install && npm run build"},
        status_code=503,
    )
