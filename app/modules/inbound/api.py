"""入库模块 JSON API（前端是独立 SPA，这里只出数据）。

权限（服务端强制）：
- 录单/编辑未定价单/查看/导出 → 录入员起
- 定价/改价/作废/价格维护     → 领导起
- 用户管理                    → 管理员

价格：price_history 只追加。定价时带出该物料"最近一次价"作参考，
每次入库价不同是常态，历史可回溯（谁、何时、什么价、哪张单）。
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ...core import auth
from ...core import db as dbm
from . import exporter
from . import ocr as ocrm

log = logging.getLogger("wms.inbound")

router = APIRouter(prefix="/api", tags=["inbound"])

LEADER = auth.require("leader", "admin")
ANY = auth.require("clerk", "leader", "admin")


# ---------- 元数据 ----------

@router.get("/meta")
def meta(user=Depends(ANY)) -> dict:
    conn = dbm.connect()
    try:
        return {
            "user": auth.user_public(user),
            "categories": dbm.list_names(conn, "categories"),
            "units": dbm.list_names(conn, "units"),
            "item_names": [r["name"] for r in conn.execute(
                "SELECT name, MAX(priced_at) AS t FROM price_history GROUP BY name ORDER BY t DESC LIMIT 200")],
        }
    finally:
        conn.close()


# ---------- 单据 ----------

def _receipt_row(conn, rid: int) -> dict:
    r = conn.execute("SELECT * FROM receipts WHERE id=?", (rid,)).fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="单据不存在")
    return dict(r)


def _items(conn, rid: int) -> list[dict]:
    rows = conn.execute("SELECT * FROM items WHERE receipt_id=? ORDER BY seq, id", (rid,)).fetchall()
    return [dict(x) for x in rows]


def _receipt_payload(conn, rid: int, with_suggest: bool = False) -> dict:
    r = _receipt_row(conn, rid)
    items = _items(conn, rid)
    try:
        r["image_paths"] = json.loads(r.get("image_paths") or "[]")
    except ValueError:
        r["image_paths"] = []
    if with_suggest:
        suggests: dict[str, Any] = {}
        for i in items:
            pb = dbm.last_price(conn, i["category"], i["name"], i["spec"], i["attr"])
            if pb:
                suggests[str(i["id"])] = {
                    "price": float(pb["unit_price"]),
                    "priced_at": pb["priced_at"],
                    "priced_by": pb["priced_by"],
                }
        r["suggestions"] = suggests
    r["items"] = items
    return r


@router.get("/receipts")
def list_receipts(status: str = "pending_pricing", user=Depends(ANY)) -> dict:
    conn = dbm.connect()
    try:
        base = """SELECT r.id, r.receipt_no, r.receipt_date, r.supplier, r.status, r.source, r.clerk,
                         (SELECT COUNT(*) FROM items i WHERE i.receipt_id = r.id) AS item_count,
                         (SELECT COUNT(*) FROM items i WHERE i.receipt_id = r.id AND i.unit_price IS NOT NULL) AS priced_count,
                         (SELECT ROUND(SUM(i.qty * i.unit_price), 2) FROM items i WHERE i.receipt_id = r.id) AS total_amount
                  FROM receipts r"""
        if status == "all":
            rows = conn.execute(base + " WHERE r.status != 'void' ORDER BY r.receipt_date DESC, r.id DESC").fetchall()
        elif status == "void":
            rows = conn.execute(base + " WHERE r.status = 'void' ORDER BY r.receipt_date DESC, r.id DESC").fetchall()
        else:
            rows = conn.execute(base + " WHERE r.status = ? ORDER BY r.receipt_date DESC, r.id DESC", (status,)).fetchall()
        counts = {k: 0 for k in ("pending_pricing", "priced", "void", "all")}
        for row in conn.execute("SELECT status, COUNT(*) AS n FROM receipts GROUP BY status"):
            counts[row["status"]] = row["n"]
        counts["all"] = counts["pending_pricing"] + counts["priced"]
        return {"rows": [dict(x) for x in rows], "counts": counts}
    finally:
        conn.close()


def _valid_items(raw: list[dict]) -> list[dict]:
    out = []
    for it in raw or []:
        name = (it.get("name") or "").strip()
        spec = (it.get("spec") or "").strip()
        attr = (it.get("attr") or "").strip()
        if not (name or spec or attr):
            continue
        try:
            qty = float(it.get("qty") or 0)
        except (TypeError, ValueError):
            qty = 0.0
        out.append({
            "category": (it.get("category") or "").strip(),
            "name": name, "spec": spec, "attr": attr,
            "qty": qty, "unit": (it.get("unit") or "").strip(),
            "note": (it.get("note") or "").strip(),
        })
    return out


def _insert_items(conn, rid: int, items: list[dict]) -> None:
    for seq, it in enumerate(items):
        conn.execute(
            """INSERT INTO items(receipt_id, seq, category, name, spec, attr, qty, unit, note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (rid, seq, it["category"], it["name"], it["spec"], it["attr"], it["qty"], it["unit"], it["note"]),
        )


