import unittest

from app.analysis import PythonAnalyzer
from app.problems import get_problem


class AnalyzerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = PythonAnalyzer()

    def test_detects_accumulator_overwrite_with_line(self) -> None:
        problem = get_problem("list-sum")
        assert problem is not None
        result = self.analyzer.analyze(problem.starter_code, problem)
        finding = next(item for item in result.findings if item.rule_id == "ACCUMULATOR_OVERWRITE")
        self.assertEqual(finding.line, 4)
        self.assertGreater(finding.confidence, 0.9)
        self.assertTrue(result.safe_to_execute)

    def test_rejects_import_before_execution(self) -> None:
        problem = get_problem("list-sum")
        assert problem is not None
        code = "import os\n" + problem.starter_code
        result = self.analyzer.analyze(code, problem)
        self.assertFalse(result.safe_to_execute)
        self.assertIn("UNSAFE_SYNTAX", {item.rule_id for item in result.findings})

    def test_detects_negative_list_initialization_bug(self) -> None:
        problem = get_problem("find-max")
        assert problem is not None
        result = self.analyzer.analyze(problem.starter_code, problem)
        self.assertIn(
            "UNSAFE_SENTINEL_INITIALIZATION",
            {item.rule_id for item in result.findings},
        )

    def test_reports_syntax_error_without_crashing(self) -> None:
        problem = get_problem("even-check")
        assert problem is not None
        result = self.analyzer.analyze("def is_even(number)\n  return True", problem)
        self.assertFalse(result.syntax_valid)
        self.assertEqual(result.findings[0].rule_id, "SYNTAX_ERROR")


if __name__ == "__main__":
    unittest.main()

