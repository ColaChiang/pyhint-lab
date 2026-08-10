# PyHint Lab

PyHint Lab 是一套結合 Python 程式靜態分析、測試執行、學習者能力模型與生成式 AI 的適性化程式提示系統。學生提交錯誤程式後，系統不會直接讓大型語言模型猜測錯誤，而是先取得可驗證的診斷證據，再依學生程度決定提示層級。

## 系統流程

```mermaid
flowchart LR
    A[學生提交程式] --> B[語法與安全檢查]
    B --> C[Python AST 靜態分析]
    C --> D[受限測試執行]
    D --> E[診斷證據融合]
    E --> F[能力模型與提示層級]
    F --> G[規則提示或 LLM 表達]
    G --> H[提示與學習紀錄]
```

LLM 不負責判斷程式是否正確。它只會收到結構化診斷資料，例如錯誤規則、可能行號、診斷信心、失敗測試摘要、概念掌握度與允許的提示層級。沒有 API Key 或模型呼叫失敗時，系統會自動使用可解釋的規則式提示。

## 專案組成

- `app/`：React／Vinext 學生解題介面。線上展示版使用確定性分析引擎，不會直接執行陌生 Python 程式。
- `backend/`：真正的 FastAPI 分析服務。連接後會使用 Python 內建 `ast`、受限子程序測試、SQLite、BKT 能力更新與可選的 OpenAI 提示生成。

## 已實作功能

- 三道完整 Python 初學者題目
- 公開、邊界與隱藏測試案例
- Python `ast` 程式結構分析
- 錯誤類型、信心分數與可能行號
- 累加器覆蓋、奇偶條件顛倒、最大值初始化等規則
- 必要結構缺失、禁止函式、錯誤函式簽名與語法錯誤
- 簡化控制流程與可能初始化前使用檢查
- 執行時間、CPU、記憶體、檔案與輸出限制
- 靜態證據、測試結果與歷史錯誤的診斷融合
- Level 1 至 Level 5 漸進式提示
- Bayesian Knowledge Tracing 風格能力更新
- SQLite 與 D1 學習紀錄
- 解題工作台、學習分析與診斷透明度頁面
- Docker 執行環境
- 研究錯誤分類、評估流程與威脅模型
- 8 項後端自動測試

## 專案目錄

```text
pyhint-lab/
├── app/                         # React/Vinext 前端與線上 API
├── backend/
│   ├── app/
│   │   ├── analysis/            # Python AST 與簡化資料流規則
│   │   ├── execution/           # 受限子程序執行器
│   │   ├── services/            # 診斷、提示、能力與提交服務
│   │   ├── database.py          # SQLite 學習紀錄
│   │   ├── problems.py          # 題目與測試案例
│   │   └── main.py              # FastAPI 端點
│   └── tests/                   # 後端自動測試
├── db/                          # 線上 D1 資料結構
├── drizzle/                     # D1 SQL migration
├── research/                    # 研究評估與安全文件
├── docker-compose.yml
└── .env.example
```

## 本機完整執行

環境需求：

- Node.js 22 以上
- Python 3.11 以上
- Docker Desktop（建議）

### 1. 下載專案

```bash
git clone https://github.com/ColaChiang/pyhint-lab.git
cd pyhint-lab
```

### 2. 啟動 Python 後端

```bash
docker compose up --build api
```

啟動後可開啟：

- API 狀態：<http://localhost:8000/health>
- FastAPI 測試文件：<http://localhost:8000/docs>

### 3. 啟動前端

另開一個終端機。

macOS／Linux：

```bash
cp .env.example .env.local
npm install
npm run dev
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

開啟終端機顯示的網址。當 `NEXT_PUBLIC_PYHINT_API_URL=http://localhost:8000` 時，前端會使用真正的 Python AST 後端；若後端離線，介面會回退到展示用確定性分析引擎。

## 不使用 Docker 啟動後端

macOS／Linux：

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

