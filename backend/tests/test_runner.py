import unittest

from app.execution import IsolatedRunner
from app.problems import get_problem


class RunnerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.runner = IsolatedRunner()

    def test_correct_solution_passes_all_tests(self) -> None:
        problem = get_problem("list-sum")
        assert problem is not None
        code = (
            "def calculate_sum(numbers):\n"
            "    total = 0\n"
            "    for number in numbers:\n"
            "        total += number\n"
            "    return total"
        )
        results = self.runner.run(code, problem)
        self.assertEqual(len(results), 4)
        self.assertTrue(all(item.passed for item in results))
        hidden = next(item for item in results if item.kind == "hidden")
        self.assertIsNone(hidden.input)
        self.assertIsNone(hidden.expected)

    def test_wrong_solution_produces_verifiable_failure(self) -> None:
        problem = get_problem("list-sum")
        assert problem is not None
        results = self.runner.run(problem.starter_code, problem)
        regular = next(item for item in results if item.name == "一般案例")
        self.assertFalse(regular.passed)
        self.assertEqual(regular.actual, 3)
        self.assertEqual(regular.expected, 6)


if __name__ == "__main__":
    unittest.main()

