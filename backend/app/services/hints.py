from __future__ import annotations

import json

from ..config import settings
from ..schemas import Diagnosis, Hint, Problem, TestResult


TEMPLATES: dict[str, list[str]] = {
    "ACCUMULATOR_OVERWRITE": [
        "想一想：迴圈每跑一次，先前計算的結果是否仍被保留下來？",
        "問題集中在迴圈內更新 total 的那一行。",
        "更新 total 時，需要同時使用原本的 total 與目前元素，而不是直接取代。",
        "可以考慮使用 total += number 逐次更新。",
        "參考結構：total = 0；迴圈內 total += number；迴圈後 return total。",
    ],
    "REVERSED_PARITY_CONDITION": [
        "先確認哪一個餘數才代表偶數。",
        "問題在 if 條件與 True 回傳值的對應關係。",
        "一個數除以 2 的餘數為 0 時才是偶數。",
        "把條件調整為 number % 2 == 0。",
        "可直接回傳 number % 2 == 0，或在此條件成立時回傳 True。",
    ],
    "UNSAFE_SENTINEL_INITIALIZATION": [
        "初始值也必須適用於全為負數的串列。",
        "請檢查 largest 第一次被設定的位置。",
        "不要假設元素都大於 0；從串列中取一個真實元素當候選值。",
        "可以將 largest 初始化為 numbers[0]。",
        "參考結構：largest = numbers[0]，遍歷元素，遇到更大的值就更新。",
    ],
    "FORBIDDEN_CALL": [
        "答案可能正確，但還沒有練習到題目指定的核心概念。",
        "請檢查程式是否使用了題目禁止的內建函式。",
        "改用迴圈逐一處理元素，並自行保存目前結果。",
        "建立結果變數，再使用 for 迴圈更新它。",
        "移除被禁止的內建函式，依序遍歷串列並回傳自行計算的結果。",
    ],
    "MISSING_FOR": [
        "這一題需要重複處理串列中的每個元素。",
        "函式內缺少遍歷 numbers 的區域。",
        "使用 for 迴圈逐一取得串列中的 number。",
        "迴圈可以從 for number in numbers: 開始。",
        "先初始化結果，再遍歷 numbers 更新結果，最後回傳。",
    ],
}


def template_hint(problem: Problem, diagnosis: Diagnosis, level: int) -> Hint:
    finding = diagnosis.primary
    if finding is None:
        return Hint(
            level=level,
            content="所有測試都通過了。請試著說明這個解法為什麼也能處理邊界案例。",
            source="template",
        )
    options = TEMPLATES.get(finding.rule_id)
    if options:
        content = options[level - 1]
    elif level == 1:
        content = f"請重新檢查「{finding.concept}」概念與測試結果的關係。"
    elif level == 2:
        content = f"問題可能位於第 {finding.line or '?'} 行附近。"
    elif level == 3:
        content = finding.evidence
    elif level == 4:
        content = "先只修改診斷指出的區域，再重新執行測試，不需要重寫整個函式。"
    else:
        content = f"請依照題目規格重新整理 {problem.function_name} 的輸入、處理與回傳流程。"
    return Hint(level=level, content=content, source="template", concept=finding.concept)


async def generate_hint(
    problem: Problem,
    diagnosis: Diagnosis,
    tests: list[TestResult],
    level: int,
    mastery: float,
) -> Hint:
    fallback = template_hint(problem, diagnosis, level)
    if not settings.llm_enabled or not settings.openai_api_key or diagnosis.primary is None:
        return fallback

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    evidence = {
        "problem": {
            "title": problem.title,
            "function_name": problem.function_name,
            "concepts": problem.concepts,
        },
        "diagnosis": diagnosis.model_dump(mode="json"),
        "failed_tests": [
            test.model_dump(mode="json")
            for test in tests
            if not test.passed
        ][:3],
        "student": {"mastery": mastery},
        "hint_level": level,
    }
    instructions = (
        "你是 Python 初學者的教學助理。只能使用提供的診斷證據，"
        "以繁體中文產生一則 120 字內的提示。Level 1 只談概念；Level 2 指出區域；"
        "Level 3 解釋修改方向；Level 4 可給片段；只有 Level 5 可給完整解法。"
        "不可新增證據中沒有的錯誤，也不要使用 Markdown 標題。"
    )
    try:
        response = await client.responses.create(
            model=settings.openai_model,
            instructions=instructions,
            input=json.dumps(evidence, ensure_ascii=False),
        )
        content = response.output_text.strip()
        if not content or len(content) > 600:
            return fallback
        if level < 5 and f"def {problem.function_name}" in content:
            return fallback
        return Hint(
            level=level,
            content=content,
            source="openai",
            concept=diagnosis.primary.concept,
        )
    except Exception:
        return fallback
