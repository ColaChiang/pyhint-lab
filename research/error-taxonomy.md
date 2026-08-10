# PyHint error taxonomy

The taxonomy is intentionally small enough to label consistently. Every label must be supported by static structure, a failed test, or both.

| Rule | Concept | Detection evidence | Suggested minimum hint |
| --- | --- | --- | --- |
| `SYNTAX_ERROR` | function | `ast.parse` exception and line | 2 |
| `MISSING_FUNCTION` | function | named `FunctionDef` absent | 2 |
| `WRONG_SIGNATURE` | function | argument list differs from specification | 2 |
| `MISSING_FOR` | loop | required `For` node absent | 1 |
| `MISSING_IF` | condition | required `If` node absent | 1 |
| `MISSING_RETURN` | function | required `Return` node absent | 2 |
| `FORBIDDEN_CALL` | loop | forbidden `Call` node present | 2 |
| `ACCUMULATOR_OVERWRITE` | accumulator | loop-body assignment does not read old value | 1 |
| `REVERSED_PARITY_CONDITION` | condition | odd predicate maps to `True` | 1 |
| `UNSAFE_SENTINEL_INITIALIZATION` | list | fixed numeric maximum seed plus negative test | 1 |
| `POSSIBLY_UNINITIALIZED` | function | load not dominated by a definition in simplified flow | 2 |
| `RUNTIME_EXCEPTION` | function | isolated test raises an exception | 2 |
| `WRONG_OUTPUT` | function | one or more outputs differ without a stronger rule | 1 |

## Labeling rules

1. Use the strongest specific rule rather than `WRONG_OUTPUT` when both are available.
2. Preserve alternative diagnoses for evaluation, but expose one primary diagnosis to the learner.
3. Do not label an answer incorrect only because its AST differs from the reference solution, unless the problem explicitly requires that structure.
4. Mark a hidden test as failed without exposing its input or expected output.
5. Human evaluation should record `correct diagnosis`, `useful but incomplete`, or `incorrect diagnosis` before rating language quality.

