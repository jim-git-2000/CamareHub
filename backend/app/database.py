from pathlib import Path
from urllib.parse import quote

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _resolve_sqlite_url(database_url: str) -> str:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        return database_url

    raw_path = database_url.removeprefix(prefix)
    if raw_path == ":memory:":
        return database_url

    db_path = Path(raw_path)
    if not db_path.is_absolute():
        db_path = PROJECT_ROOT / db_path

    db_path.parent.mkdir(parents=True, exist_ok=True)
    sqlite_file_uri = f"file:{quote(db_path.as_posix())}?mode=rwc&nolock=1"
    return f"{prefix}{sqlite_file_uri}&uri=true"


DATABASE_URL = _resolve_sqlite_url(settings.database_url)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "uri": True}
    if DATABASE_URL.startswith("sqlite")
    else {},
)


def create_db_and_tables() -> None:
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _ensure_sqlite_columns()


def _ensure_sqlite_columns() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return

    with engine.begin() as connection:
        shooting_entry_photo_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(shooting_entry_photos)").fetchall()
        }
        if "dominant_color" not in shooting_entry_photo_columns:
            connection.exec_driver_sql("ALTER TABLE shooting_entry_photos ADD COLUMN dominant_color VARCHAR")
        if "thumbnail_path" not in shooting_entry_photo_columns:
            connection.exec_driver_sql("ALTER TABLE shooting_entry_photos ADD COLUMN thumbnail_path VARCHAR")

        photo_columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(photos)").fetchall()}
        if "thumbnail_path" not in photo_columns:
            connection.exec_driver_sql("ALTER TABLE photos ADD COLUMN thumbnail_path VARCHAR")

        connection.exec_driver_sql(
            """
            DELETE FROM shooting_entry_photos
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM shooting_entry_photos
                GROUP BY entry_id, file_path
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_shooting_entry_photos_entry_file_path
            ON shooting_entry_photos (entry_id, file_path)
            """
        )


def check_database_connection() -> bool:
    with Session(engine) as session:
        session.exec(text("SELECT 1"))
    return True


def get_session():
    with Session(engine) as session:
        yield session
