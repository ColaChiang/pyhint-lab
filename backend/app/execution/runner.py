from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import tempfile
import textwrap
from typing import Any

from ..config import settings
from ..schemas import Problem, TestResult


RESULT_MARKER = "__PYHINT_RESULT__="


class IsolatedRunner:
    """Runs pre-screened beginner code in a bounded child process.

    The child-process limits are useful for local development. Production should
    also run this service inside the provided no-network, non-root container.
    """

    def run(self, code: str, problem: Problem) -> list[TestResult]:
        harness = self._build_harness(code, problem)
        environment = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "PYTHONHASHSEED": "0",
            "PYTHONIOENCODING": "utf-8",
        }
        with tempfile.TemporaryDirectory(prefix="pyhint-run-") as directory:
            try:
                process = subprocess.run(
                    [sys.executable, "-I", "-S", "-c", harness],
                    cwd=directory,
                    env=environment,
                    text=True,
                    capture_output=True,
                    timeout=settings.runner_timeout_seconds,
                    check=False,
                    preexec_fn=self._set_limits if os.name == "posix" else None,
                    start_new_session=True,
                )
            except subprocess.TimeoutExpired:
                return [
                    TestResult(
                        name="執行時間限制",
                        kind="runtime",
                        passed=False,
                        exception=f"程式執行超過 {settings.runner_timeout_seconds:.1f} 秒。",
                    )
                ]

        output = process.stdout[-settings.runner_output_limit :]
        marker_line = next(
            (line for line in reversed(output.splitlines()) if line.startswith(RESULT_MARKER)),
            None,
        )
        if marker_line is None:
            message = process.stderr[-800:] or "執行程序沒有回傳測試結果。"
            return [
                TestResult(
                    name="執行錯誤",
                    kind="runtime",
                    passed=False,
                    exception=message.strip(),
                )
            ]

        try:
            rows = json.loads(marker_line[len(RESULT_MARKER) :])
            return [TestResult.model_validate(item) for item in rows]
        except (json.JSONDecodeError, ValueError) as exc:
            return [
                TestResult(
                    name="結果解析錯誤",
                    kind="runtime",
                    passed=False,
                    exception=str(exc),
                )
            ]

    @staticmethod
    def _build_harness(code: str, problem: Problem) -> str:
        tests = [test.model_dump(mode="json") for test in problem.tests]
        return textwrap.dedent(
            f"""
            import json
            import time

            CODE = {code!r}
            FUNCTION_NAME = {problem.function_name!r}
            TESTS = {tests!r}
            SAFE_BUILTINS = {{
                "abs": abs, "all": all, "any": any, "bool": bool,
                "enumerate": enumerate, "float": float, "int": int,
                "len": len, "list": list, "range": range,
                "reversed": reversed, "round": round, "str": str,
                "tuple": tuple, "zip": zip,
            }}

            namespace = {{"__builtins__": SAFE_BUILTINS}}
            rows = []
            try:
                exec(compile(CODE, "submission.py", "exec"), namespace, namespace)
                target = namespace[FUNCTION_NAME]
                for test in TESTS:
                    started = time.perf_counter()
                    actual = None
                    exception = None
                    try:
                        actual = target(*test["args"])
                        passed = actual == test["expected"] and type(actual) is type(test["expected"])
                    except Exception as error:
                        passed = False
                        exception = f"{{type(error).__name__}}: {{error}}"
                    duration = (time.perf_counter() - started) * 1000
                    hidden = test["kind"] == "hidden"
                    try:
                        json.dumps(actual)
                        serializable_actual = actual
                    except (TypeError, ValueError):
                        serializable_actual = repr(actual)[:300]
                    rows.append({{
                        "name": test["name"],
                        "kind": test["kind"],
                        "input": None if hidden else test["args"],
                        "expected": None if hidden else test["expected"],
                        "actual": None if hidden else serializable_actual,
                        "passed": passed,
                        "exception": exception,
                        "duration_ms": round(duration, 3),
                    }})
            except Exception as error:
                rows = [{{
                    "name": "載入程式",
                    "kind": "runtime",
                    "input": None,
                    "expected": None,
                    "actual": None,
                    "passed": False,
                    "exception": f"{{type(error).__name__}}: {{error}}",
                    "duration_ms": 0,
                }}]

            print({RESULT_MARKER!r} + json.dumps(rows, ensure_ascii=False))
            """
        )

    @staticmethod
    def _set_limits() -> None:
        import resource

        cpu_seconds = max(1, math.ceil(settings.runner_timeout_seconds))
        memory_bytes = settings.runner_memory_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        resource.setrlimit(resource.RLIMIT_FSIZE, (64 * 1024, 64 * 1024))
        resource.setrlimit(resource.RLIMIT_NOFILE, (16, 16))

