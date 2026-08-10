export type Concept = "迴圈" | "累加器" | "串列" | "字串" | "條件判斷" | "函式";

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
  rawError: string | null;
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
  {
    id: "count-positive",
    index: 4,
    title: "計算正數個數",
    description:
      "完成 count_positive(numbers)，回傳串列中大於 0 的數字個數；0 不算正數。",
    difficulty: "基礎",
    concepts: ["迴圈", "條件判斷", "累加器"],
    starter:
      "def count_positive(numbers):\n    count = 0\n    for number in numbers:\n        if number >= 0:\n            count += 1\n    return count",
    sampleInput: "[-2, 0, 5, 8]",
    sampleOutput: "2",
    functionName: "count_positive",
  },
  {
    id: "count-vowels",
    index: 5,
    title: "計算母音數量",
    description:
      "完成 count_vowels(text)，計算英文文字中的母音數量，並同時處理大小寫。",
    difficulty: "中階",
    concepts: ["迴圈", "條件判斷", "字串"],
    starter:
      "def count_vowels(text):\n    count = 0\n    for char in text:\n        if char in \"aeiou\":\n            count += 1\n    return count",
    sampleInput: "\"OpenAI\"",
    sampleOutput: "4",
    functionName: "count_vowels",
  },
  {
    id: "reverse-text",
    index: 6,
    title: "反轉字串",
    description:
      "完成 reverse_text(text)，使用迴圈反轉字串。請勿使用切片 [::-1] 或 reversed()。",
    difficulty: "中階",
    concepts: ["迴圈", "字串", "累加器"],
    starter:
      "def reverse_text(text):\n    result = \"\"\n    for char in text:\n        result += char\n    return result",
    sampleInput: "\"python\"",
    sampleOutput: "\"nohtyp\"",
    functionName: "reverse_text",
  },
  {
    id: "unique-items",
    index: 7,
    title: "保留順序去重",
    description:
      "完成 unique_items(items)，移除重複項目並保留第一次出現的順序。請勿使用 set()。",
    difficulty: "中階",
    concepts: ["迴圈", "條件判斷", "串列"],
    starter:
      "def unique_items(items):\n    return list(set(items))",
    sampleInput: "[3, 1, 3, 2, 1]",
    sampleOutput: "[3, 1, 2]",
    functionName: "unique_items",
  },
  {
    id: "factorial",
    index: 8,
    title: "計算階乘",
    description:
      "完成 factorial(n)，使用迴圈計算非負整數 n 的階乘，並正確處理 0! = 1。",
    difficulty: "中階",
    concepts: ["迴圈", "累加器", "函式"],
    starter:
      "def factorial(n):\n    result = 0\n    for number in range(1, n + 1):\n        result *= number\n    return result",
    sampleInput: "5",
    sampleOutput: "120",
    functionName: "factorial",
  },
];
