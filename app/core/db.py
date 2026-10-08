"""SQLite 数据层：建表、用户与会话、字典维护、价格历史。

只用标准库 sqlite3，Windows 绿色部署零额外依赖。
物料维度(类别/品名/规格/属性)全部存为文本，不追求范式化——
印刷厂物料命名本身就乱，强约束反而录不进去，靠「价格历史」做软归一。

价格设计：同一物料每次入库价都可能不同，所以 price_history 只追加不覆盖；
定价时带出的是"该物料最近一次价"作参考，而不是唯一当前价。
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
EXPORT_DIR = DATA_DIR / "exports"
for _d in (DATA_DIR, UPLOAD_DIR, EXPORT_DIR):
    _d.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "wms.db"

SCHEMA = """\
-- 用户：clerk 录入员 / leader 领导 / admin 管理员
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'clerk',
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL
);

-- 会话：登录后签发 token，存 cookie；退出/改密即失效
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
);

-- 单据状态机: pending_pricing(待定价) -> priced(已定价) ; void(作废，终态)
CREATE TABLE IF NOT EXISTS receipts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no   TEXT NOT NULL DEFAULT '',
    receipt_date TEXT NOT NULL DEFAULT '',
    supplier     TEXT NOT NULL DEFAULT '',
    source       TEXT NOT NULL DEFAULT 'manual',  -- manual 手工录入 | ocr 拍照识别
    status       TEXT NOT NULL DEFAULT 'pending_pricing',
    clerk        TEXT NOT NULL DEFAULT '',        -- 录入人姓名（快照）
    clerk_id     INTEGER,                         -- 录入人账号
    note         TEXT NOT NULL DEFAULT '',
    image_paths  TEXT NOT NULL DEFAULT '[]',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

-- 单据明细；单价/定价人由领导在定价环节补全
CREATE TABLE IF NOT EXISTS items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    seq        INTEGER NOT NULL DEFAULT 0,
    category   TEXT NOT NULL DEFAULT '',
    name       TEXT NOT NULL DEFAULT '',
    spec       TEXT NOT NULL DEFAULT '',
    attr       TEXT NOT NULL DEFAULT '',
    qty        REAL  NOT NULL DEFAULT 0,
    unit       TEXT NOT NULL DEFAULT '',
    unit_price REAL,                       -- NULL = 未定价
    priced_by  TEXT NOT NULL DEFAULT '',
    priced_by_id INTEGER,
    priced_at  TEXT NOT NULL DEFAULT '',
    note       TEXT NOT NULL DEFAULT ''
);

-- 价格历史：只追加。同物料不同批次价格自然不同，保留每次记录可回溯
CREATE TABLE IF NOT EXISTS price_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    category   TEXT NOT NULL DEFAULT '',
    name       TEXT NOT NULL DEFAULT '',
    spec       TEXT NOT NULL DEFAULT '',
    attr       TEXT NOT NULL DEFAULT '',
    unit_price REAL NOT NULL,
    receipt_id INTEGER,                    -- 来源单据（手工维护时为 NULL）
    priced_by  TEXT NOT NULL DEFAULT '',
    priced_by_id INTEGER,
    priced_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_history_key
    ON price_history(category, name, spec, attr, priced_at DESC);

