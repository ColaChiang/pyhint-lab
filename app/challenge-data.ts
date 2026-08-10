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

export type PublicAnalysis = {
  syntaxValid: boolean;
  structures: string[];
  finding: Finding | null;
  passed: number;
  total: number;
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
      "完成 find_max(numbers)，不使用 max() 找出非空串列的最大值；函式必須能正確處理負數。",
    difficulty: "中階",
    concepts: ["迴圈", "條件判斷", "串列"],
    starter:
      "def find_max(numbers):\n    largest = 0\n    for number in numbers:\n        if number > largest:\n            largest = number\n    return largest",
    sampleInput: "[-8, -3, -11]",
    sampleOutput: "-3",
    functionName: "find_max",
  },
];