@router.post("/receipts")
def create_receipt(payload: dict, user=Depends(ANY)) -> dict:
    items = _valid_items(payload.get("items"))
    if not items:
        raise HTTPException(status_code=400, detail="至少要有一行明细（品名或规格不能为空）")
    receipt_date = (payload.get("receipt_date") or "").strip()
    if not receipt_date:
        raise HTTPException(status_code=400, detail="请填写入库日期")
    conn = dbm.connect()
    try:
        cur = conn.execute(
            """INSERT INTO receipts(receipt_no, receipt_date, supplier, source, status, clerk, clerk_id,
                                    note, image_paths, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'pending_pricing', ?, ?, ?, ?, ?, ?)""",
            (payload.get("receipt_no", ""), receipt_date, (payload.get("supplier") or "").strip(),
             payload.get("source", "manual"), user["display_name"] or user["username"], user["id"],
             payload.get("note", ""), json.dumps(payload.get("image_paths") or [], ensure_ascii=False),
             dbm.now(), dbm.now()),
        )
        rid = cur.lastrowid
        _insert_items(conn, rid, items)
        dbm.learn_vocab(conn, [i["category"] for i in items], [i["unit"] for i in items])
        conn.commit()
    finally:
        conn.close()
    log.info("建单 #%s by %s: 单号=%s 供应商=%s 明细=%d行 来源=%s",
             rid, user["username"], payload.get("receipt_no") or "-",
             payload.get("supplier") or "-", len(items), payload.get("source", "manual"))
    return {"id": rid}


@router.get("/receipts/{rid}")
def get_receipt(rid: int, user=Depends(ANY)) -> dict:
    conn = dbm.connect()
    try:
        return _receipt_payload(conn, rid, with_suggest=True)
    finally:
        conn.close()


@router.put("/receipts/{rid}")
def update_receipt(rid: int, payload: dict, user=Depends(ANY)) -> dict:
    items = _valid_items(payload.get("items"))
    if not items:
        raise HTTPException(status_code=400, detail="至少要有一行明细")
    conn = dbm.connect()
    try:
        r = _receipt_row(conn, rid)
        if r["status"] == "void":
            raise HTTPException(status_code=400, detail="作废单不能编辑")
        if any(i["unit_price"] is not None for i in _items(conn, rid)):
            raise HTTPException(status_code=400, detail="已有定价的明细，不能编辑")
        images = payload.get("image_paths")
        images_json = json.dumps(images, ensure_ascii=False) if images is not None else r["image_paths"]
        conn.execute(
            """UPDATE receipts SET receipt_no=?, receipt_date=?, supplier=?, note=?,
                                   image_paths=?, updated_at=? WHERE id=?""",
            (payload.get("receipt_no", ""), payload.get("receipt_date", ""),
             (payload.get("supplier") or "").strip(), payload.get("note", ""),
             images_json, dbm.now(), rid),
        )
        conn.execute("DELETE FROM items WHERE receipt_id=?", (rid,))
        _insert_items(conn, rid, items)
        dbm.learn_vocab(conn, [i["category"] for i in items], [i["unit"] for i in items])
        conn.commit()
    finally:
        conn.close()
    log.info("改单 #%s by %s: 明细=%d行", rid, user["username"], len(items))
    return {"id": rid}


