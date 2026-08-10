from __future__ import annotations

from ..schemas import Diagnosis, Finding, StaticAnalysis, TestResult


STATIC_WEIGHT = 0.55
TEST_WEIGHT = 0.30
HISTORY_WEIGHT = 0.15


def diagnose(
    static: StaticAnalysis,
    tests: list[TestResult],
    previous_rule_ids: list[str],
) -> Diagnosis:
    candidates = list(static.findings)
    failing = [test for test in tests if not test.passed]

    if failing and not candidates:
        first = failing[0]
        if first.exception:
            candidates.append(
                Finding(
                    rule_id="RUNTIME_EXCEPTION",
                    title="執行測試時發生例外",
                    concept="function",
                    confidence=0.90,
                    severity="error",
                    evidence=first.exception[:300],
                )
            )
        else:
            candidates.append(
                Finding(
                    rule_id="WRONG_OUTPUT",
                    title="輸出結果與規格不符",
                    concept="function",
                    confidence=0.72,
                    evidence=f"{len(failing)} 個測試失敗；需再比對輸入與輸出關係。",
                )
            )

    if not candidates:
        return Diagnosis(primary=None, alternatives=[], evidence_score=1)

    test_signal = min(1.0, len(failing) / max(1, len(tests)))

    def candidate_score(item: Finding) -> float:
        history_signal = 1.0 if item.rule_id in previous_rule_ids else 0.0
        structural_signal = item.confidence
        return (
            STATIC_WEIGHT * structural_signal
            + TEST_WEIGHT * test_signal
            + HISTORY_WEIGHT * history_signal
        )

    ranked = sorted(candidates, key=candidate_score, reverse=True)
    primary = ranked[0]
    return Diagnosis(
        primary=primary,
        alternatives=ranked[1:3],
        evidence_score=min(1, candidate_score(primary)),
    )

