import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


def _parse_cors_origins(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "CameraHub")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/gear.db")
    upload_dir: str = os.getenv("UPLOAD_DIR", "./uploads")
    cors_origins: list[str] | None = None

    def __post_init__(self) -> None:
        if self.cors_origins is None:
            origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000")
            object.__setattr__(self, "cors_origins", _parse_cors_origins(origins))


settings = Settings()
