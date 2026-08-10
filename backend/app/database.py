from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterator

from .config import settings
from .schemas import ConceptName, HistoryItem, MasteryItem, SubmissionResponse
from .services.mastery import DEFAULT_MASTERY


SCHEMA = """
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    problem_id TEXT NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    rule_id TEXT,
    hint_level INTEGER NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_user_problem_idx
    ON submissions(user_id, problem_id, created_at DESC);
CREATE TABLE IF NOT EXISTS mastery (
    user_id TEXT NOT NULL,
    concept TEXT NOT NULL,
    probability REAL NOT NULL,
    observations INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id, concept)
);
"""


class Database:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or settings.database_path

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.executescript(SCHEMA)

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def get_attempt_count(self, user_id: str, problem_id: str) -> int:
        with self.connection() as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM submissions WHERE user_id = ? AND problem_id = ?",
                (user_id, problem_id),
            ).fetchone()
        return int(row["count"])

    def recent_rule_ids(self, user_id: str, problem_id: str, limit: int = 5) -> list[str]:
        with self.connection() as connection:
            rows = connection.execute(
                """
                SELECT rule_id FROM submissions
                WHERE user_id = ? AND problem_id = ? AND rule_id IS NOT NULL
                ORDER BY created_at DESC LIMIT ?
                """,
                (user_id, problem_id, limit),
            ).fetchall()
        return [str(row["rule_id"]) for row in rows]

    def get_mastery(self, user_id: str, concept: ConceptName) -> float:
        with self.connection() as connection:
            row = connection.execute(
                "SELECT probability FROM mastery WHERE user_id = ? AND concept = ?",
                (user_id, concept),
            ).fetchone()
        return float(row["probability"]) if row else DEFAULT_MASTERY

    def save_mastery(self, user_id: str, concept: ConceptName, probability: float) -> None:
        now = datetime.now(UTC).isoformat()
        with self.connection() as connection:
            connection.execute(
                """
                INSERT INTO mastery(user_id, concept, probability, observations, updated_at)
                VALUES (?, ?, ?, 1, ?)
                ON CONFLICT(user_id, concept) DO UPDATE SET
                    probability = excluded.probability,
                    observations = mastery.observations + 1,
                    updated_at = excluded.updated_at
                """,
                (user_id, concept, probability, now),
            )

    def save_submission(self, user_id: str, response: SubmissionResponse, code: str) -> int:
        payload = response.model_dump(mode="json")
        payload["id"] = 0
        with self.connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO submissions(
                    user_id, problem_id, code, status, attempt, rule_id,
                    hint_level, response_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    response.problem_id,
                    code,
                    response.status,
                    response.attempt,
                    response.diagnosis.primary.rule_id if response.diagnosis.primary else None,
                    response.hint.level,
                    json.dumps(payload, ensure_ascii=False),
                    response.created_at.isoformat(),
                ),
            )
            return int(cursor.lastrowid)

    def list_mastery(self, user_id: str) -> list[MasteryItem]:
        concepts: list[ConceptName] = ["loop", "accumulator", "list", "condition", "function"]
        with self.connection() as connection:
            rows = connection.execute(
                "SELECT concept, probability, observations FROM mastery WHERE user_id = ?",
                (user_id,),
            ).fetchall()
        indexed = {row["concept"]: row for row in rows}
        return [
            MasteryItem(
                concept=concept,
                probability=float(indexed[concept]["probability"]) if concept in indexed else DEFAULT_MASTERY,
                observations=int(indexed[concept]["observations"]) if concept in indexed else 0,
            )
            for concept in concepts
        ]

    def history(self, user_id: str, limit: int = 20) -> list[HistoryItem]:
        with self.connection() as connection:
            rows = connection.execute(
                """
                SELECT id, problem_id, status, attempt, rule_id, hint_level, created_at
                FROM submissions WHERE user_id = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
        return [HistoryItem.model_validate(dict(row)) for row in rows]


database = Database()

