# PyHint Lab

PyHint Lab 是一套結合程式靜態分析、測試執行、學習者狀態與生成式 AI 的適性化 Python 提示系統。系統不讓大型語言模型直接猜測程式錯誤，而是先取得可驗證的分析結果，再依錯誤類型與學習歷程提供分層提示。

[開啟線上展示版](https://pyhint-lab.workspace-526245.chatgpt.site)

> 目前線上展示版提供 8 題互動練習，使用確定性的 TypeScript 分析引擎，不會直接執行使用者提交的 Python。完整 FastAPI 後端目前提供 3 題，包含真正的 Python AST、受限測試執行、SQLite、BKT 風格能力更新與可選的 LLM 提示表達。

## 系統流程

```mermaid
flowchart LR
    A[學生提交程式] --> B[語法與安全檢查]
    B --> C[結構與規則分析]
    C --> D[公開與隱藏測試]
    D --> E[診斷證據融合]
    E --> F[提示層級決策]
    F --> G[規則模板或 LLM 表達]
    G --> H[提示與學習紀錄]
```

LLM 不負責判斷程式是否正確。完整後端只會把結構化診斷證據交給 LLM，例如錯誤規則、可能行號、測試摘要、概念掌握度與允許的提示層級。沒有 API Key 或模型呼叫失敗時，系統仍可使用可解釋的規則式提示。

## 目前提供的兩個版本

| 版本 | 題目數 | 分析方式 | 適合用途 |
| --- | ---: | --- | --- |
| 線上展示版 `app/` | 8 題 | TypeScript 確定性規則與模擬隱藏測試 | 網頁展示、UI 測試、研究概念說明 |
| FastAPI 後端 `backend/` | 3 題 | Python `ast`、受限子程序測試、診斷融合與能力模型 | 本機研究實驗、真實 Python 分析 |

線上展示版與 FastAPI 後端目前是兩個可獨立運作的介面。前端固定呼叫同源的 `/api/analyze` 展示引擎，尚不會因為設定 `NEXT_PUBLIC_PYHINT_API_URL` 而自動切換到 FastAPI；後端可先透過 API 文件獨立測試。

## 已實作功能

### 線上展示版

- 8 題 Python 初學者練習：串列總和、偶數判斷、最大值、正數計數、母音計數、字串反轉、保留順序去重與階乘
- 一般、邊界與隱藏測試摘要，不向學生公開測資內容
- 累加器覆蓋、條件顛倒、錯誤邊界、大小寫、順序遺失與乘法初始值等規則
- 學生端只顯示一般線上評測風格的測試結果、`FAILED` 狀態與通過數量
- 診斷規則、行號與信心分數保留在內部，作為提示生成依據
- Level 1 至 Level 5 適性提示；首次錯誤從 Level 1 開始
- 可使用「上一層／下一層」查看或解鎖提示層級
- 正確答案不顯示提示 Level
- 解題工作台、學習分析與系統透明度頁面
- D1 作答紀錄、響應式版面與鍵盤操作

### FastAPI 完整後端

- Python `ast` 程式結構分析與簡化資料流檢查
- 真實公開、邊界與隱藏測試執行
- 危險語法預檢、逾時、CPU、記憶體、檔案與輸出限制
- 靜態證據、測試結果與歷史錯誤的診斷融合
- BKT 風格概念掌握度更新
- SQLite 學習紀錄
- 規則式五層提示與可選的 OpenAI 提示表達
- Docker 執行環境、研究錯誤分類與威脅模型
- 8 項後端自動測試

## 專案目錄

```text
pyhint-lab/
├── app/                         # React/Vinext 前端、展示分析 API 與作答紀錄 API
├── backend/
│   ├── app/
│   │   ├── analysis/            # Python AST 與簡化資料流規則
│   │   ├── execution/           # 受限子程序執行器
│   │   ├── services/            # 診斷、提示、能力與提交服務
│   │   ├── database.py          # SQLite 學習紀錄
│   │   ├── problems.py          # 後端題目與測試案例
│   │   └── main.py              # FastAPI 端點
│   └── tests/                   # 後端自動測試
├── db/                          # 線上 D1 資料結構
├── drizzle/                     # D1 SQL migration
├── research/                    # 研究評估與安全文件
├── docker-compose.yml
└── .env.example
```

## 本機執行線上展示版

環境需求：Node.js 22 以上。

```bash
git clone https://github.com/ColaChiang/pyhint-lab.git
cd pyhint-lab
npm install
npm run dev
```

開啟終端機顯示的本機網址。這個模式會使用 `app/demo-engine.ts` 的確定性展示分析，不需要 Python、Docker 或 API Key。

## 啟動 FastAPI 後端

環境需求：Python 3.11 以上，建議安裝 Docker Desktop。

### 使用 Docker

```bash
docker compose up --build api
```

啟動後可開啟：

- API 狀態：<http://localhost:8000/health>
- FastAPI 測試文件：<http://localhost:8000/docs>

### 不使用 Docker

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

FastAPI 後端不需要 API Key 也能運作。若要讓 LLM 將已驗證的診斷證據改寫成自然語言提示：

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

請勿將 API Key 寫入程式或提交至 GitHub。

## API

### 線上展示版

| 方法 | 路徑 | 功能 |
| --- | --- | --- |
| `POST` | `/api/analyze` | 執行展示分析並取得測試摘要與提示 |
| `GET` | `/api/submissions` | 取得目前使用者最近的作答紀錄 |
| `POST` | `/api/submissions` | 儲存一次作答結果 |

### FastAPI 後端

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

後端測試：

```bash
cd backend
python -m unittest discover -s tests -v
```

正常結果：

```text
Ran 8 tests
OK
```

前端建置與輸出驗證：

```bash
npm run lint
npm run build
```

## 安全限制

完整後端目前適合課堂展示與研究原型，不應直接當成大型公開線上判題系統。AST 黑名單本身不是完整的 Python sandbox。

正式允許不受信任的使用者執行任意 Python 前，建議將每次執行移到一次性容器或 microVM，並加入：

- 獨立的無網路執行環境
- seccomp／AppArmor 系統呼叫限制
- 每次工作獨立 cgroup
- 唯讀檔案系統
- 不將密鑰掛載進執行器
- 執行完成後立即銷毀環境

詳細內容請參考 [`research/threat-model.md`](research/threat-model.md)。

## 研究設計

可比較三種實驗條件：

1. 只有測試結果與固定提示
2. 直接將學生程式交給 LLM
3. AST＋測試＋學習者模型＋證據導向 LLM 提示

主要評估指標包括診斷 Precision、Recall、Macro F1、答對所需嘗試次數、最高提示層級、提示後修改方向、延宕測驗、提示清楚度、答案洩漏程度與可信度。

## English summary

PyHint Lab is an adaptive Python hint system. The hosted demo contains eight interactive exercises powered by a deterministic TypeScript analyzer, while the FastAPI research backend currently contains three exercises with Python AST analysis, bounded test execution, SQLite history, BKT-style mastery updates, and optional LLM wording. The LLM explains verified evidence; it does not decide whether a submission is correct.