CREATE TABLE IF NOT EXISTS categories (name TEXT PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS units      (name TEXT PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0);
"""

DEFAULT_CATEGORIES = ["纸张", "油墨", "版材", "辅料"]
DEFAULT_UNITS = ["令", "张", "吨", "千克", "卷", "箱", "桶", "包"]

ROLES = ("clerk", "leader", "admin")
ROLE_LABELS = {"clerk": "录入员", "leader": "领导", "admin": "管理员"}


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# 增量迁移：老库升级时补列 / 搬数据（SQLite ADD COLUMN 不动数据）
_COLUMN_MIGRATIONS: list[tuple[str, str, str]] = [
    ("receipts", "clerk_id", "INTEGER"),
    ("items", "priced_by_id", "INTEGER"),
]


def _migrate(conn: sqlite3.Connection) -> None:
    for table, column, decl in _COLUMN_MIGRATIONS:
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        if cols and column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")
    # 旧版 price_book（覆盖式当前价）→ price_history（追加式台账），老数据标为手工录入
    tables = {r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "price_book" in tables:
        conn.execute(
            """INSERT INTO price_history(category, name, spec, attr, unit_price, receipt_id,
                                         priced_by, priced_by_id, priced_at)
               SELECT category, name, spec, attr, unit_price, NULL, updated_by, NULL, updated_at
               FROM price_book
               WHERE NOT EXISTS (
                   SELECT 1 FROM price_history h
                   WHERE h.category = price_book.category AND h.name = price_book.name
                     AND h.spec = price_book.spec AND h.attr = price_book.attr
                     AND h.unit_price = price_book.unit_price)"""
        )
        conn.execute("DROP TABLE price_book")


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        _migrate(conn)
        for i, name in enumerate(DEFAULT_CATEGORIES):
            conn.execute("INSERT OR IGNORE INTO categories(name, sort) VALUES (?, ?)", (name, i))
        for i, name in enumerate(DEFAULT_UNITS):
            conn.execute("INSERT OR IGNORE INTO units(name, sort) VALUES (?, ?)", (name, i))
        _ensure_default_admin(conn)
        conn.commit()
    finally:
        conn.close()


# ---------- 口令 ----------

def hash_password(password: str, salt: str | None = None) -> str:
    """PBKDF2-HMAC-SHA256（标准库，无需额外依赖）。格式: pbkdf2$iterations$salt$hash"""
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return f"pbkdf2$200000${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt, digest = stored.split("$")
        if algo != "pbkdf2":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iters))
        return hmac.compare_digest(dk.hex(), digest)
    except (ValueError, AttributeError):
        return False


def _ensure_default_admin(conn: sqlite3.Connection) -> None:
    """首次启动建一个管理员账号（初始密码 admin123，登录后应立即修改）。"""
    if conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        return
    conn.execute(
        "INSERT INTO users(username, display_name, password_hash, role, active, created_at) VALUES (?, ?, ?, 'admin', 1, ?)",
        ("admin", "系统管理员", hash_password("admin123"), now()),
    )


def create_user(conn: sqlite3.Connection, username: str, password: str, display_name: str, role: str) -> int:
    cur = conn.execute(
        "INSERT INTO users(username, display_name, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
        (username, display_name or username, hash_password(password), role, now()),
    )
    return cur.lastrowid


def set_password(conn: sqlite3.Connection, user_id: int, password: str) -> None:
    conn.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(password), user_id))
    conn.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))


# ---------- 会话 ----------

def start_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO sessions(token, user_id, created_at) VALUES (?, ?, ?)", (token, user_id, now()))
    return token


def user_by_session(conn: sqlite3.Connection, token: str | None):
    if not token:
        return None
    return conn.execute(
        """SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = ? AND u.active = 1""",
        (token,),
    ).fetchone()


def end_session(conn: sqlite3.Connection, token: str | None) -> None:
    if token:
        conn.execute("DELETE FROM sessions WHERE token=?", (token,))


# ---------- 字典 ----------

def list_names(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r["name"] for r in conn.execute(f"SELECT name FROM {table} ORDER BY sort, name")]


def learn_vocab(conn: sqlite3.Connection, categories: list[str], units: list[str]) -> None:
    """录入时遇到的新类别/新单位自动入库（不设门槛，防录不进）。"""
    for c in categories:
        if c:
            conn.execute("INSERT OR IGNORE INTO categories(name, sort) VALUES (?, 99)", (c,))
    for u in units:
        if u:
            conn.execute("INSERT OR IGNORE INTO units(name, sort) VALUES (?, 99)", (u,))


# ---------- 价格历史 ----------

def last_price(conn: sqlite3.Connection, category: str, name: str, spec: str, attr: str):
    """该物料最近一次成交价（定价时的参考值）；无记录返回 None。"""
    return conn.execute(
        """SELECT * FROM price_history
           WHERE category=? AND name=? AND spec=? AND attr=?
           ORDER BY priced_at DESC, id DESC LIMIT 1""",
        (category, name, spec, attr),
    ).fetchone()


def add_price(conn: sqlite3.Connection, category: str, name: str, spec: str, attr: str,
              unit_price: float, receipt_id: int | None,
              priced_by: str, priced_by_id: int | None) -> None:
    conn.execute(
        """INSERT INTO price_history(category, name, spec, attr, unit_price, receipt_id,
                                     priced_by, priced_by_id, priced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (category, name, spec, attr, unit_price, receipt_id, priced_by, priced_by_id, now()),
    )