@router.delete("/receipts/{rid}")
def delete_receipt(rid: int, user=Depends(auth.require("admin"))) -> dict:
    conn = dbm.connect()
    try:
        _receipt_row(conn, rid)
        conn.execute("DELETE FROM receipts WHERE id=?", (rid,))
        conn.commit()
    finally:
        conn.close()
    log.info("删单 #%s by %s", rid, user["username"])
    return {"ok": True}


@router.post("/receipts/{rid}/void")
def void_receipt(rid: int, user=Depends(LEADER)) -> dict:
    conn = dbm.connect()
    try:
        _receipt_row(conn, rid)
        conn.execute("UPDATE receipts SET status='void', updated_at=? WHERE id=?", (dbm.now(), rid))
        conn.commit()
    finally:
        conn.close()
    log.info("作废 #%s by %s", rid, user["username"])
    return {"ok": True}


@router.post("/receipts/{rid}/restore")
def restore_receipt(rid: int, user=Depends(LEADER)) -> dict:
    conn = dbm.connect()
    try:
        _receipt_row(conn, rid)
        conn.execute("UPDATE receipts SET status='pending_pricing', updated_at=? WHERE id=?", (dbm.now(), rid))
        conn.commit()
    finally:
        conn.close()
    log.info("恢复 #%s by %s", rid, user["username"])
    return {"ok": True}


# ---------- OCR ----------

@router.post("/ocr")
async def api_ocr(files: Annotated[list[UploadFile], File()], user=Depends(ANY)) -> dict:
    if not ocrm.ocr_available():
        raise HTTPException(status_code=500, detail="OCR 组件未安装（rapidocr-onnxruntime）")
    log.info("OCR 请求: %d 张图片 by %s", len(files), user["username"])
    all_lines: list[dict] = []
    saved: list[str] = []
    for f in files:
        data = await f.read()
        if not data:
            continue
        name = f"{uuid.uuid4().hex[:12]}.jpg"
        (dbm.UPLOAD_DIR / name).write_bytes(data)
        saved.append(name)
        try:
            all_lines.extend(ocrm.ocr_image(dbm.UPLOAD_DIR / name))
        except Exception as e:
            log.exception("识别失败: %s", name)
            raise HTTPException(status_code=500, detail=f"识别失败: {e}") from e
    guess = ocrm.parse_slip(all_lines)
    log.info("OCR 完成: %d 行文字, 猜中明细 %d 行", len(all_lines), len(guess["items"]))
    return {"images": saved, "lines": all_lines, "guess": guess}


# ---------- 定价 ----------

@router.post("/pricing")
def save_pricing(payload: dict, user=Depends(LEADER)) -> dict:
    rid = int(payload.get("receipt_id") or 0)
    prices: dict[int, float | None] = {}
    for k, v in (payload.get("prices") or {}).items():
        try:
            item_id = int(k)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"明细 id「{k}」非法")
        s = str(v).strip()
        if s == "":
            prices[item_id] = None
            continue
        try:
            prices[item_id] = round(float(s), 4)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"单价「{s}」不是数字")
    conn = dbm.connect()
    try:
        r = _receipt_row(conn, rid)
        if r["status"] == "void":
            raise HTTPException(status_code=400, detail="作废单不能定价")
        items = _items(conn, rid)
        all_priced = bool(items)
        by = user["display_name"] or user["username"]
        for i in items:
            p = prices.get(i["id"])
            if p is None or p <= 0:
                all_priced = False
                if i["unit_price"] is not None:
                    conn.execute("UPDATE items SET unit_price=NULL, priced_by='', priced_by_id=NULL, priced_at='' WHERE id=?", (i["id"],))
                continue
            changed = i["unit_price"] != p or i["priced_at"] == ""
            conn.execute(
                "UPDATE items SET unit_price=?, priced_by=?, priced_by_id=?, priced_at=? WHERE id=?",
                (p, by, user["id"], dbm.now(), i["id"]),
            )
            if changed:  # 价格历史只追加：改价也留痕
                dbm.add_price(conn, i["category"], i["name"], i["spec"], i["attr"], p, rid, by, user["id"])
        new_status = "priced" if all_priced else "pending_pricing"
        conn.execute("UPDATE receipts SET status=?, updated_at=? WHERE id=?", (new_status, dbm.now(), rid))
        conn.commit()
    finally:
        conn.close()
    log.info("定价 #%s by %s -> %s (%d 项)", rid, by, new_status, len(prices))
    return {"ok": True, "status": new_status}


