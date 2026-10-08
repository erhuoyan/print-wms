"""认证与授权：登录、会话、角色校验。

权限模型（服务端强制，前端只做展示控制）：
- clerk  录入员：录单 / 编辑未定价单 / 查看 / 导出
- leader 领导　：上述 + 定价 / 改价 / 作废 / 维护价格
- admin  管理员：全部 + 用户管理
"""
from __future__ import annotations

import logging
import sqlite3

from fastapi import Depends, HTTPException, Request

from . import db as dbm

log = logging.getLogger("wms.auth")

COOKIE_NAME = "wms_session"

ROLE_LABELS = dbm.ROLE_LABELS


def current_user(request: Request) -> sqlite3.Row:
    """从会话 cookie 解析当前用户；未登录 401。"""
    token = request.cookies.get(COOKIE_NAME)
    conn = dbm.connect()
    try:
        user = dbm.user_by_session(conn, token)
    finally:
        conn.close()
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    return user


def require(*roles: str):
    """依赖工厂：要求当前用户属于指定角色之一。"""

    def _dep(user: sqlite3.Row = Depends(current_user)) -> sqlite3.Row:
        if user["role"] not in roles:
            allowed = "/".join(ROLE_LABELS.get(r, r) for r in roles)
            raise HTTPException(status_code=403, detail=f"需要{allowed}权限")
        return user

    return _dep


def user_public(user: sqlite3.Row) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "display_name": user["display_name"] or user["username"],
        "role": user["role"],
        "role_label": ROLE_LABELS.get(user["role"], user["role"]),
    }
