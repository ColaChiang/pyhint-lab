from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import database
from .problems import get_problem, list_problems
from .schemas import (
    HistoryItem,
    MasteryItem,
    Problem,
    ProblemSummary,
    SubmissionCreate,
    SubmissionResponse,
)
from .services.submissions import SubmissionService, UnknownProblemError


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.initialize()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="AST-first adaptive Python hint API",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)
service = SubmissionService(database)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pyhint-api"}


@app.get("/api/problems", response_model=list[ProblemSummary])
def problems() -> list[ProblemSummary]:
    return [ProblemSummary.model_validate(item.model_dump()) for item in list_problems()]


@app.get("/api/problems/{problem_id}", response_model=Problem)
def problem_detail(problem_id: str) -> Problem:
    problem = get_problem(problem_id)
    if problem is None:
        raise HTTPException(status_code=404, detail="Unknown problem")
    public = problem.model_copy(deep=True)
    public.tests = [test for test in public.tests if test.kind != "hidden"]
    return public


@app.post("/api/submissions", response_model=SubmissionResponse, status_code=201)
async def create_submission(payload: SubmissionCreate) -> SubmissionResponse:
    try:
        return await service.submit(payload)
    except UnknownProblemError as exc:
        raise HTTPException(status_code=404, detail="Unknown problem") from exc


@app.get("/api/students/{user_id}/mastery", response_model=list[MasteryItem])
def student_mastery(user_id: str) -> list[MasteryItem]:
    return database.list_mastery(user_id)


@app.get("/api/students/{user_id}/history", response_model=list[HistoryItem])
def student_history(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[HistoryItem]:
    return database.history(user_id, limit)

