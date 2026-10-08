"""离线 OCR：RapidOCR(PP-OCR, onnxruntime) 识别入库单照片 + 启发式字段抽取。

设计原则：OCR 只产"草稿"。印刷体/打印单命中率较高，手写单错误会多，
所以识别结果必须进入表单由人工确认修正后才能保存——即使全错也只是重敲，不会引入错数据。
想换识别引擎（如联网视觉大模型）只需替换 ocr_image()，parse_slip() 不变。
"""
from __future__ import annotations

import re
from pathlib import Path

_engine = None


def ocr_available() -> bool:
    try:
        import rapidocr_onnxruntime  # noqa: F401
        return True
    except Exception:
        return False


def ocr_image(image_path: Path) -> list[dict]:
    """识别一张图，返回 [{text, box:[x1,y1,x2,y2]}, ...]（按出现顺序）。"""
    global _engine
    if _engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _engine = RapidOCR()
    result, _ = _engine(str(image_path))
    if not result:
        return []
    lines = []
    for box, text, score in result:
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        lines.append({"text": str(text), "box": [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))], "score": round(float(score), 3)})
    return lines


_DATE_RE = re.compile(r"(20\d{2})\s*[年\-/\.]\s*(\d{1,2})\s*[月\-/\.]\s*(\d{1,2})\s*日?")
_NO_KEYWORD = re.compile(r"(单号|编号|NO\.?|No\.?)[:：]?\s*(\S*)", re.I)
_SUPPLIER_KEYWORD = re.compile(r"(供应商|厂家|供货商|供货单位|客户)[:：]?\s*(.+)")
_SUPPLIER_GUESS = re.compile(r"(公司|纸业|纸厂|贸易|厂$)")
_SKIP_ROW = re.compile(r"(品名|规格|数量|单价|金额|备注|合计|入库单|单据|型号|单位)")
_ATTR_RE = re.compile(r"^(\d+(?:\.\d+)?)\s*(g|G|克|gsm|g/m2)$")
_SPEC_RE = re.compile(r"^\d+(?:\.\d+)?\s*[xX×*＊/]\s*\d+(?:\.\d+)?")
_QTY_RE = re.compile(r"^(\d+(?:\.\d+)?)\s*(令|张|吨|千克|公斤|kg|KG|卷|箱|桶|包)?$")
_NUM_RE = re.compile(r"^\d+(?:\.\d+)?$")

_NEXT_KW = re.compile(r"(入库人|收货人|经手人|验收人|制单人)")
_UNIT_WORD = re.compile(r"^(令|张|吨|千克|公斤|kg|KG|Kg|卷|箱|桶|包|个|刀)$")

def parse_slip(lines: list[dict]) -> dict:
    """把 OCR 行按 y 坐标聚成"行"，再启发式猜表头和明细行。

    返回 {receipt_no, receipt_date, supplier, items:[{category,name,spec,attr,qty,unit,note}], raw:[原文...]}
    """
    guess: dict = {"receipt_no": "", "receipt_date": "", "supplier": "", "items": [], "raw": []}
    # 按 y 聚行：不同照片竖向偏移不一，阈值取 18px，足以容忍轻微倾斜
    rows: list[list[dict]] = []
    for ln in sorted(lines, key=lambda l: (l["box"][1], l["box"][0])):
        if rows and abs(ln["box"][1] - rows[-1][0]["box"][1]) <= 18:
            rows[-1].append(ln)
        else:
            rows.append([ln])
    for row in rows:
        row.sort(key=lambda l: l["box"][0])
        text = "  ".join(l["text"] for l in row)
        guess["raw"].append(text)

        m = _DATE_RE.search(text)
        if m and not guess["receipt_date"]:
            guess["receipt_date"] = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        m = _NO_KEYWORD.search(text)
        if m and not guess["receipt_no"]:
            tail = m.group(2).strip()
            guess["receipt_no"] = tail if tail else text[m.end():].strip()
        m = _SUPPLIER_KEYWORD.search(text)
        if m and not guess["supplier"]:
            val = m.group(2).strip()
            cut = _NEXT_KW.search(val)  # 同一行常跟着"入库人：xxx"
            if cut:
                val = val[: cut.start()].strip(" ：:,，")
            guess["supplier"] = val
        elif _SUPPLIER_GUESS.search(text) and not guess["supplier"] and "供应商" not in text:
            guess["supplier"] = text.strip()

        if _SKIP_ROW.search(text):
            continue
        tokens = re.split(r"\s+", text.strip())
        if len(tokens) < 2:
            continue
        item = _parse_item_tokens(tokens)
        if item:
            guess["items"].append(item)
    return guess


def _parse_item_tokens(tokens: list[str]) -> dict | None:
    """一行 tokens -> 明细 dict；不满足"名字+数量"特征返回 None。"""
    toks = tokens[:]
    # 行首纯小整数是序号列，直接忽略
    if toks and _NUM_RE.match(toks[0]) and float(toks[0]) < 1000 and len(toks) > 1:
        toks = toks[1:]
    item = {"category": "", "name": "", "spec": "", "attr": "", "qty": "", "unit": "", "note": ""}
    rest: list[str] = []
    # 第一遍：摘出属性(克重)和规格
    for t in toks:
        if _ATTR_RE.match(t) and not item["attr"]:
            item["attr"] = t
        elif _SPEC_RE.match(t) and not item["spec"]:
            item["spec"] = t
        else:
            rest.append(t)
    if not rest:
        return None
    # 第二遍：在剩余 tokens 里挑"数量"——优先带单位的，其次纯数字
    qty_idx = -1
    for i, t in enumerate(rest):
        m = _QTY_RE.match(t)
        if not m:
            continue
        if m.group(2):  # 形如 20令 / 8kg，直接确定
            qty_idx = i
            item["qty"], item["unit"] = m.group(1), m.group(2)
            break
        if _UNIT_WORD.match(t):
            continue
        qty_idx = i
        item["qty"] = m.group(1)
    if qty_idx == -1 or not item["qty"]:
        return None
    # 纯数字数量后面紧跟单位词（"20" "令" 分开识别的情况）
    if not item["unit"] and qty_idx + 1 < len(rest) and _UNIT_WORD.match(rest[qty_idx + 1]):
        item["unit"] = rest[qty_idx + 1]
        rest.pop(qty_idx + 1)
    rest.pop(qty_idx)
    names = [t for t in rest if not _NUM_RE.match(t)]
    if not names:
        return None
    item["name"] = names[0]
    if len(names) > 1:
        item["note"] = " ".join(names[1:])
    return item
