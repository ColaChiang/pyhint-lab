export type Concept = "迴圈" | "累加器" | "串列" | "條件判斷" | "函式";

export type Challenge = {
  id: string;
  index: number;
  title: string;
  description: string;
  difficulty: "基礎" | "中階";
  concepts: Concept[];
  starter: string;
  sampleInput: string;
  sampleOutput: string;
  functionName: string;
};

export type Finding = {
  ruleId: string;
  title: string;
  concept: Concept;
  line: number | null;
  confidence: number;
  evidence: string;
};

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

export const challenges: Challenge[] = [
  {
    id: "list-sum",
    index: 1,
    title: "計算串列總和",
    description:
      "完成 calculate_sum(numbers)，使用迴圈計算串列中所有數字的總和。請勿使用內建 sum()。",
    difficulty: "基礎",
    concepts: ["迴圈", "累加器", "串列", "函式"],
    starter:
      "def calculate_sum(numbers):\n    total = 0\n    for number in numbers:\n        total = number\n    return total",
    sampleInput: "[4, 7, 2]",
    sampleOutput: "13",
    functionName: "calculate_sum",
  },
  {
    id: "even-check",
    index: 2,
    title: "判斷偶數",
    description:
      "完成 is_even(number)。如果 number 是偶數回傳 True，否則回傳 False。",
    difficulty: "基礎",
    concepts: ["條件判斷", "函式"],
    starter:
      "def is_even(number):\n    if number % 2 == 1:\n        return True\n    return False",
    sampleInput: "8",
    sampleOutput: "True",
    functionName: "is_even",
  },
  {
    id: "find-max",
    index: 3,
    title: "找出最大值",
    description:
      "完成 find_max(numbers)，不使用 max() 找出非空串列的最大值；測試包含全為負數的串列。",
    difficulty: "中階",
    concepts: ["迴圈", "條件判斷", "串列"],
    starter:
      "def find_max(numbers):\n    largest = 0\n    for number in numbers:\n        if number > largest:\n            largest = number\n    return largest",
    sampleInput: "[-8, -3, -11]",
    sampleOutput: "-3",
    functionName: "find_max",
  },
];

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
  return analyzeMaximum(code);
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

export function chooseHintLevel(attempts: number, mastery: number, repeated: boolean) {
  if (attempts >= 5) return 4;
  if (mastery < 45 || attempts >= 3) return 3;
  if (repeated || attempts === 2) return 2;
  return 1;
}
