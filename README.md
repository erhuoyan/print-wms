# print-wms · 印刷厂仓库管理系统

纸质入库单数字化：**拍照/手工录单 → 领导定价（历史价参考）→ 导出 Excel**。
支持纸张、油墨、版材、辅料等任意物料（不写死纸张）；后续出库、库存模块按同一套 core + modules 结构扩展。

## 当前状态（试用版已上线）

- 在线：http://116.196.87.228:8080
- 初始管理员：`admin` / `admin123`（登录后请立即改密）
- 已验证：登录鉴权、角色权限（后端强制）、录单、拍照 OCR、定价、价格历史、导出 Excel

## 角色与权限

| 角色 | 能做什么 |
|---|---|
| 录入员 clerk | 录单、编辑未定价单、查看、导出 |
| 领导 leader | 以上 + 定价/改价、作废/恢复、维护价格 |
| 管理员 admin | 全部 + 用户管理（建账号、分配角色、停用、重置密码） |

权限由**后端每个接口校验**（未登录 401 / 越权 403），前端只做入口隐藏。
会话用 httpOnly cookie + 服务端 sessions 表；密码 PBKDF2-SHA256（20 万次迭代）。

## 价格设计（重要）

同一物料**不同批次入库价可以不同**，所以价格是**追加式台账**而不是唯一当前价：

- `price_history` 每次定价追加一条：谁、何时、什么价、来自哪张单
- 定价时带出该物料**最近一次成交价**作参考（页面上标注「上次 5300（2026-09-29 王总）」）
- 价格历史页可查完整流水 + 各物料最近价；领导/管理员可手工补录合同价

## 技术结构

```
app/                       后端（FastAPI，只出 /api/*，并托管前端静态产物）
  main.py                  入口：挂 API + SPA 回落
  core/db.py               SQLite（users/sessions/receipts/items/price_history/字典）+ 自动迁移
  core/auth.py             会话解析与角色依赖（require("leader","admin")）
  modules/auth_api.py      登录/登出/改密/用户管理
  modules/inbound/api.py   单据、定价、价格历史、OCR、导出
  modules/inbound/ocr.py   RapidOCR 离线识别 + 单据字段启发式抽取
  modules/inbound/exporter.py  Excel 导出（列配置 COLUMNS）
  static/web/              前端构建产物（vite 输出，随项目分发）
web/                       前端源码（React 19 + Vite + Tailwind v4 + shadcn/ui）
data/                      运行时：wms.db、uploads/、exports/、logs/
offline/                   离线部署包（Python 绿色版 + wheel）
```

## 部署

### Linux 服务器（当前部署）

```bash
systemctl status print-wms    # 应用 :8000
systemctl status nginx        # 反代 :8080 → :8000
tail -f /opt/print-wms/data/logs/wms.log
```

更新：`rsync -az --delete app/ root@HOST:/opt/print-wms/app/ --exclude __pycache__ && ssh root@HOST systemctl restart print-wms`
（数据库结构变更由 `core/db.py` 的 `_migrate()` 自动处理，无需手工改库）

### Windows（目标机不联网、不装任何东西）

1. 构建机（有网）跑一次：`bash tools/download_offline_package.sh` → 生成 `offline/`
2. 若前端有改动，先在 `web/` 里 `npm install && npm run build`，把 `web/dist` 拷到 `app/static/web`
3. 整个文件夹拷到目标机，双击 `start.bat`：首启自动解压绿色 Python、离线装依赖，之后秒开
   - 目标机**不需要 Node**（前端是已编译的静态文件）

### 本地开发

```bash
# 后端（Python 3.12）
python -m uvicorn app.main:app --reload --port 8000
# 前端（另开一个终端，vite 代理 /api 到 8000）
cd web && npm install && npm run dev
```

## 常用调整

- 导出列：`app/modules/inbound/exporter.py` 的 `COLUMNS`
- 默认类别/单位：`app/core/db.py` 的 `DEFAULT_CATEGORIES / DEFAULT_UNITS`（录入时新值会自动记住）
- OCR 换引擎：只替换 `ocr.py` 的 `ocr_image()`，`parse_slip()` 不变
- 摄像头：标准 UVC 设备（高拍仪）即插即用；http 下浏览器会禁用摄像头，用 localhost 或配 https
