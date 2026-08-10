import os
from dataclasses import dataclass
from pathlib import Path


def _boolean(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("PYHINT_APP_NAME", "PyHint API")
    database_path: Path = Path(os.getenv("PYHINT_DATABASE_PATH", "data/pyhint.db"))
    allowed_origins: str = os.getenv(
        "PYHINT_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"
    )
    runner_timeout_seconds: float = float(
        os.getenv("PYHINT_RUNNER_TIMEOUT_SECONDS", "2.0")
    )
    runner_memory_mb: int = int(os.getenv("PYHINT_RUNNER_MEMORY_MB", "96"))
    runner_output_limit: int = int(os.getenv("PYHINT_RUNNER_OUTPUT_LIMIT", "16000"))
    openai_api_key: str = os.getenv("PYHINT_OPENAI_API_KEY", "")
    openai_model: str = os.getenv("PYHINT_OPENAI_MODEL", "gpt-5.6")
    llm_enabled: bool = _boolean(os.getenv("PYHINT_LLM_ENABLED"))

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]


settings = Settings()
