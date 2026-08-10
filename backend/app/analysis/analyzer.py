from __future__ import annotations

import ast
from collections import Counter
from dataclasses import dataclass

from ..schemas import Finding, Problem, StaticAnalysis


BLOCKED_CALLS = {
    "__import__",
    "breakpoint",
    "compile",
    "eval",
    "exec",
    "globals",
    "input",
    "locals",
    "open",
    "setattr",
    "delattr",
    "vars",
}
BLOCKED_ROOTS = {
    "builtins",
    "ctypes",
    "importlib",
    "os",
    "pathlib",
    "shutil",
    "signal",
    "socket",
    "subprocess",
    "sys",
}
SAFE_BUILTINS = {
    "abs",
    "all",
    "any",
    "bool",
    "enumerate",
    "float",
    "int",
    "len",
    "list",
    "range",
    "reversed",
    "round",
    "str",
    "tuple",
    "zip",
    "True",
    "False",
    "None",
}


@dataclass
class _Scan:
    tree: ast.Module
    counts: Counter[str]
    findings: list[Finding]


class PythonAnalyzer:
    """Small, explainable static analyzer for single-function beginner exercises."""

    max_nodes = 500

    def analyze(self, code: str, problem: Problem) -> StaticAnalysis:
        try:
            tree = ast.parse(code, mode="exec")
        except SyntaxError as exc:
            finding = Finding(
                rule_id="SYNTAX_ERROR",
                title="Python 語法不完整",
                concept="function",
                line=exc.lineno,
                confidence=1,
                severity="error",
                evidence=exc.msg,
            )
            return StaticAnalysis(
                syntax_valid=False,
                safe_to_execute=False,
                structures={},
                findings=[finding],
            )

        nodes = list(ast.walk(tree))
        counts = Counter(type(node).__name__ for node in nodes)
        findings: list[Finding] = []
        if len(nodes) > self.max_nodes:
            findings.append(
                Finding(
                    rule_id="PROGRAM_TOO_COMPLEX",
                    title="程式結構超過本題限制",
                    concept="function",
                    line=1,
                    confidence=1,
                    severity="error",
                    evidence=f"AST 含有 {len(nodes)} 個節點，限制為 {self.max_nodes}。",
                )
            )

        scan = _Scan(tree=tree, counts=counts, findings=findings)
        self._check_security(scan)
        target = self._find_target_function(tree, problem.function_name)
        if target is None:
            findings.append(
                Finding(
                    rule_id="MISSING_FUNCTION",
                    title="缺少指定函式",
                    concept="function",
                    line=1,
                    confidence=1,
                    severity="error",
                    evidence=f"找不到 def {problem.function_name}(...)。",
                )
            )
        else:
            self._check_signature(target, problem, findings)
            self._check_required_structures(target, problem, findings)
            self._check_forbidden_calls(target, problem, findings)
            self._check_use_before_assignment(target, findings)
            self._check_problem_patterns(target, problem, findings)

        safe = not any(
            item.severity == "error"
            and item.rule_id
            in {"UNSAFE_SYNTAX", "BLOCKED_CALL", "PROGRAM_TOO_COMPLEX", "MISSING_FUNCTION"}
            for item in findings
        )
        return StaticAnalysis(
            syntax_valid=True,
            safe_to_execute=safe,
            structures=dict(sorted(counts.items())),
            findings=sorted(findings, key=lambda item: (item.severity != "error", -item.confidence)),
        )

    @staticmethod
    def _find_target_function(tree: ast.Module, name: str) -> ast.FunctionDef | None:
        return next(
            (node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == name),
            None,
        )

    @staticmethod
    def _check_security(scan: _Scan) -> None:
        for node in ast.walk(scan.tree):
            if isinstance(node, (ast.Import, ast.ImportFrom, ast.Global, ast.Nonlocal)):
                scan.findings.append(
                    Finding(
                        rule_id="UNSAFE_SYNTAX",
                        title="本練習不允許此語法",
                        concept="function",
                        line=getattr(node, "lineno", None),
                        confidence=1,
                        severity="error",
                        evidence=f"偵測到 {type(node).__name__} 節點。",
                    )
                )
            if isinstance(node, ast.Attribute):
                root = node.value
                while isinstance(root, ast.Attribute):
                    root = root.value
                if isinstance(root, ast.Name) and root.id in BLOCKED_ROOTS:
                    scan.findings.append(
                        Finding(
                            rule_id="UNSAFE_SYNTAX",
                            title="偵測到系統資源存取",
                            concept="function",
                            line=node.lineno,
                            confidence=1,
                            severity="error",
                            evidence=f"不允許存取 {root.id} 的屬性。",
                        )
                    )
                if node.attr.startswith("__"):
                    scan.findings.append(
                        Finding(
                            rule_id="UNSAFE_SYNTAX",
                            title="偵測到雙底線屬性存取",
                            concept="function",
                            line=node.lineno,
                            confidence=1,
                            severity="error",
                            evidence=f"不允許存取 {node.attr}。",
                        )
                    )
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in BLOCKED_CALLS:
                    scan.findings.append(
                        Finding(
                            rule_id="BLOCKED_CALL",
                            title="偵測到不允許的函式呼叫",
                            concept="function",
                            line=node.lineno,
                            confidence=1,
                            severity="error",
                            evidence=f"本練習禁止呼叫 {node.func.id}()。",
                        )
                    )

    @staticmethod
    def _check_signature(
        function: ast.FunctionDef, problem: Problem, findings: list[Finding]
    ) -> None:
        actual = [argument.arg for argument in function.args.args]
        if actual != problem.parameters:
            findings.append(
                Finding(
                    rule_id="WRONG_SIGNATURE",
                    title="函式參數與題目規格不同",
                    concept="function",
                    line=function.lineno,
                    confidence=1,
                    severity="error",
                    evidence=f"預期參數 {problem.parameters}，目前為 {actual}。",
                )
            )

    @staticmethod
    def _check_required_structures(
        function: ast.FunctionDef, problem: Problem, findings: list[Finding]
    ) -> None:
        names = {type(node).__name__ for node in ast.walk(function)}
        concept_by_node = {"For": "loop", "If": "condition", "Return": "function"}
        for required in problem.required_structures:
            if required not in names:
                findings.append(
                    Finding(
                        rule_id=f"MISSING_{required.upper()}",
                        title=f"缺少必要的 {required} 結構",
                        concept=concept_by_node.get(required, "function"),
                        line=function.lineno,
                        confidence=0.98,
                        evidence=f"題目要求 {required}，AST 中沒有找到此節點。",
                    )
                )

    @staticmethod
    def _check_forbidden_calls(
        function: ast.FunctionDef, problem: Problem, findings: list[Finding]
    ) -> None:
        for node in ast.walk(function):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id in problem.forbidden_calls
            ):
                findings.append(
                    Finding(
                        rule_id="FORBIDDEN_CALL",
                        title="使用了題目禁止的內建函式",
                        concept="loop",
                        line=node.lineno,
                        confidence=1,
                        evidence=f"本題要求自行實作，不可使用 {node.func.id}()。",
                    )
                )

    def _check_use_before_assignment(
        self, function: ast.FunctionDef, findings: list[Finding]
    ) -> None:
        defined = {argument.arg for argument in function.args.args}
        already_reported: set[tuple[str, int]] = set()

        def loaded_names(node: ast.AST) -> list[ast.Name]:
            return [
                child
                for child in ast.walk(node)
                if isinstance(child, ast.Name) and isinstance(child.ctx, ast.Load)
            ]

        def targets(node: ast.AST) -> set[str]:
            result: set[str] = set()
            for child in ast.walk(node):
                if isinstance(child, ast.Name) and isinstance(child.ctx, ast.Store):
                    result.add(child.id)
            return result

        def inspect_block(statements: list[ast.stmt], known: set[str]) -> set[str]:
            current = set(known)
            for statement in statements:
                if isinstance(statement, ast.Assign):
                    reads = loaded_names(statement.value)
                elif isinstance(statement, ast.AnnAssign):
                    reads = loaded_names(statement.value) if statement.value else []
                elif isinstance(statement, ast.AugAssign):
                    reads = loaded_names(statement.value)
                    if isinstance(statement.target, ast.Name):
                        reads.append(ast.Name(id=statement.target.id, ctx=ast.Load(), lineno=statement.lineno))
                elif isinstance(statement, ast.For):
                    reads = loaded_names(statement.iter)
                elif isinstance(statement, ast.If):
                    reads = loaded_names(statement.test)
                else:
                    reads = loaded_names(statement)

                for name in reads:
                    key = (name.id, getattr(name, "lineno", statement.lineno))
                    if name.id not in current | SAFE_BUILTINS and key not in already_reported:
                        findings.append(
                            Finding(
                                rule_id="POSSIBLY_UNINITIALIZED",
                                title="變數可能在賦值前使用",
                                concept="function",
                                line=key[1],
                                confidence=0.76,
                                evidence=f"變數 {name.id} 在目前控制流程中尚未確定有值。",
                            )
                        )
                        already_reported.add(key)

                if isinstance(statement, ast.If):
                    body_defs = inspect_block(statement.body, current)
                    else_defs = inspect_block(statement.orelse, current) if statement.orelse else current
                    current |= body_defs & else_defs
                elif isinstance(statement, ast.For):
                    loop_defs = current | targets(statement.target)
                    inspect_block(statement.body, loop_defs)
                    inspect_block(statement.orelse, current)
                else:
                    current |= targets(statement)
            return current

        inspect_block(function.body, defined)

    def _check_problem_patterns(
        self, function: ast.FunctionDef, problem: Problem, findings: list[Finding]
    ) -> None:
        if problem.id == "list-sum":
            self._check_accumulator_overwrite(function, findings)
        elif problem.id == "even-check":
            self._check_reversed_parity(function, findings)
        elif problem.id == "find-max":
            self._check_maximum_initialization(function, findings)

    @staticmethod
    def _check_accumulator_overwrite(
        function: ast.FunctionDef, findings: list[Finding]
    ) -> None:
        for loop in (node for node in ast.walk(function) if isinstance(node, ast.For)):
            loop_target = loop.target.id if isinstance(loop.target, ast.Name) else None
            for statement in loop.body:
                if (
                    isinstance(statement, ast.Assign)
                    and len(statement.targets) == 1
                    and isinstance(statement.targets[0], ast.Name)
                    and statement.targets[0].id == "total"
                    and isinstance(statement.value, ast.Name)
                    and statement.value.id == loop_target
                ):
                    findings.append(
                        Finding(
                            rule_id="ACCUMULATOR_OVERWRITE",
                            title="累加器在迴圈中被覆蓋",
                            concept="accumulator",
                            line=statement.lineno,
                            confidence=0.96,
                            evidence="Assign 節點以目前元素取代 total，沒有讀取 total 原值。",
                        )
                    )

    @staticmethod
    def _check_reversed_parity(
        function: ast.FunctionDef, findings: list[Finding]
    ) -> None:
        for node in ast.walk(function):
            if not isinstance(node, ast.If) or not isinstance(node.test, ast.Compare):
                continue
            rendered = ast.unparse(node.test)
            returns_true = any(
                isinstance(item, ast.Return)
                and isinstance(item.value, ast.Constant)
                and item.value.value is True
                for item in node.body
            )
            if "% 2 == 1" in rendered and returns_true:
                findings.append(
                    Finding(
                        rule_id="REVERSED_PARITY_CONDITION",
                        title="奇偶條件與回傳值相反",
                        concept="condition",
                        line=node.lineno,
                        confidence=0.98,
                        evidence="餘數為 1 代表奇數，但這個分支回傳 True。",
                    )
                )

    @staticmethod
    def _check_maximum_initialization(
        function: ast.FunctionDef, findings: list[Finding]
    ) -> None:
        for statement in function.body:
            if (
                isinstance(statement, ast.Assign)
                and len(statement.targets) == 1
                and isinstance(statement.targets[0], ast.Name)
                and statement.targets[0].id == "largest"
                and isinstance(statement.value, ast.Constant)
                and isinstance(statement.value.value, (int, float))
            ):
                findings.append(
                    Finding(
                        rule_id="UNSAFE_SENTINEL_INITIALIZATION",
                        title="最大值的初始值不適用所有輸入",
                        concept="list",
                        line=statement.lineno,
                        confidence=0.95,
                        evidence="固定常數可能不屬於輸入；全負數測試會受到初始值 0 影響。",
                    )
                )

