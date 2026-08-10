"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Analysis,
  Challenge,
  challenges,
  analyzeCode,
  chooseHintLevel,
  getHint,
} from "./demo-engine";

type View = "workspace" | "progress" | "system";

const masterySeed = [
  { label: "迴圈", value: 72, delta: "+8" },
  { label: "條件判斷", value: 58, delta: "+3" },
  { label: "串列", value: 81, delta: "+6" },
  { label: "函式", value: 66, delta: "+4" },
  { label: "累加器", value: 41, delta: "+12" },
];

export default function PyHintApp({ user }: { user: { name: string; email: string } }) {
  const [view, setView] = useState<View>("workspace");
  const [challenge, setChallenge] = useState<Challenge>(challenges[0]);
  const [code, setCode] = useState(challenges[0].starter);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [hintLevel, setHintLevel] = useState(0);
  const [remoteHint, setRemoteHint] = useState<string | null>(null);
  const [mastery, setMastery] = useState(masterySeed);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<{ title: string; result: string; time: string }[]>([
    { title: "交換兩個變數", result: "通過", time: "今天 09:14" },
    { title: "判斷正負數", result: "通過", time: "昨天 20:32" },
  ]);

  const currentAttempts = attempts[challenge.id] ?? 0;
  const primaryMastery = mastery.find((item) => item.label === challenge.concepts[0])?.value ?? 60;
  const analysisMastery = mastery.find((item) => item.label === analysis?.finding?.concept)?.value ?? primaryMastery;
  const passedCount = analysis?.tests.filter((test) => test.passed).length ?? 0;
  const lineNumbers = useMemo(() => code.split("\n").map((_, index) => index + 1), [code]);

  useEffect(() => {
    fetch("/api/submissions")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: { submissions?: { problemId: string; passed: number; total: number; createdAt: string }[] }) => {
        if (!payload.submissions?.length) return;
        setHistory(
          payload.submissions.map((item) => ({
            title: challenges.find((problem) => problem.id === item.problemId)?.title ?? item.problemId,
            result: item.passed === item.total ? "通過" : `${item.passed}/${item.total} 測試`,
            time: new Date(item.createdAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" }),
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  function selectChallenge(next: Challenge) {
    setChallenge(next);
    setCode(next.starter);
    setAnalysis(null);
    setHintLevel(0);
    setRemoteHint(null);
    setView("workspace");
  }

  async function runAnalysis() {
    setRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 420));
    let nextAnalysis = analyzeCode(challenge, code);
    let backendHint: { content: string; level: number } | null = null;
    const apiBase = process.env.NEXT_PUBLIC_PYHINT_API_URL;
    if (apiBase) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/submissions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ user_id: user.email, problem_id: challenge.id, code }),
        });
        if (response.ok) {
          const payload = await response.json();
          const conceptMap: Record<string, "迴圈" | "累加器" | "串列" | "條件判斷" | "函式"> = {
            loop: "迴圈", accumulator: "累加器", list: "串列", condition: "條件判斷", function: "函式",
          };
          const primary = payload.diagnosis?.primary;
          nextAnalysis = {
            syntaxValid: payload.static_analysis.syntax_valid,
            structures: Object.entries(payload.static_analysis.structures)
              .filter(([, count]) => Number(count) > 0)
              .map(([name]) => name),
            finding: primary ? {
              ruleId: primary.rule_id,
              title: primary.title,
              concept: conceptMap[primary.concept] ?? "函式",
              line: primary.line,
              confidence: primary.confidence,
              evidence: primary.evidence,
            } : null,
            tests: payload.tests.map((test: { name: string; input: unknown; expected: unknown; actual: unknown; passed: boolean; kind: string }) => ({
              name: test.name,
              input: test.kind === "hidden" ? "••••••" : (JSON.stringify(test.input) ?? "—"),
              expected: test.kind === "hidden" ? "通過" : (JSON.stringify(test.expected) ?? "—"),
              actual: test.kind === "hidden" ? (test.passed ? "通過" : "失敗") : (JSON.stringify(test.actual) ?? "—"),
              passed: test.passed,
              hidden: test.kind === "hidden",
            })),
            score: payload.tests.filter((test: { passed: boolean }) => test.passed).length,
          };
          backendHint = payload.hint;
        }
      } catch {
        // The in-browser deterministic engine remains available when the API is offline.
      }
    }
    const nextAttempts = currentAttempts + 1;
    const repeated = analysis?.finding?.ruleId === nextAnalysis.finding?.ruleId;
    const diagnosticMastery = mastery.find((item) => item.label === nextAnalysis.finding?.concept)?.value ?? primaryMastery;
    const nextLevel = chooseHintLevel(nextAttempts, diagnosticMastery, repeated);
    setAnalysis(nextAnalysis);
    setAttempts((previous) => ({ ...previous, [challenge.id]: nextAttempts }));
    setHintLevel(backendHint?.level ?? nextLevel);
    setRemoteHint(backendHint?.content ?? null);
    setHistory((previous) => [
      {
        title: challenge.title,
        result: nextAnalysis.tests.length > 0 && nextAnalysis.tests.every((test) => test.passed) ? "通過" : `第 ${nextAttempts} 次嘗試`,
        time: "剛剛",
      },
      ...previous.slice(0, 5),
    ]);
    if (nextAnalysis.tests.length > 0 && nextAnalysis.tests.every((test) => test.passed)) {
      setMastery((previous) =>
        previous.map((item) =>
          challenge.concepts.includes(item.label as never)
            ? { ...item, value: Math.min(100, item.value + 4) }
            : item,
        ),
      );
    }
    setRunning(false);

    fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        problemId: challenge.id,
        code,
        passed: nextAnalysis.tests.filter((test) => test.passed).length,
        total: nextAnalysis.tests.length,
        ruleId: nextAnalysis.finding?.ruleId ?? null,
        hintLevel: nextLevel,
      }),
    }).catch(() => undefined);
  }

  function nextHint() {
    setHintLevel((current) => Math.min(5, Math.max(1, current + 1)));
    setRemoteHint(null);
  }

  const initials = user.name === "學習者" ? "PL" : user.name.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("workspace")} aria-label="回到解題頁">
          <span className="brand-mark">P<span>y</span></span>
          <span><strong>PyHint</strong><small>adaptive lab</small></span>
        </button>
        <nav className="main-nav" aria-label="主要導覽">
          <button className={view === "workspace" ? "active" : ""} onClick={() => setView("workspace")}><span>⌘</span>解題工作台</button>
          <button className={view === "progress" ? "active" : ""} onClick={() => setView("progress")}><span>↗</span>學習分析</button>
          <button className={view === "system" ? "active" : ""} onClick={() => setView("system")}><span>◎</span>系統診斷</button>
        </nav>
        <div className="problem-nav">
          <p>練習路徑 <span>3 題</span></p>
          {challenges.map((item) => (
            <button key={item.id} className={challenge.id === item.id ? "selected" : ""} onClick={() => selectChallenge(item)}>
              <span className="problem-index">0{item.index}</span>
              <span><strong>{item.title}</strong><small>{item.concepts.slice(0, 2).join(" · ")}</small></span>
            </button>
          ))}
        </div>
        <div className="sidebar-profile">
          <span className="avatar">{initials}</span>
          <span><strong>{user.name}</strong><small>本週連續學習 4 天</small></span>
          <i>•••</i>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">PYTHON FOUNDATIONS · UNIT 02</span>
            <h1>{view === "workspace" ? challenge.title : view === "progress" ? "你的學習軌跡" : "診斷引擎透明度"}</h1>
          </div>
          <div className="topbar-actions">
            <div className="course-progress"><span><b>本單元</b><em>62%</em></span><i><u /></i></div>
            {view === "workspace" && <button className="run-button" onClick={runAnalysis} disabled={running}>{running ? "分析中…" : "執行分析"}<kbd>⌘ ↵</kbd></button>}
          </div>
        </header>

        {view === "workspace" && (
          <div className="workspace-grid">
            <section className="problem-panel panel">
              <div className="panel-label"><span>01</span>題目說明</div>
              <div className="difficulty"><span>{challenge.difficulty}</span><small>預估 8 分鐘</small></div>
              <p className="problem-copy">{challenge.description}</p>
              <div className="concept-list">
                {challenge.concepts.map((concept) => <span key={concept}>{concept}</span>)}
              </div>
              <div className="example-card">
                <p>範例</p>
                <div><span>輸入</span><code>{challenge.sampleInput}</code></div>
                <div><span>輸出</span><code>{challenge.sampleOutput}</code></div>
              </div>
              <div className="rules-card">
                <strong>結構要求</strong>
                <p><i>✓</i>保留指定函式名稱</p>
                <p><i>✓</i>使用題目要求的核心結構</p>
                <p><i>×</i>不可直接使用答案型內建函式</p>
              </div>
            </section>

            <section className="editor-panel panel">
              <div className="editor-toolbar">
                <div><span className="file-dot" /> solution.py <small>Python 3.12</small></div>
                <button onClick={() => { setCode(challenge.starter); setAnalysis(null); setHintLevel(0); setRemoteHint(null); }}>重設</button>
              </div>
              <div className="code-editor-wrap">
                <div className="line-numbers" aria-hidden="true">{lineNumbers.map((number) => <span key={number}>{number}</span>)}</div>
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void runAnalysis();
                    }
                  }}
                  spellCheck={false}
                  aria-label="Python 程式碼編輯器"
                />
              </div>
              <div className="editor-status"><span><i className={analysis?.syntaxValid === false ? "status-error" : "status-ok"} />{analysis?.syntaxValid === false ? "語法需修正" : "語法結構可分析"}</span><span>Ln {code.split("\n").length}, Col 1 · Spaces: 4 · UTF-8</span></div>
            </section>

            <aside className="insight-panel panel">
              <div className="panel-label"><span>AI</span>適性提示</div>
              {!analysis ? (
                <div className="empty-analysis">
                  <div className="scan-glyph"><i /><i /><i /></div>
                  <strong>等待你的程式</strong>
                  <p>執行後會先分析 AST 與測試證據，再產生適合你程度的提示。</p>
                </div>
              ) : (
                <>
                  <div className="analysis-head">
                    <span className={analysis.finding ? "warning" : "success"}>{analysis.finding ? "發現 1 個主要問題" : "所有測試通過"}</span>
                    <small>第 {currentAttempts} 次嘗試</small>
                  </div>
                  {analysis.finding && (
                    <div className="finding-card">
                      <div><span>第 {analysis.finding.line ?? "?"} 行</span><em>{Math.round(analysis.finding.confidence * 100)}% 信心</em></div>
                      <strong>{analysis.finding.title}</strong>
                      <p>{analysis.finding.evidence}</p>
                      <code>{analysis.finding.ruleId}</code>
                    </div>
                  )}
                  <div className="hint-card">
                    <div><span>提示 LEVEL {Math.max(1, hintLevel)}</span><small>依掌握度 {analysisMastery}% 調整</small></div>
                    <p>{remoteHint ?? getHint(analysis.finding, Math.max(1, hintLevel))}</p>
                    {analysis.finding && hintLevel < 5 && <button onClick={nextHint}>我還需要更具體的提示 <span>→</span></button>}
                  </div>
                  <div className="evidence-list">
                    <p>分析證據</p>
                    <span><i>AST</i>{analysis.structures.join(" · ") || "無可用結構"}</span>
                    <span><i>TEST</i>{passedCount}/{analysis.tests.length} 個測試通過</span>
                    <span><i>MODEL</i>{analysis?.finding?.concept ?? challenge.concepts[0]}掌握度 {analysisMastery}%</span>
                  </div>
                </>
              )}
            </aside>

            <section className="tests-panel panel">
              <div className="tests-title"><div><span className="panel-label"><span>04</span>測試結果</span><small>公開、邊界與隱藏案例</small></div>{analysis && <strong className={passedCount === analysis.tests.length ? "all-pass" : "some-fail"}>{passedCount} / {analysis.tests.length} PASSED</strong>}</div>
              {!analysis ? (
                <div className="test-placeholder">執行程式後，測試證據會顯示在這裡。</div>
              ) : (
                <div className="test-grid">
                  {analysis.tests.map((test) => (
                    <article key={test.name} className={test.passed ? "test-pass" : "test-fail"}>
                      <div><span>{test.passed ? "✓" : "×"}</span><strong>{test.name}</strong><em>{test.passed ? "PASS" : "FAIL"}</em></div>
                      <p><span>input</span><code>{test.input}</code></p>
                      <p><span>expected</span><code>{test.expected}</code></p>
                      <p><span>actual</span><code>{test.actual}</code></p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {view === "progress" && <ProgressView mastery={mastery} history={history} onPractice={() => setView("workspace")} />}
        {view === "system" && <SystemView />}
      </main>
    </div>
  );
}

function ProgressView({ mastery, history, onPractice }: { mastery: typeof masterySeed; history: { title: string; result: string; time: string }[]; onPractice: () => void }) {
  const average = Math.round(mastery.reduce((sum, item) => sum + item.value, 0) / mastery.length);
  return (
    <div className="dashboard-view">
      <section className="summary-strip">
        <article><span>總掌握度</span><strong>{average}<small>%</small></strong><em>↑ 6% 本週</em></article>
        <article><span>已完成題目</span><strong>14<small>/ 20</small></strong><em>本單元 70%</em></article>
        <article><span>平均提示層級</span><strong>2.1</strong><em>維持獨立思考</em></article>
        <article><span>連續學習</span><strong>4<small>天</small></strong><em>最佳紀錄 7 天</em></article>
      </section>
      <div className="dashboard-columns">
        <section className="mastery-card panel">
          <div className="section-heading"><div><span>KNOWLEDGE MAP</span><h2>概念掌握度</h2></div><small>最近 30 天</small></div>
          <div className="mastery-list">
            {mastery.map((item) => <div key={item.label}><span><strong>{item.label}</strong><em>{item.delta}</em></span><div><i style={{ width: `${item.value}%` }} /></div><b>{item.value}%</b></div>)}
          </div>
          <div className="recommendation"><span>下一步</span><div><strong>加強「累加器」概念</strong><p>你在迴圈基礎上表現穩定，但容易覆蓋中間結果。建議完成 2 題針對性練習。</p></div><button onClick={onPractice}>開始練習 →</button></div>
        </section>
        <section className="history-card panel">
          <div className="section-heading"><div><span>LEARNING LOG</span><h2>最近活動</h2></div></div>
          <div className="history-list">{history.map((item, index) => <article key={`${item.title}-${index}`}><span>{item.result === "通過" ? "✓" : index + 1}</span><div><strong>{item.title}</strong><small>{item.time}</small></div><em className={item.result === "通過" ? "done" : "attempt"}>{item.result}</em></article>)}</div>
        </section>
      </div>
    </div>
  );
}

function SystemView() {
  const stages = [
    { no: "01", title: "語法與安全檢查", text: "拒絕危險匯入、系統操作與不完整語法。" },
    { no: "02", title: "AST 靜態分析", text: "以規則找出結構、節點、變數更新與可疑行號。" },
    { no: "03", title: "隔離測試執行", text: "執行公開、邊界與隱藏案例，保留可驗證證據。" },
    { no: "04", title: "診斷融合", text: "結合靜態規則、測試差異、題目限制與歷史錯誤。" },
    { no: "05", title: "適性提示生成", text: "能力模型決定揭露程度，語言模型只負責表達。" },
  ];
  return (
    <div className="system-view">
      <section className="system-intro"><span>EXPLAINABLE BY DESIGN</span><h2>LLM 不負責猜錯，<br />它只負責把證據說清楚。</h2><p>每一則提示都有規則、測試與學習者狀態作為來源，降低幻覺，也讓研究者能重現診斷結果。</p></section>
      <section className="pipeline">{stages.map((stage, index) => <article key={stage.no}><div><span>{stage.no}</span><em>{index < stages.length - 1 ? "→" : "✓"}</em></div><strong>{stage.title}</strong><p>{stage.text}</p></article>)}</section>
      <section className="transparency-grid">
        <article className="panel"><span>診斷資料格式</span><pre>{`{\n  "rule_id": "ACCUMULATOR_OVERWRITE",\n  "line": 4,\n  "confidence": 0.96,\n  "test_evidence": "actual=3, expected=6",\n  "hint_level": 2\n}`}</pre></article>
        <article className="panel metric-explain"><span>提示決策</span><h3>能力高＋首次錯誤</h3><div><i style={{ width: "28%" }} /></div><p>先給概念型提示，保留自行修正空間。</p><h3>低掌握度＋重複錯誤</h3><div><i style={{ width: "78%" }} /></div><p>指出區域與修改方向，但仍不直接公布答案。</p></article>
        <article className="panel safety-card"><span>執行隔離</span><h3>Defense in depth</h3><ul><li>AST 危險語法預檢</li><li>無網路、非 root 執行</li><li>CPU / RAM / 輸出限制</li><li>逾時終止與一次性工作目錄</li></ul></article>
      </section>
    </div>
  );
}
