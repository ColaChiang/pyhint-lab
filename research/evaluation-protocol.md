# Evaluation protocol

## Research questions

- RQ1: Does combining AST evidence with test evidence improve diagnostic F1 over tests alone and direct LLM diagnosis?
- RQ2: Do adaptive hints reduce the number of learners who request a complete answer?
- RQ3: Do evidence-grounded hints improve consistency and perceived trust compared with direct LLM hints?

## Conditions

| Condition | Diagnostic source | Hint source |
| --- | --- | --- |
| A | test pass/fail only | fixed templates |
| B | raw code sent to LLM | LLM |
| C | AST + tests + history | adaptive template or evidence-grounded LLM |

## Minimum dataset

- 8–12 beginner Python problems.
- 15–25 incorrect submissions per problem.
- At least two independent human labels per submission.
- A balanced mix of syntax, structural, logic, boundary, and prohibited-solution errors.

## Metrics

- Diagnostic precision, recall, macro F1, and top-2 accuracy.
- Attempts and time to first correct solution.
- Maximum hint level requested.
- Proportion of edits that move toward the correct concept after a hint.
- Pre/post concept score and delayed retention score.
- Learner ratings for clarity, usefulness, answer leakage, and trust.

## Analysis notes

Use problem and learner as random effects if the sample supports a mixed-effects model. Otherwise report bootstrap confidence intervals and effect sizes, not only p-values. Pre-register exclusion rules for empty submissions, technical failures, and learners who do not complete the post-test.

