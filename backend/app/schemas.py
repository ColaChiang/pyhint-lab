from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ConceptName = Literal["loop", "accumulator", "list", "condition", "function"]


class TestCase(BaseModel):
    name: str
    args: list[Any]
    expected: Any
    kind: Literal["public", "boundary", "hidden"] = "public"


class ProblemSummary(BaseModel):
    id: str
    title: str
    difficulty: Literal["beginner", "intermediate"]
    concepts: list[ConceptName]
    estimated_minutes: int


class Problem(ProblemSummary):
    description: str
    function_name: str
    parameters: list[str]
    starter_code: str
    sample_input: str
    sample_output: str
    required_structures: list[str] = Field(default_factory=list)
    forbidden_calls: list[str] = Field(default_factory=list)
    tests: list[TestCase] = Field(default_factory=list)


class Finding(BaseModel):
    rule_id: str
    title: str
    concept: ConceptName
    line: int | None = None
    confidence: float = Field(ge=0, le=1)
    severity: Literal["info", "warning", "error"] = "warning"
    evidence: str


class StaticAnalysis(BaseModel):
    syntax_valid: bool
    safe_to_execute: bool
    structures: dict[str, int]
    findings: list[Finding]


class TestResult(BaseModel):
    name: str
    kind: str
    input: Any | None = None
    expected: Any | None = None
    actual: Any | None = None
    passed: bool
    exception: str | None = None
    duration_ms: float = 0


class Diagnosis(BaseModel):
    primary: Finding | None
    alternatives: list[Finding] = Field(default_factory=list)
    evidence_score: float = Field(default=0, ge=0, le=1)


class Hint(BaseModel):
    level: int = Field(ge=1, le=5)
    content: str
    source: Literal["template", "openai"]
    concept: ConceptName | None = None


class SubmissionCreate(BaseModel):
    user_id: str = Field(default="demo-user", min_length=1, max_length=100)
    problem_id: str
    code: str = Field(min_length=1, max_length=20_000)
    requested_hint_level: int | None = Field(default=None, ge=1, le=5)


class SubmissionResponse(BaseModel):
    id: int
    problem_id: str
    status: Literal["passed", "failed", "rejected", "syntax_error"]
    attempt: int
    static_analysis: StaticAnalysis
    tests: list[TestResult]
    diagnosis: Diagnosis
    hint: Hint
    mastery_before: float
    mastery_after: float
    created_at: datetime


class MasteryItem(BaseModel):
    concept: ConceptName
    probability: float = Field(ge=0, le=1)
    observations: int


class HistoryItem(BaseModel):
    id: int
    problem_id: str
    status: str
    attempt: int
    rule_id: str | None
    hint_level: int
    created_at: datetime
