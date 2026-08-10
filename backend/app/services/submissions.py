from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from ..analysis import PythonAnalyzer
from ..database import Database
from ..execution import IsolatedRunner
from ..problems import get_problem
from ..schemas import (
    Diagnosis,
    Finding,
    SubmissionCreate,
    SubmissionResponse,
)
from .diagnosis import diagnose
from .hints import generate_hint
from .mastery import choose_hint_level, update_bkt


class UnknownProblemError(ValueError):
    pass


class SubmissionService:
    def __init__(
        self,
        database: Database,
        analyzer: PythonAnalyzer | None = None,
        runner: IsolatedRunner | None = None,
    ) -> None:
        self.database = database
        self.analyzer = analyzer or PythonAnalyzer()
        self.runner = runner or IsolatedRunner()

    async def submit(self, payload: SubmissionCreate) -> SubmissionResponse:
        problem = get_problem(payload.problem_id)
        if problem is None:
            raise UnknownProblemError(payload.problem_id)

        attempt = self.database.get_attempt_count(payload.user_id, problem.id) + 1
        previous_rules = self.database.recent_rule_ids(payload.user_id, problem.id)
        static = self.analyzer.analyze(payload.code, problem)

        if static.syntax_valid and static.safe_to_execute:
            tests = await asyncio.to_thread(self.runner.run, payload.code, problem)
        else:
            tests = []

        diagnosis = diagnose(static, tests, previous_rules)
        if diagnosis.primary is None:
            primary_concept = problem.concepts[0]
        else:
            primary_concept = diagnosis.primary.concept

        mastery_before = self.database.get_mastery(payload.user_id, primary_concept)
        repeated = bool(
            diagnosis.primary and diagnosis.primary.rule_id in previous_rules[:2]
        )
        hint_level = choose_hint_level(
            attempts=attempt,
            mastery=mastery_before,
            repeated_same_error=repeated,
            requested_level=payload.requested_hint_level,
        )
        hint = await generate_hint(problem, diagnosis, tests, hint_level, mastery_before)

        all_passed = bool(tests) and all(test.passed for test in tests)
        if not static.syntax_valid:
            status = "syntax_error"
        elif not static.safe_to_execute:
            status = "rejected"
        elif all_passed:
            status = "passed"
        else:
            status = "failed"

        mastery_after = update_bkt(mastery_before, all_passed, hint_level)
        self.database.save_mastery(payload.user_id, primary_concept, mastery_after)

        response = SubmissionResponse(
            id=0,
            problem_id=problem.id,
            status=status,
            attempt=attempt,
            static_analysis=static,
            tests=tests,
            diagnosis=diagnosis,
            hint=hint,
            mastery_before=mastery_before,
            mastery_after=mastery_after,
            created_at=datetime.now(UTC),
        )
        response.id = self.database.save_submission(payload.user_id, response, payload.code)
        return response

