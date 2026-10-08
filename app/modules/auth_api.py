"""认证 API：登录 / 登出 / 当前用户 / 改密 + 管理员用户管理。"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from ..core import auth
from ..core import db as dbm

log = logging.getLogger("wms.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(request: Request, payload: dict):
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="请输入账号和密码")
    conn = dbm.connect()
    try:
        user = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        if user is None or not dbm.verify_password(password, user["password_hash"]):
            log.warning("登录失败: %s", username)
            raise HTTPException(status_code=401, detail="账号或密码错误")
        if not user["active"]:
            raise HTTPException(status_code=403, detail="账号已停用，请联系管理员")
        token = dbm.start_session(conn, user["id"])
        conn.commit()
        data = auth.user_public(user)
    finally:
        conn.close()
    log.info("登录成功: %s (%s)", username, data["role_label"])
    resp = JSONResponse(data)
    resp.set_cookie(auth.COOKIE_NAME, token, max_age=30 * 24 * 3600, httponly=True, samesite="lax")
    return resp


@router.post("/logout")
def logout(request: Request):
    token = request.cookies.get(auth.COOKIE_NAME)
    conn = dbm.connect()
    try:
        dbm.end_session(conn, token)
        conn.commit()
    finally:
        conn.close()
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(auth.COOKIE_NAME)
    return resp


@router.get("/me")
def me(user=Depends(auth.current_user)) -> dict:
    return auth.user_public(user)


@router.post("/password")
def change_password(payload: dict, user=Depends(auth.current_user)):
    old = payload.get("old_password") or ""
    new = payload.get("new_password") or ""
    if len(new) < 6:
        raise HTTPException(status_code=400, detail="新密码至少 6 位")
    conn = dbm.connect()
    try:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        if not dbm.verify_password(old, row["password_hash"]):
            raise HTTPException(status_code=400, detail="原密码不正确")
        dbm.set_password(conn, user["id"], new)
        token = dbm.start_session(conn, user["id"])  # 改密后旧会话已失效，重发一个
        conn.commit()
    finally:
        conn.close()
    resp = JSONResponse({"ok": True})
    resp.set_cookie(auth.COOKIE_NAME, token, max_age=30 * 24 * 3600, httponly=True, samesite="lax")
    return resp


# ---------- 用户管理（仅管理员） ----------

@router.get("/users")
def list_users(_=Depends(auth.require("admin"))) -> dict:
    conn = dbm.connect()
    try:
        rows = conn.execute(
            "SELECT id, username, display_name, role, active, created_at FROM users ORDER BY id"
        ).fetchall()
        return {"rows": [
            {**dict(r), "role_label": dbm.ROLE_LABELS.get(r["role"], r["role"]), "active": bool(r["active"])}
            for r in rows
        ]}
    finally:
        conn.close()


@router.post("/users")
def create_user(payload: dict, _=Depends(auth.require("admin"))):
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    role = payload.get("role") or "clerk"
    if not username or len(password) < 6:
        raise HTTPException(status_code=400, detail="账号必填，密码至少 6 位")
    if role not in dbm.ROLES:
        raise HTTPException(status_code=400, detail="未知角色")
    conn = dbm.connect()
    try:
        if conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
            raise HTTPException(status_code=400, detail="账号已存在")
        uid = dbm.create_user(conn, username, password, payload.get("display_name", ""), role)
        conn.commit()
    finally:
        conn.close()
    log.info("新建用户: %s (%s)", username, role)
    return {"id": uid}


@router.put("/users/{uid}")
def update_user(uid: int, payload: dict, admin=Depends(auth.require("admin"))):
    conn = dbm.connect()
    try:
        row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="用户不存在")
        if payload.get("display_name") is not None:
            conn.execute("UPDATE users SET display_name=? WHERE id=?", (payload["display_name"], uid))
        if payload.get("role") in dbm.ROLES:
            if row["role"] == "admin" and payload["role"] != "admin" and _admin_count(conn) <= 1:
                raise HTTPException(status_code=400, detail="至少保留一名管理员")
            conn.execute("UPDATE users SET role=? WHERE id=?", (payload["role"], uid))
        if payload.get("active") is not None:
            if not payload["active"] and row["role"] == "admin" and _admin_count(conn) <= 1:
                raise HTTPException(status_code=400, detail="至少保留一名启用状态的管理员")
            if not payload["active"] and uid == admin["id"]:
                raise HTTPException(status_code=400, detail="不能停用自己")
            conn.execute("UPDATE users SET active=? WHERE id=?", (1 if payload["active"] else 0, uid))
            if not payload["active"]:
                conn.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
        if payload.get("password"):
            if len(payload["password"]) < 6:
                raise HTTPException(status_code=400, detail="密码至少 6 位")
            dbm.set_password(conn, uid, payload["password"])
        conn.commit()
    finally:
        conn.close()
    log.info("更新用户 #%s: %s", uid, {k: v for k, v in payload.items() if k != "password"})
    return {"ok": True}


@router.delete("/users/{uid}")
def delete_user(uid: int, admin=Depends(auth.require("admin"))):
    conn = dbm.connect()
    try:
        row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="用户不存在")
        if uid == admin["id"]:
            raise HTTPException(status_code=400, detail="不能删除自己")
        if row["role"] == "admin" and _admin_count(conn) <= 1:
            raise HTTPException(status_code=400, detail="至少保留一名管理员")
        conn.execute("DELETE FROM users WHERE id=?", (uid,))
        conn.commit()
    finally:
        conn.close()
    log.info("删除用户 #%s (%s)", uid, row["username"])
    return {"ok": True}


def _admin_count(conn) -> int:
    return conn.execute("SELECT COUNT(*) FROM users WHERE role='admin' AND active=1").fetchone()[0]
