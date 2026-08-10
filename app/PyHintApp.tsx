"use client";

import { useEffect, useMemo, useState } from "react";
import { Challenge, PublicAnalysis, challenges } from "./challenge-data";

type View = "workspace" | "progress" | "system";

const masterySeed = [
  { label: "迴圈", value: 72, delta: "+8" },
  { label: "條件判斷", value: 58, delta: "+3" },
  { label: "串列", value: 81, delta: "+6" },
  { label: "函式", value: 66, delta: "+4" },
  { label: "累加器", value: 41, delta: "+12" },
];

const hintLevelDescriptions: Record<number, string> = {
  1: "概念線索｜保留最多思考空間",
  2: "範圍線索｜指出可能的程式區域",
  3: "方向提示｜說明應如何思考修改",
  4: "部分程式碼｜提供關鍵寫法",
  5: "完整解法｜說明完整修正方式",
};

export default function PyHintApp({ user }: { user: { name: string; email: string } }) {
  const [view, setView] = useState<View>("workspace");
  const [challenge, setChallenge] = useState<Challenge>(challenges[0]);
  const [code, setCode] = useState(challenges[0].starter);
  const [analysis, setAnalysis] = useState<PublicAnalysis | null>(null);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [errorProgress, setErrorProgress] = useState<Record<string, { ruleId: string | null; streak: number }>>({});
  const [hintLevel, setHintLevel] = useState(0);
  const [remoteHint, setRemoteHint] = useState<string | null>(null);
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [mastery, setMastery] = useState(masterySeed);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<{ title: string; result: string; time: string }[]>([
    { title: "交換兩個變數", result: "通過", time: "今天 09:14" },
    { title: "判斷正負數", result: "通過", time: "昨天 20:32" },
  ]);

  const currentAttempts = attempts[challenge.id] ?? 0;
  const currentErrorProgress = errorProgress[challenge.id] ?? { ruleId: null, streak: 0 };
  const lineNumbers = useMemo(() => code.split("\n").map((_, index) => index + 1), [code]);
  const masteryByConcept = useMemo(
    () => Object.fromEntries(mastery.map((item) => [item.label, item.value])),
    [mastery],
  );

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
    setAnalysisCollapsed(false);
    setView("workspace");
  }

  async function runAnalysis() {
    setRunning(true);
    const nextAttempts = currentAttempts + 1;
    let nextAnalysis: PublicAnalysis;
    let nextHint: { content: string; level: number; errorStreak: number };
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problemId: challenge.id,
          code,
          attempts: nextAttempts,
          masteryByConcept,
          previousRuleId: currentErrorProgress.ruleId,
          previousErrorStreak: currentErrorProgress.streak,
        }),
      });
      if (!response.ok) throw new Error("analysis failed");
      const payload = (await response.json()) as { analysis: PublicAnalysis; hint: { content: string; level: number; errorStreak: number } };
      nextAnalysis = payload.analysis;
      nextHint = payload.hint;
    } catch {
      setRunning(false);
      setRemoteHint("目前無法連線到診斷服務，請稍後再試一次。");
      return;
    }
    setAnalysis(nextAnalysis);
    setAnalysisCollapsed(false);
    setAttempts((previous) => ({ ...previous, [challenge.id]: nextAttempts }));
    setErrorProgress((previous) => ({
      ...previous,
      [challenge.id]: {
        ruleId: nextAnalysis.finding?.ruleId ?? null,
        streak: nextAnalysis.finding ? nextHint.errorStreak : 0,
      },
    }));
    setHintLevel(nextAnalysis.finding ? nextHint.level : 0);
    setRemoteHint(nextAnalysis.finding ? nextHint.content : null);
    setHistory((previous) => [
      {
        title: challenge.title,
        result: nextAnalysis.total > 0 && nextAnalysis.passed === nextAnalysis.total ? "通過" : `第 ${nextAttempts} 次嘗試`,
        time: "剛剛",
      },
      ...previous.slice(0, 5),
    ]);
    if (nextAnalysis.total > 0 && nextAnalysis.passed === nextAnalysis.total) {
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
        passed: nextAnalysis.passed,
        total: nextAnalysis.total,
        ruleId: nextAnalysis.finding?.ruleId ?? null,
        hintLevel: nextAnalysis.finding ? nextHint.level : 0,
      }),
    }).catch(() => undefined);
  }

  async function requestNextHint() {
    if (!analysis || hintLevel >= 5) return;
    const requestedLevel = Math.min(5, hintLevel + 1);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problemId: challenge.id,
          code,
          attempts: currentAttempts,
          masteryByConcept,
          previousRuleId: analysis.finding?.ruleId ?? null,
          previousErrorStreak: currentErrorProgress.streak,
          requestedLevel,
        }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { hint: { content: string; level: number } };
      setHintLevel(payload.hint.level);
      setRemoteHint(payload.hint.content);
    } catch {
      // Keep the current hint when the service is temporarily unavailable.
    }
  }

  const initials = user.name === "學習者" ? "PL" : user.name.slice(0, 2).toUpperCase();
  const pageEyebrow = view === "workspace"
    ? `PYTHON FOUNDATIONS · EXERCISE 0${challenge.index}`
    : view === "progress"
      ? "LEARNING ANALYTICS · PERSONAL DASHBOARD"
      : "SYSTEM TRANSPARENCY · ANALYSIS PIPELINE";

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
            <span className="eyebrow">{pageEyebrow}</span>
            <h1>{view === "workspace" ? challenge.title : view === "progress" ? "你的學習軌跡" : "診斷引擎透明度"}</h1>
          </div>
          <div className="topbar-actions">
            <div className="course-progress"><span><b>本單元</b><em>62%</em></span><i><u /></i></div>
            {view === "workspace" && <button className="run-button" onClick={runAnalysis} disabled={running}>{running ? "分析中…" : "執行分析"}<kbd>⌘ ↵</kbd></button>}
          </div>
        </header>

        {view === "workspace" && (
          <div className={`workspace-grid ${analysis ? "has-analysis" : ""}`}>
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
                <button onClick={() => { setCode(challenge.starter); setAnalysis(null); setHintLevel(0); setRemoteHint(null); setAnalysisCollapsed(false); }}>重設</button>
              </div>
              <div className="code-editor-wrap">
                <div className="line-numbers" aria-hidden="true">{lineNumbers.map((number) => <span key={number}>{number}</span>)}</div>
                <textarea
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setAnalysis(null);
                    setHintLevel(0);
                    setRemoteHint(null);
                    setAnalysisCollapsed(false);
                  }}
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

            {analysis && (
              <aside className={`insight-panel panel ${analysisCollapsed ? "is-collapsed" : ""}`} aria-live="polite">
                <div className="hint-heading">
                  <div className="panel-label"><span>{analysis.finding ? "!" : "✓"}</span>{analysis.finding ? "執行錯誤與適性提示" : "執行結果"}</div>
                  <div className="hint-heading-actions">
                    <strong>{analysis.finding ? "提示已啟用" : "作答完成"}</strong>
                    <button
                      className="collapse-button"
                      type="button"
                      aria-expanded={!analysisCollapsed}
                      onClick={() => setAnalysisCollapsed((current) => !current)}
                    >
                      {analysisCollapsed ? "展開" : "收合"}<span aria-hidden="true">{analysisCollapsed ? "⌄" : "⌃"}</span>
                    </button>
                  </div>
                </div>
                {!analysisCollapsed && (
                  <div className={`analysis-content ${analysis.finding ? "error-view" : "success-view"}`}>
                    <div className="execution-column">
                    <div className="analysis-head">
                      <span className={analysis.finding ? "warning" : "success"}>{analysis.finding ? "執行未通過" : "所有測試通過"}</span>
                      <small>第 {currentAttempts} 次嘗試</small>
                    </div>
                    {analysis.finding ? (
                      <div className="raw-error-card">
                        <span>原始錯誤輸出</span>
                        <pre>{analysis.rawError ?? "ExecutionError: 程式未通過檢查"}</pre>
                        <small>測資內容不公開</small>
                      </div>
                    ) : (
                      <div className="success-card">
                        <span>✓</span>
                        <div><strong>答案正確，不需要提示</strong><p>程式已通過所有系統測試，因此不會顯示提示 Level。</p></div>
                      </div>
                    )}
                  </div>
                  {analysis.finding && (
                    <div className="hint-card">
                      <div><span>適性提示 · LEVEL {hintLevel}</span><small>相同錯誤第 {currentErrorProgress.streak} 次</small></div>
                      <p>{remoteHint ?? "正在準備適合你的提示…"}</p>
                      <div className="level-explain">{hintLevelDescriptions[hintLevel]}</div>
                      {hintLevel < 5 && <button onClick={requestNextHint}>我還需要更具體的提示 <span>→</span></button>}
                    </div>
                  )}
                  </div>
                )}
              </aside>
            )}
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
    { no: "03", title: "隔離測試執行", text: "執行一般、邊界與隱藏案例；學生端只顯示通過總數，不公開測資。" },
    { no: "04", title: "診斷融合", text: "結合靜態規則、測試差異、題目限制與歷史錯誤。" },
    { no: "05", title: "適性提示生成", text: "每種錯誤首次固定從 Level 1 開始；相同錯誤重複出現才逐層增加。" },
  ];
  return (
    <div className="system-view">
      <section className="system-intro"><span>EXPLAINABLE BY DESIGN</span><h2>LLM 不負責猜錯，<br />它只負責把證據說清楚。</h2><p>每一則提示都有規則、測試與學習者狀態作為來源，降低幻覺，也讓研究者能重現診斷結果。</p></section>
      <section className="pipeline">{stages.map((stage, index) => <article key={stage.no}><div><span>{stage.no}</span><em>{index < stages.length - 1 ? "→" : "✓"}</em></div><strong>{stage.title}</strong><p>{stage.text}</p></article>)}</section>
      <section className="transparency-grid">
        <article className="panel"><span>診斷資料格式</span><pre>{`{\n  "rule_id": "ACCUMULATOR_OVERWRITE",\n  "line": 4,\n  "confidence": 0.96,\n  "tests_passed": 2,\n  "tests_total": 4,\n  "hint_level": 1\n}`}</pre></article>
        <article className="panel metric-explain"><span>提示決策</span><h3>首次出現任何錯誤</h3><div><i style={{ width: "20%" }} /></div><p>固定從 Level 1 概念線索開始，不因低掌握度直接跳級。</p><h3>相同錯誤持續出現</h3><div><i style={{ width: "60%" }} /></div><p>每次只提高一層；若錯誤類型改變，則重新從 Level 1 開始。</p></article>
        <article className="panel safety-card"><span>執行隔離</span><h3>Defense in depth</h3><ul><li>AST 危險語法預檢</li><li>無網路、非 root 執行</li><li>CPU / RAM / 輸出限制</li><li>逾時終止與一次性工作目錄</li></ul></article>
      </section>
    </div>
  );
}
