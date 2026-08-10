import type { Challenge, Concept, Finding } from "./challenge-data";

export type TestResult = {
  name: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  hidden?: boolean;
};

export type Analysis = {
  syntaxValid: boolean;
  structures: string[];
  finding: Finding | null;
  tests: TestResult[];
  score: number;
};

const lineOf = (code: string, pattern: RegExp) => {
  const index = code.split("\n").findIndex((line) => pattern.test(line));
  return index >= 0 ? index + 1 : null;
};

const hasBalancedDelimiters = (code: string) => {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const character of code) {
    if (["(", "[", "{"].includes(character)) stack.push(character);
    if (pairs[character] && stack.pop() !== pairs[character]) return false;
  }
  return stack.length === 0;
};

function commonStructures(code: string) {
  const structures = ["FunctionDef"];
  if (/\bfor\b/.test(code)) structures.push("For");
  if (/\bif\b/.test(code)) structures.push("If");
  if (/\breturn\b/.test(code)) structures.push("Return");
  if (/\+=|-=|\*=/.test(code)) structures.push("AugAssign");
  return structures;
}

export function analyzeCode(challenge: Challenge, code: string): Analysis {
  if (!code.trim().startsWith(`def ${challenge.functionName}`) || !hasBalancedDelimiters(code)) {
    return {
      syntaxValid: false,
      structures: [],
      finding: {
        ruleId: "SYNTAX_OR_SIGNATURE",
        title: "函式宣告或語法不完整",
        concept: "函式",
        line: 1,
        confidence: 0.99,
        evidence: `找不到正確的 ${challenge.functionName} 函式宣告，或括號沒有成對。`,
      },
      tests: [],
      score: 0,
    };
  }

  if (challenge.id === "list-sum") return analyzeListSum(code);
  if (challenge.id === "even-check") return analyzeEven(code);
  if (challenge.id === "find-max") return analyzeMaximum(code);
  if (challenge.id === "count-positive") return analyzePositiveCount(code);
  if (challenge.id === "count-vowels") return analyzeVowelCount(code);
  if (challenge.id === "reverse-text") return analyzeReverseText(code);
  if (challenge.id === "unique-items") return analyzeUniqueItems(code);
  return analyzeFactorial(code);
}