Windows PowerShell：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
uvicorn app.main:app --reload
```

## 啟用生成式 AI 提示

系統不需要 API Key 也能運作。若要讓 LLM 將診斷證據改寫成自然語言提示：

```bash
cd backend
pip install -e '.[ai]'
```

設定環境變數：

```bash
export PYHINT_LLM_ENABLED=true
export PYHINT_OPENAI_API_KEY='your-api-key'
export PYHINT_OPENAI_MODEL='gpt-5.6'
```

請勿將 API Key 寫進程式或提交至 GitHub。

## API

| 方法 | 路徑 | 功能 |
| --- | --- | --- |
| `GET` | `/health` | 檢查服務狀態 |
| `GET` | `/api/problems` | 取得題目列表 |
| `GET` | `/api/problems/{id}` | 取得題目內容，不包含隱藏測試 |
| `POST` | `/api/submissions` | 分析、測試、診斷、提示並更新能力 |
| `GET` | `/api/students/{id}/mastery` | 取得概念掌握機率 |
| `GET` | `/api/students/{id}/history` | 取得作答紀錄 |

提交範例：

```json
{
  "user_id": "student-01",
  "problem_id": "list-sum",
  "code": "def calculate_sum(numbers):\n    total = 0\n    for number in numbers:\n        total += number\n    return total"
}
```

## 執行測試

```bash
cd backend
python -m unittest discover -s tests -v
```

正常結果：

```text
Ran 8 tests
OK
```

## 安全限制

目前執行器適合課堂展示與研究原型，不應直接當成大型公開線上判題系統。AST 黑名單本身不是完整的 Python sandbox。

正式對外服務前，建議將每次程式執行移到一次性容器或 microVM，並加入：

- 獨立的無網路執行環境
- seccomp／AppArmor 系統呼叫限制
- 每次工作獨立 cgroup
- 唯讀檔案系統
- 不將密鑰掛載進執行器
- 執行完成後立即銷毀環境

詳細內容請參考 `research/threat-model.md`。

## 研究設計

可比較三種實驗條件：

1. 只有測試結果與固定提示
2. 直接將學生程式交給 LLM
3. AST＋測試＋學習者模型＋證據導向 LLM 提示

主要評估指標包括診斷 Precision、Recall、Macro F1、答對所需嘗試次數、最高提示層級、提示後修改方向、延宕測驗、提示清楚度、答案洩漏程度與可信度。

## 使用說明

本專案目前定位為教育研究與課堂展示原型。若要公開部署並允許不受信任的使用者執行任意 Python，請先完成上述 sandbox 強化。

PyHint Lab

PyHint Lab is an adaptive Python hint system that diagnoses a learner's program before asking a language model to explain the problem. It combines Python AST analysis, bounded test execution, evidence fusion, a learner model, five hint levels, and an optional LLM phrasing layer.

The repository contains two working surfaces:

app/: the responsive Vinext/React student interface. It includes a deterministic browser demo engine so the hosted demonstration remains interactive without executing untrusted Python on the edge.

backend/: the real FastAPI analysis service. When configured through NEXT_PUBLIC_PYHINT_API_URL, the interface uses Python's built-in ast, isolated tests, SQLite history, BKT mastery updates, and optional OpenAI hint wording.

System flow

flowchart LR
    A[Student code] --> B[Syntax and safety]
    B --> C[Python AST rules]
    C --> D[Bounded tests]
    D --> E[Evidence fusion]
    E --> F[Mastery and hint level]
    F --> G[Template or LLM wording]
    G --> H[Hint and learning record]

The LLM never decides whether the code is correct. It receives a typed evidence object containing the selected rule, line, confidence, failed-test summary, mastery probability, and permitted hint level. A deterministic template is always available as a fallback.

Included features

Three complete Python exercises with public, boundary, and hidden tests.

Explainable rules for accumulator overwrite, reversed parity, unsafe maximum initialization, missing structures, forbidden calls, signature errors, syntax errors, and possible use-before-assignment.

Security pre-screening for imports, system attributes, dangerous calls, dunder attributes, global state, and overly large ASTs.

Child-process runner with interpreter isolation and CPU, memory, time, file, descriptor, and output limits.

Weighted diagnosis combining static confidence, failing-test signal, and repeated-error history.

Five progressive hint levels with answer-leakage checks.

BKT-style concept mastery updates for loops, accumulators, lists, conditions, and functions.

SQLite persistence in the Python API and D1 persistence for the hosted interaction history.

Student workspace, learning dashboard, diagnostic transparency page, responsive mobile layout, and keyboard-accessible controls.

Research taxonomy, evaluation protocol, and threat model.

Eight automated backend tests.

Repository layout

pyhint-lab/
├── app/                         # React/Vinext interface and hosted API route
├── backend/
│   ├── app/
│   │   ├── analysis/            # Python AST and simplified data-flow rules
│   │   ├── execution/           # Bounded child-process runner
│   │   ├── services/            # Diagnosis, mastery, hints, submissions
│   │   ├── database.py          # SQLite history and mastery storage
│   │   ├── problems.py          # Exercise/test registry
│   │   └── main.py              # FastAPI endpoints
│   └── tests/                   # Core automated tests
├── db/                          # Hosted D1 schema
├── drizzle/                     # Generated SQL migration
├── research/                    # Evaluation and safety documents
├── docker-compose.yml
└── .env.example

Run the complete project locally

Prerequisites: Node.js 22+, Python 3.11+, and Docker (recommended for the API).

Start the Python backend:

docker compose up --build api

The API and interactive documentation are available at http://localhost:8000 and http://localhost:8000/docs.

In another terminal, connect and start the interface:

cp .env.example .env.local
npm install
npm run dev

Open the local URL printed by the frontend. Submissions now use the real Python service. If the API is unavailable, the interface deliberately falls back to the deterministic demo engine.

For backend-only development without Docker:

cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload

Enable LLM wording

The system works without an API key. To let the LLM rephrase verified evidence, install the optional dependency and set environment values:

cd backend
pip install -e '.[ai]'
export PYHINT_LLM_ENABLED=true
export PYHINT_OPENAI_API_KEY='your-key'
export PYHINT_OPENAI_MODEL='gpt-5.6'

The implementation uses the Responses API with separate instructions and typed JSON evidence, following the official OpenAI text-generation documentation. Keep the model configurable and evaluate prompt changes before changing a research condition.

API

Method

Route

Purpose

GET

/health

service health

GET

/api/problems

problem list without tests

GET

/api/problems/{id}

problem detail without hidden tests

POST

/api/submissions

analyze, test, diagnose, hint, and update mastery

GET

/api/students/{id}/mastery

concept probabilities

GET

/api/students/{id}/history

recent attempts

Example submission:

{
  "user_id": "student-01",
  "problem_id": "list-sum",
  "code": "def calculate_sum(numbers):\n    total = 0\n    for number in numbers:\n        total += number\n    return total"
}

Tests

The AST, runner, hidden-test redaction, submission pipeline, hint choice, persistence, and mastery updates are covered using only the Python standard test runner:

cd backend
python -m unittest discover -s tests -v

Frontend and deployment validation run through the project's existing build and artifact checks.

Security boundary

The included controls are suitable for a controlled educational demonstration, not an internet-facing multi-tenant judge. AST blacklists are not a complete Python sandbox. Before production use, move execution into one-job ephemeral containers or microVMs with no network, a syscall allowlist, per-job cgroups, and no secrets. See research/threat-model.md for the exact residual risks and upgrade path.

Research use

Use research/error-taxonomy.md to label a benchmark dataset and research/evaluation-protocol.md to compare:

test-only fixed hints;

direct LLM diagnosis;

AST + tests + learner model + evidence-grounded wording.

Primary outcomes are diagnostic macro F1, attempts to correctness, time, highest hint level, code-edit direction, retention, clarity, answer leakage, and trust.
