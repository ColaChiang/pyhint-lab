# PyHint Lab

PyHint Lab is an adaptive Python hint system that diagnoses a learner's program before asking a language model to explain the problem. It combines Python AST analysis, bounded test execution, evidence fusion, a learner model, five hint levels, and an optional LLM phrasing layer.

The repository contains two working surfaces:

- `app/`: the responsive Vinext/React student interface. It includes a deterministic browser demo engine so the hosted demonstration remains interactive without executing untrusted Python on the edge.
- `backend/`: the real FastAPI analysis service. When configured through `NEXT_PUBLIC_PYHINT_API_URL`, the interface uses Python's built-in `ast`, isolated tests, SQLite history, BKT mastery updates, and optional OpenAI hint wording.

## System flow

```mermaid
flowchart LR
    A[Student code] --> B[Syntax and safety]
    B --> C[Python AST rules]
    C --> D[Bounded tests]
    D --> E[Evidence fusion]
    E --> F[Mastery and hint level]
    F --> G[Template or LLM wording]
    G --> H[Hint and learning record]
```

The LLM never decides whether the code is correct. It receives a typed evidence object containing the selected rule, line, confidence, failed-test summary, mastery probability, and permitted hint level. A deterministic template is always available as a fallback.

## Included features

- Three complete Python exercises with public, boundary, and hidden tests.
- Explainable rules for accumulator overwrite, reversed parity, unsafe maximum initialization, missing structures, forbidden calls, signature errors, syntax errors, and possible use-before-assignment.
- Security pre-screening for imports, system attributes, dangerous calls, dunder attributes, global state, and overly large ASTs.
- Child-process runner with interpreter isolation and CPU, memory, time, file, descriptor, and output limits.
- Weighted diagnosis combining static confidence, failing-test signal, and repeated-error history.
- Five progressive hint levels with answer-leakage checks.
- BKT-style concept mastery updates for loops, accumulators, lists, conditions, and functions.
- SQLite persistence in the Python API and D1 persistence for the hosted interaction history.
- Student workspace, learning dashboard, diagnostic transparency page, responsive mobile layout, and keyboard-accessible controls.
- Research taxonomy, evaluation protocol, and threat model.
- Eight automated backend tests.

## Repository layout

```text
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
```

## Run the complete project locally

Prerequisites: Node.js 22+, Python 3.11+, and Docker (recommended for the API).

1. Start the Python backend:

   ```bash
   docker compose up --build api
   ```

   The API and interactive documentation are available at `http://localhost:8000` and `http://localhost:8000/docs`.

2. In another terminal, connect and start the interface:

   ```bash
   cp .env.example .env.local
   npm install
   npm run dev
   ```

3. Open the local URL printed by the frontend. Submissions now use the real Python service. If the API is unavailable, the interface deliberately falls back to the deterministic demo engine.

For backend-only development without Docker:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

## Enable LLM wording

The system works without an API key. To let the LLM rephrase verified evidence, install the optional dependency and set environment values:

```bash
cd backend
pip install -e '.[ai]'
export PYHINT_LLM_ENABLED=true
export PYHINT_OPENAI_API_KEY='your-key'
export PYHINT_OPENAI_MODEL='gpt-5.6'
```

The implementation uses the Responses API with separate `instructions` and typed JSON evidence, following the [official OpenAI text-generation documentation](https://developers.openai.com/api/docs/guides/text). Keep the model configurable and evaluate prompt changes before changing a research condition.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | service health |
| `GET` | `/api/problems` | problem list without tests |
| `GET` | `/api/problems/{id}` | problem detail without hidden tests |
| `POST` | `/api/submissions` | analyze, test, diagnose, hint, and update mastery |
| `GET` | `/api/students/{id}/mastery` | concept probabilities |
| `GET` | `/api/students/{id}/history` | recent attempts |

Example submission:

```json
{
  "user_id": "student-01",
  "problem_id": "list-sum",
  "code": "def calculate_sum(numbers):\n    total = 0\n    for number in numbers:\n        total += number\n    return total"
}
```

## Tests

The AST, runner, hidden-test redaction, submission pipeline, hint choice, persistence, and mastery updates are covered using only the Python standard test runner:

```bash
cd backend
python -m unittest discover -s tests -v
```

Frontend and deployment validation run through the project's existing build and artifact checks.

## Security boundary

The included controls are suitable for a controlled educational demonstration, not an internet-facing multi-tenant judge. AST blacklists are not a complete Python sandbox. Before production use, move execution into one-job ephemeral containers or microVMs with no network, a syscall allowlist, per-job cgroups, and no secrets. See `research/threat-model.md` for the exact residual risks and upgrade path.

## Research use

Use `research/error-taxonomy.md` to label a benchmark dataset and `research/evaluation-protocol.md` to compare:

1. test-only fixed hints;
2. direct LLM diagnosis;
3. AST + tests + learner model + evidence-grounded wording.

Primary outcomes are diagnostic macro F1, attempts to correctness, time, highest hint level, code-edit direction, retention, clarity, answer leakage, and trust.
