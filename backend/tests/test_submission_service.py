import tempfile
import unittest
from pathlib import Path

from app.database import Database
from app.problems import get_problem
from app.schemas import SubmissionCreate
from app.services.submissions import SubmissionService


class SubmissionServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="pyhint-test-")
        self.database = Database(Path(self.temporary.name) / "test.db")
        self.database.initialize()
        self.service = SubmissionService(self.database)

    async def asyncTearDown(self) -> None:
        self.temporary.cleanup()

    async def test_submission_combines_analysis_tests_hint_and_mastery(self) -> None:
        problem = get_problem("list-sum")
        assert problem is not None
        response = await self.service.submit(
            SubmissionCreate(
                user_id="student-1",
                problem_id=problem.id,
                code=problem.starter_code,
            )
        )
        self.assertEqual(response.status, "failed")
        self.assertEqual(response.diagnosis.primary.rule_id, "ACCUMULATOR_OVERWRITE")
        self.assertEqual(response.hint.level, 3)
        self.assertEqual(response.hint.source, "template")
        self.assertLess(response.mastery_after, response.mastery_before)
        self.assertGreater(response.id, 0)
        history = self.database.history("student-1")
        self.assertEqual(history[0].rule_id, "ACCUMULATOR_OVERWRITE")
        mastery = self.database.list_mastery("student-1")
        accumulator = next(item for item in mastery if item.concept == "accumulator")
        self.assertEqual(accumulator.observations, 1)

    async def test_correct_submission_raises_mastery(self) -> None:
        code = (
            "def is_even(number):\n"
            "    return number % 2 == 0"
        )
        response = await self.service.submit(
            SubmissionCreate(user_id="student-2", problem_id="even-check", code=code)
        )
        self.assertEqual(response.status, "passed")
        self.assertGreater(response.mastery_after, response.mastery_before)
        self.assertTrue(all(item.passed for item in response.tests))


if __name__ == "__main__":
    unittest.main()