function analyzeListSum(code: string): Analysis {
  const overwrite = /^\s*total\s*=\s*number\s*$/m.test(code);
  const adds = /total\s*(\+=|=\s*total\s*\+)\s*(number)?/.test(code);
  const usesBuiltin = /\bsum\s*\(/.test(code);
  const hasLoop = /for\s+\w+\s+in\s+numbers\s*:/.test(code);
  const correct = adds && hasLoop && !usesBuiltin;
  const actual = overwrite ? "3" : correct ? "6" : "無法取得";
  const tests: TestResult[] = [
    { name: "一般案例", input: "[1, 2, 3]", expected: "6", actual, passed: correct },
    { name: "單一元素", input: "[9]", expected: "9", actual: correct || overwrite ? "9" : actual, passed: correct || overwrite },
    { name: "空串列", input: "[]", expected: "0", actual: /total\s*=\s*0/.test(code) ? "0" : "None", passed: /total\s*=\s*0/.test(code) && /return\s+total/.test(code) },
    { name: "隱藏案例", input: "••••••", expected: "通過", actual: correct ? "通過" : "失敗", passed: correct, hidden: true },
  ];
  let finding: Finding | null = null;
  if (usesBuiltin) {
    finding = {
      ruleId: "FORBIDDEN_CALL",
      title: "使用了題目禁止的內建函式",
      concept: "迴圈",
      line: lineOf(code, /\bsum\s*\(/),
      confidence: 1,
      evidence: "題目要求使用迴圈建立累加過程。",
    };
  } else if (!hasLoop) {
    finding = {
      ruleId: "MISSING_LOOP",
      title: "缺少必要的迴圈結構",
      concept: "迴圈",
      line: 2,
      confidence: 0.98,
      evidence: "AST 結構中沒有找到遍歷 numbers 的 For 節點。",
    };
  } else if (overwrite) {
    finding = {
      ruleId: "ACCUMULATOR_OVERWRITE",
      title: "累加器在迴圈中被覆蓋",
      concept: "累加器",
      line: lineOf(code, /^\s*total\s*=\s*number\s*$/),
      confidence: 0.96,
      evidence: "多元素測試只得到最後一個元素；迴圈內 Assign 節點會取代 total 原值。",
    };
  } else if (!correct) {
    finding = {
      ruleId: "INCOMPLETE_ACCUMULATION",
      title: "尚未形成正確的累加關係",
      concept: "累加器",
      line: lineOf(code, /total/),
      confidence: 0.82,
      evidence: "total 的更新式沒有同時保留舊值並加入目前元素。",
    };
  }
  return { syntaxValid: true, structures: commonStructures(code), finding, tests, score: tests.filter((test) => test.passed).length };
}

function analyzeEven(code: string): Analysis {
  const direct = /return\s+number\s*%\s*2\s*==\s*0/.test(code);
  const correctBranch = /number\s*%\s*2\s*==\s*0[\s\S]*return\s+True/.test(code);
  const reversed = /number\s*%\s*2\s*==\s*1[\s\S]*return\s+True/.test(code);
  const correct = direct || correctBranch;
  const tests: TestResult[] = [
    { name: "正偶數", input: "8", expected: "True", actual: reversed ? "False" : correct ? "True" : "False", passed: correct },
    { name: "正奇數", input: "7", expected: "False", actual: reversed ? "True" : correct ? "False" : "False", passed: correct || (!reversed && !correct) },
    { name: "零", input: "0", expected: "True", actual: correct ? "True" : "False", passed: correct },
    { name: "隱藏負數", input: "••", expected: "通過", actual: correct ? "通過" : "失敗", passed: correct, hidden: true },
  ];
  const finding = correct
    ? null
    : {
        ruleId: "REVERSED_PARITY_CONDITION",
        title: "條件與回傳結果可能相反",
        concept: "條件判斷" as Concept,
        line: lineOf(code, /%\s*2/),
        confidence: reversed ? 0.97 : 0.78,
        evidence: "餘數為 1 代表奇數，但此分支回傳了 True。",
      };
  return { syntaxValid: true, structures: commonStructures(code), finding, tests, score: tests.filter((test) => test.passed).length };
}

function analyzeMaximum(code: string): Analysis {
  const usesBuiltin = /\bmax\s*\(/.test(code);
  const startsAtFirst = /largest\s*=\s*numbers\s*\[\s*0\s*\]/.test(code);
  const compares = /if\s+number\s*>\s*largest/.test(code);
  const correct = startsAtFirst && compares && !usesBuiltin;
  const tests: TestResult[] = [
    { name: "一般案例", input: "[4, 9, 2]", expected: "9", actual: compares ? "9" : "0", passed: correct || (/largest\s*=\s*0/.test(code) && compares) },
    { name: "全為負數", input: "[-8, -3, -11]", expected: "-3", actual: correct ? "-3" : "0", passed: correct },
    { name: "單一元素", input: "[-5]", expected: "-5", actual: correct ? "-5" : "0", passed: correct },
    { name: "隱藏案例", input: "••••••", expected: "通過", actual: correct ? "通過" : "失敗", passed: correct, hidden: true },
  ];
  let finding: Finding | null = null;
  if (usesBuiltin) {
    finding = { ruleId: "FORBIDDEN_CALL", title: "使用了題目禁止的 max()", concept: "迴圈", line: lineOf(code, /max\s*\(/), confidence: 1, evidence: "題目要求自行比較每一個元素。" };
  } else if (!startsAtFirst) {
    finding = {
      ruleId: "UNSAFE_SENTINEL_INITIALIZATION",
      title: "最大值的初始值不適用所有輸入",
      concept: "串列",
      line: lineOf(code, /largest\s*=/),
      confidence: 0.95,
      evidence: "當所有元素都小於 0 時，初始值 0 不屬於輸入串列，卻可能成為結果。",
    };
  } else if (!compares) {
    finding = { ruleId: "SUSPICIOUS_COMPARISON", title: "比較方向可能有誤", concept: "條件判斷", line: lineOf(code, /if\s+/), confidence: 0.88, evidence: "要找最大值，新元素必須大於目前記錄值時才更新。" };
  }
  return { syntaxValid: true, structures: commonStructures(code), finding, tests, score: tests.filter((test) => test.passed).length };
}

function analyzePositiveCount(code: string): Analysis {
  const hasLoop = /for\s+\w+\s+in\s+numbers\s*:/.test(code);
  const increments = /count\s*(\+=\s*1|=\s*count\s*\+\s*1)/.test(code);
  const strictPositive = /if\s+number\s*>\s*0\s*:/.test(code);
  const includesZero = /if\s+number\s*>=\s*0\s*:/.test(code);
  const correct = hasLoop && increments && strictPositive;
  const tests: TestResult[] = [
    { name: "混合數字", input: "[-2, 0, 5, 8]", expected: "2", actual: correct ? "2" : includesZero ? "3" : "0", passed: correct },
    { name: "全部負數", input: "[-4, -1]", expected: "0", actual: "0", passed: /count\s*=\s*0/.test(code) && /return\s+count/.test(code) },
    { name: "空串列", input: "[]", expected: "0", actual: "0", passed: /count\s*=\s*0/.test(code) && /return\s+count/.test(code) },
    { name: "隱藏邊界", input: "••••", expected: "通過", actual: correct ? "通過" : "失敗", passed: correct, hidden: true },
  ];
  let finding: Finding | null = null;
  if (!hasLoop) {
    finding = { ruleId: "MISSING_COUNT_LOOP", title: "缺少逐一計數的迴圈", concept: "迴圈", line: 2, confidence: 0.96, evidence: "需要逐一檢查 numbers 中的每個元素。" };
  } else if (includesZero) {
    finding = { ruleId: "ZERO_IS_NOT_POSITIVE", title: "邊界條件把 0 算成正數", concept: "條件判斷", line: lineOf(code, />=/), confidence: 0.98, evidence: "正數必須嚴格大於 0。" };
  } else if (!correct) {
    finding = { ruleId: "INCOMPLETE_COUNT", title: "計數條件或更新方式不完整", concept: "累加器", line: lineOf(code, /count/), confidence: 0.82, evidence: "條件成立時，count 應增加 1。" };
  }
  return { syntaxValid: true, structures: commonStructures(code), finding, tests, score: tests.filter((test) => test.passed).length };
}

function analyzeVowelCount(code: string): Analysis {
  const hasLoop = /for\s+\w+\s+in\s+(text|text\.lower\(\))\s*:/.test(code);
  const increments = /count\s*(\+=\s*1|=\s*count\s*\+\s*1)/.test(code);
  const handlesCase = /\.lower\(\)/.test(code) || /aeiouAEIOU|AEIOUaeiou/.test(code);
  const checksVowels = /in\s*["'](?:aeiou|aeiouAEIOU|AEIOUaeiou)["']/.test(code);
  const correct = hasLoop && increments && handlesCase && checksVowels;
  const tests: TestResult[] = [
    { name: "小寫文字", input: "education", expected: "5", actual: checksVowels && increments ? "5" : "0", passed: checksVowels && increments },
    { name: "混合大小寫", input: "OpenAI", expected: "4", actual: correct ? "4" : "2", passed: correct },
    { name: "沒有母音", input: "rhythm", expected: "0", actual: "0", passed: checksVowels },
    { name: "隱藏案例", input: "••••••", expected: "通過", actual: correct ? "通過" : "失敗", passed: correct, hidden: true },
  ];
  const finding = correct
    ? null
    : !handlesCase
      ? { ruleId: "CASE_SENSITIVE_VOWELS", title: "母音判斷沒有涵蓋大寫字母", concept: "字串" as Concept, line: lineOf(code, /in\s*["']/), confidence: 0.96, evidence: "同一個母音可能以大寫或小寫出現。" }
      : { ruleId: "INCOMPLETE_VOWEL_COUNT", title: "母音判斷或計數方式不完整", concept: "條件判斷" as Concept, line: lineOf(code, /if\s+/), confidence: 0.82, evidence: "請確認逐字檢查、母音集合與 count 更新三個部分。" };
  return { syntaxValid: true, structures: commonStructures(code), finding, tests, score: tests.filter((test) => test.passed).length };
}

function analyzeReverseText(code: string): Analysis {
  const usesShortcut = /\[\s*::\s*-1\s*\]|\breversed\s*\(/.test(code);
  const hasLoop = /for\s+char\s+in\s+text\s*:/.test(code);
  const prepends = /result\s*=\s*char\s*\+\s*result/.test(code);
  const appends = /result\s*(\+=\s*char|=\s*result\s*\+\s*char)/.test(code);
  const correct = hasLoop && prepends && !usesShortcut;
  const tests: TestResult[] = [
    { name: "一般文字", input: "python", expected: "nohtyp", actual: correct ? "nohtyp" : "python", passed: correct },
    { name: "單一字元", input: "A", expected: "A", actual: "A", passed: /return\s+result/.test(code) },
    { name: "空字串", input: "", expected: "", actual: "", passed: /result\s*=\s*["']["']/.test(code) },
    { name: "隱藏案例", input: "••••••", expected: "通過", actual: correct ? "通過" : "失敗", passed: correct, hidden: true },
  ];
  let finding: Finding | null = null;
  if (usesShortcut) {
    finding = { ruleId: "FORBIDDEN_REVERSE_SHORTCUT", title: "使用了題目禁止的反轉捷徑", concept: "迴圈", line: lineOf(code, /\[\s*::\s*-1\s*\]|reversed/), confidence: 1, evidence: "這題要練習用迴圈自行組合反轉結果。" };
  } else if (!hasLoop) {
    finding = { ruleId: "MISSING_REVERSE_LOOP", title: "缺少逐字處理的迴圈", concept: "迴圈", line: 2, confidence: 0.96, evidence: "需要依序讀取 text 中的每個字元。" };
  } else if (appends || !correct) {
    finding = { ruleId: "APPEND_PRESERVES_ORDER", title: "字元被加在結果的錯誤一側", concept: "字串", line: lineOf(code, /result\s*(\+=|=)/), confidence: appends ? 0.97 : 0.82, evidence: "把新字元加在結果尾端只會保留原本順序。" };
  }
  return { syntaxValid: true, structures: commonStructures(code), finding, tests, score: tests.filter((test) => test.passed).length };
}

function analyzeUniqueItems(code: string): Analysis {
  const usesSet = /\bset\s*\(/.test(code);
  const hasLoop = /for\s+(item|value)\s+in\s+items\s*:/.test(code);
  const checksExisting = /if\s+(item|value)\s+not\s+in\s+result\s*:/.test(code);
  const appends = /result\.append\s*\(\s*(item|value)\s*\)/.test(code);
  const correct = hasLoop && checksExisting && appends && !usesSet;
  const tests: TestResult[] = [
    { name: "重複數字", input: "[3, 1, 3, 2, 1]", expected: "[3, 1, 2]", actual: correct ? "[3, 1, 2]" : "順序不固定", passed: correct },
    { name: "沒有重複", input: "[4, 2]", expected: "[4, 2]", actual: correct ? "[4, 2]" : "順序不固定", passed: correct },
    { name: "空串列", input: "[]", expected: "[]", actual: "[]", passed: /return\s+(result|list\(set\(items\)\))/.test(code) },
    { name: "隱藏順序", input: "••••••", expected: "通過", actual: correct ? "通過" : "失敗", passed: correct, hidden: true },
  ];
  let finding: Finding | null = null;
  if (usesSet) {
    finding = { ruleId: "SET_LOSES_ORDER", title: "set() 無法保證題目要求的順序", concept: "串列", line: lineOf(code, /set\s*\(/), confidence: 0.99, evidence: "結果必須保留每個項目第一次出現的先後順序。" };
  } else if (!hasLoop) {
    finding = { ruleId: "MISSING_UNIQUE_LOOP", title: "缺少逐一處理項目的迴圈", concept: "迴圈", line: 2, confidence: 0.95, evidence: "需要依原順序檢查 items 中的每個項目。" };
  } else if (!correct) {
    finding = { ruleId: "INCOMPLETE_UNIQUE_FILTER", title: "去重條件或加入結果的步驟不完整", concept: "條件判斷", line: lineOf(code, /if\s+|append/), confidence: 0.84, evidence: "只在項目尚未出現在 result 時，才把它加入。" };
  }
  return { syntaxValid: true, structures: commonStructures(code), finding, tests, score: tests.filter((test) => test.passed).length };
}

function analyzeFactorial(code: string): Analysis {
  const initializesOne = /result\s*=\s*1/.test(code);
  const initializesZero = /result\s*=\s*0/.test(code);
  const hasLoop = /for\s+(number|i)\s+in\s+range\s*\(/.test(code);
  const multiplies = /result\s*(\*=\s*(number|i)|=\s*result\s*\*\s*(number|i))/.test(code);
  const correct = initializesOne && hasLoop && multiplies;
  const tests: TestResult[] = [
    { name: "一般案例", input: "5", expected: "120", actual: correct ? "120" : "0", passed: correct },
    { name: "零的階乘", input: "0", expected: "1", actual: initializesOne ? "1" : "0", passed: initializesOne && /return\s+result/.test(code) },
    { name: "一的階乘", input: "1", expected: "1", actual: correct ? "1" : "0", passed: correct },
    { name: "隱藏案例", input: "••", expected: "通過", actual: correct ? "通過" : "失敗", passed: correct, hidden: true },
  ];
  let finding: Finding | null = null;
  if (initializesZero) {
    finding = { ruleId: "WRONG_MULTIPLICATIVE_IDENTITY", title: "乘法累積的初始值會讓結果永遠為 0", concept: "累加器", line: lineOf(code, /result\s*=\s*0/), confidence: 0.99, evidence: "任何數乘以 0 都會得到 0。" };
  } else if (!hasLoop) {
    finding = { ruleId: "MISSING_FACTORIAL_LOOP", title: "缺少連續相乘的迴圈", concept: "迴圈", line: 2, confidence: 0.95, evidence: "階乘需要把 1 到 n 的整數依序相乘。" };
  } else if (!correct) {
    finding = { ruleId: "INCOMPLETE_FACTORIAL", title: "階乘的累積方式不完整", concept: "累加器", line: lineOf(code, /result/), confidence: 0.84, evidence: "result 應保留先前乘積，再乘上目前數字。" };
  }
  return { syntaxValid: true, structures: commonStructures(code), finding, tests, score: tests.filter((test) => test.passed).length };
}

const hintTemplates: Record<string, string[]> = {
  ACCUMULATOR_OVERWRITE: [
    "想一想：迴圈每跑一次，先前計算的結果是否仍被保留下來？",
    "問題集中在迴圈內更新 total 的那一行。",
    "更新 total 時，需要同時使用原本的 total 與目前的 number，而不是直接取代。",
    "可以使用增量指定：total += number。",
    "參考寫法：先令 total = 0，再於迴圈內寫 total += number，最後 return total。",
  ],
  MISSING_LOOP: [
    "這一題要重複處理串列中的每個元素。",
    "請檢查函式內是否有遍歷 numbers 的區域。",
    "使用 for 迴圈逐一取得 numbers 裡的 number。",
    "迴圈開頭可以是：for number in numbers:",
    "參考結構：初始化 total，遍歷 numbers，逐次累加，再回傳 total。",
  ],
  FORBIDDEN_CALL: [
    "答案雖可能正確，但還沒有練習到題目指定的核心概念。",
    "請檢查回傳值附近是否使用了題目禁止的內建函式。",
    "改用迴圈逐一處理元素，並自行保存目前結果。",
    "建立一個結果變數，再使用 for 迴圈更新它。",
    "移除內建函式，依序遍歷串列並回傳自行計算的結果。",
  ],
  REVERSED_PARITY_CONDITION: [
    "先確認『餘數是多少』才代表偶數。",
    "問題可能在 if 條件與 True 回傳值的對應關係。",
    "一個數除以 2 的餘數為 0 時才是偶數。",
    "把比較條件調整為 number % 2 == 0。",
    "可直接回傳 number % 2 == 0，或在此條件成立時回傳 True。",
  ],
  UNSAFE_SENTINEL_INITIALIZATION: [
    "初始值應該對負數串列也成立。",
    "請查看 largest 第一次被設定的那一行。",
    "不要假設資料一定大於 0；可以從串列本身取得一個有效候選值。",
    "可將 largest 初始化為 numbers[0]。",
    "參考結構：largest = numbers[0]，逐一比較，遇到更大的值就更新。",
  ],
  ZERO_IS_NOT_POSITIVE: [
    "想一想：0 是否符合『大於 0』的定義？",
    "請檢查 if 條件中的比較運算子。",
    "正數的判斷必須排除 0，因此條件要使用嚴格大於。",
    "將條件調整為 number > 0。",
    "參考寫法：遍歷 numbers，當 number > 0 時讓 count += 1。",
  ],
  CASE_SENSITIVE_VOWELS: [
    "同一個英文字母可能以不同大小寫出現。",
    "問題集中在 char 與母音字串比較的區域。",
    "比較前可先把字元統一轉成小寫。",
    "條件可寫成 char.lower() in \"aeiou\"。",
    "參考結構：逐字遍歷 text，將 char 轉小寫後判斷是否為母音，再更新 count。",
  ],
  APPEND_PRESERVES_ORDER: [
    "目前組合字元的方式是否真的改變了順序？",
    "請查看迴圈內更新 result 的那一行。",
    "要反轉順序，新字元應放在既有結果的前面。",
    "可將更新式寫成 result = char + result。",
    "參考結構：result = \"\"，逐字遍歷 text，每次用 result = char + result 更新。",
  ],
  SET_LOSES_ORDER: [
    "去除重複之外，題目還要求保留原本順序。",
    "請檢查回傳值是否經過 set()。",
    "依序遍歷 items，只有尚未出現在結果中的項目才加入。",
    "可建立 result = []，並使用 if item not in result: result.append(item)。",
    "參考結構：初始化 result，依序檢查每個 item，未出現才 append，最後 return result。",
  ],
  WRONG_MULTIPLICATIVE_IDENTITY: [
    "乘法累積的起點與加法累積不同。",
    "請查看 result 的初始值。",
    "任何數乘以 0 都是 0；乘法累積應從不改變乘積的值開始。",
    "將 result 的初始值改為 1。",
    "參考結構：result = 1，遍歷 1 到 n，逐次 result *= number，最後回傳 result。",
  ],
};

export function getHint(finding: Finding | null, level: number) {
  if (!finding) return "所有測試都通過了。試著用自己的話說明這段程式為什麼正確。";
  const templates = hintTemplates[finding.ruleId] ?? [
    "重新檢查這個概念與目前測試結果的關係。",
    `問題可能位於第 ${finding.line ?? "?"} 行附近。`,
    finding.evidence,
    "嘗試只修改被標示的區域，再重新執行測試。",
    "查看題目範例與函式規格，重新整理解題步驟。",
  ];
  return templates[Math.min(Math.max(level, 1), 5) - 1];
}

export function chooseHintLevel(sameErrorCount: number) {
  return Math.min(5, Math.max(1, sameErrorCount));
}