# ---------- 价格历史 ----------

@router.get("/prices")
def list_prices(name: str = "", category: str = "", limit: int = 200, user=Depends(ANY)) -> dict:
    """价格历史台账：默认按时间倒序；可按品名/类别过滤。"""
    conn = dbm.connect()
    try:
        where, args = [], []
        if name:
            where.append("name LIKE ?")
            args.append(f"%{name}%")
        if category:
            where.append("category = ?")
            args.append(category)
        sql = "SELECT * FROM price_history"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY priced_at DESC, id DESC LIMIT ?"
        rows = [dict(x) for x in conn.execute(sql, (*args, max(1, min(limit, 1000))))]
        return {"rows": rows}
    finally:
        conn.close()


@router.get("/prices/latest")
def latest_prices(limit: int = 300, user=Depends(ANY)) -> dict:
    """每个物料最近一次成交价（定价页参考 & 物料一览）。"""
    conn = dbm.connect()
    try:
        rows = conn.execute(
            """SELECT p.* FROM price_history p
               JOIN (SELECT category, name, spec, attr, MAX(id) AS mid
                     FROM price_history GROUP BY category, name, spec, attr) m
                 ON m.mid = p.id
               ORDER BY p.priced_at DESC LIMIT ?""",
            (max(1, min(limit, 1000)),),
        ).fetchall()
        return {"rows": [dict(x) for x in rows]}
    finally:
        conn.close()


@router.post("/prices")
def add_price(payload: dict, user=Depends(LEADER)) -> dict:
    """手工维护一条价格（领导/管理员）；不覆盖历史，追加一条。"""
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="品名不能为空")
    try:
        price = float(payload.get("unit_price"))
        if price <= 0:
            raise ValueError
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="单价必须是正数")
    conn = dbm.connect()
    try:
        dbm.add_price(conn, (payload.get("category") or "").strip(), name,
                      (payload.get("spec") or "").strip(), (payload.get("attr") or "").strip(),
                      price, None, user["display_name"] or user["username"], user["id"])
        dbm.learn_vocab(conn, [(payload.get("category") or "").strip()], [])
        conn.commit()
    finally:
        conn.close()
    log.info("手工录价 %s %s = %s by %s", name, payload.get("spec", ""), price, user["username"])
    return {"ok": True}


@router.delete("/prices/{pid}")
def delete_price(pid: int, user=Depends(auth.require("admin"))) -> dict:
    conn = dbm.connect()
    try:
        conn.execute("DELETE FROM price_history WHERE id=?", (pid,))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


# ---------- 导出 ----------

@router.get("/export")
def export_xlsx(start: str = "", end: str = "", status: str = "priced", user=Depends(ANY)):
    statuses = [s for s in status.split(",") if s in ("priced", "pending_pricing")]
    if not statuses:
        statuses = ["priced"]
    out = dbm.EXPORT_DIR / exporter.default_export_name()
    conn = dbm.connect()
    try:
        n = exporter.export_xlsx(conn, start, end, statuses, out)
    finally:
        conn.close()
    if n == 0:
        raise HTTPException(status_code=404, detail="所选范围内没有可导出的明细")
    log.info("导出 by %s: [%s~%s] %s -> %s (%d 行)",
             user["username"], start or "不限", end or "不限", statuses, out.name, n)
    return FileResponse(out, filename=out.name,
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
