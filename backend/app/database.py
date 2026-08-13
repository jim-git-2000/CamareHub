import sqlite3
from pathlib import Path
from urllib.parse import quote

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings
from app.services.sqlite_backup import create_sqlite_backup


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CURRENT_SCHEMA_MIGRATION = "20260813_safe_shooting_entry_photo_uniqueness"


def project_path(path_value: str) -> Path:
    path = Path(path_value)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


def sqlite_database_path(database_url: str) -> Path | None:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        return None

    raw_path = database_url.removeprefix(prefix)
    if raw_path == ":memory:" or raw_path.startswith("file:"):
        return None

    return project_path(raw_path)


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

    backup_path = _create_pre_migration_backup()
    SQLModel.metadata.create_all(engine)
    _run_sqlite_compatibility_migrations(backup_path=backup_path)


def _database_has_user_tables(database_path: Path) -> bool:
    if not database_path.is_file() or database_path.stat().st_size == 0:
        return False

    with sqlite3.connect(f"file:{database_path.as_posix()}?mode=ro", uri=True) as connection:
        table = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1"
        ).fetchone()
    return table is not None


def _migration_applied_in_file(database_path: Path) -> bool:
    if not database_path.is_file():
        return False

    with sqlite3.connect(f"file:{database_path.as_posix()}?mode=ro", uri=True) as connection:
        migration_table = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
        ).fetchone()
        if migration_table is None:
            return False
        migration = connection.execute(
            "SELECT 1 FROM schema_migrations WHERE name = ?",
            (CURRENT_SCHEMA_MIGRATION,),
        ).fetchone()
    return migration is not None


def _create_pre_migration_backup() -> Path | None:
    database_path = sqlite_database_path(settings.database_url)
    if database_path is None:
        return None
    if not _database_has_user_tables(database_path) or _migration_applied_in_file(database_path):
        return None

    return create_sqlite_backup(
        database_path,
        project_path(settings.backup_dir),
        label="before-schema-migration",
    )


def _run_sqlite_compatibility_migrations(*, backup_path: Path | None = None, target_engine=None) -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return

    migration_engine = target_engine or engine
    with migration_engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name VARCHAR PRIMARY KEY,
                applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                backup_path VARCHAR
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS migration_shooting_entry_photo_duplicates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration_name VARCHAR NOT NULL,
                original_id INTEGER NOT NULL,
                entry_id INTEGER NOT NULL,
                file_path VARCHAR NOT NULL,
                thumbnail_path VARCHAR,
                file_name VARCHAR NOT NULL,
                content_type VARCHAR,
                file_size INTEGER,
                dominant_color VARCHAR,
                sort_order INTEGER NOT NULL,
                created_at DATETIME NOT NULL,
                archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (migration_name, original_id)
            )
            """
        )

        applied = connection.exec_driver_sql(
            "SELECT 1 FROM schema_migrations WHERE name = ?",
            (CURRENT_SCHEMA_MIGRATION,),
        ).fetchone()
        if applied is not None:
            _verify_current_sqlite_schema(connection)
            return

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

        duplicate_row_count = connection.exec_driver_sql(
            """
            SELECT COUNT(*)
            FROM shooting_entry_photos AS candidate
            WHERE EXISTS (
                SELECT 1
                FROM shooting_entry_photos AS keeper
                WHERE keeper.entry_id = candidate.entry_id
                  AND keeper.file_path = candidate.file_path
                  AND keeper.id < candidate.id
            )
            """
        ).scalar_one()
        if duplicate_row_count:
            if backup_path is None and target_engine is None:
                raise RuntimeError("Refusing to move duplicate photo rows without a verified migration backup")
            connection.exec_driver_sql(
                """
                INSERT INTO migration_shooting_entry_photo_duplicates (
                    migration_name,
                    original_id,
                    entry_id,
                    file_path,
                    thumbnail_path,
                    file_name,
                    content_type,
                    file_size,
                    dominant_color,
                    sort_order,
                    created_at
                )
                SELECT ?, id, entry_id, file_path, thumbnail_path, file_name,
                       content_type, file_size, dominant_color, sort_order, created_at
                FROM shooting_entry_photos AS candidate
                WHERE EXISTS (
                    SELECT 1
                    FROM shooting_entry_photos AS keeper
                    WHERE keeper.entry_id = candidate.entry_id
                      AND keeper.file_path = candidate.file_path
                      AND keeper.id < candidate.id
                )
                """,
                (CURRENT_SCHEMA_MIGRATION,),
            )
            archived_count = connection.exec_driver_sql(
                "SELECT COUNT(*) FROM migration_shooting_entry_photo_duplicates WHERE migration_name = ?",
                (CURRENT_SCHEMA_MIGRATION,),
            ).scalar_one()
            if archived_count != duplicate_row_count:
                raise RuntimeError(
                    f"Duplicate photo archive count mismatch: expected {duplicate_row_count}, got {archived_count}"
                )

            connection.exec_driver_sql(
                """
                DELETE FROM shooting_entry_photos
                WHERE id IN (
                    SELECT original_id
                    FROM migration_shooting_entry_photo_duplicates
                    WHERE migration_name = ?
                )
                """,
                (CURRENT_SCHEMA_MIGRATION,),
            )

        shooting_entry_photo_indexes = {
            row[1] for row in connection.exec_driver_sql("PRAGMA index_list(shooting_entry_photos)").fetchall()
        }
        if "uq_shooting_entry_photos_entry_file_path" not in shooting_entry_photo_indexes:
            connection.exec_driver_sql(
                """
                CREATE UNIQUE INDEX uq_shooting_entry_photos_entry_file_path
                ON shooting_entry_photos (entry_id, file_path)
                """
            )

        _verify_current_sqlite_schema(connection)
        connection.exec_driver_sql(
            "INSERT INTO schema_migrations (name, backup_path) VALUES (?, ?)",
            (CURRENT_SCHEMA_MIGRATION, str(backup_path) if backup_path else None),
        )


def _verify_current_sqlite_schema(connection) -> None:
    shooting_entry_photo_columns = {
        row[1] for row in connection.exec_driver_sql("PRAGMA table_info(shooting_entry_photos)").fetchall()
    }
    photo_columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(photos)").fetchall()}
    shooting_entry_photo_indexes = {
        row[1] for row in connection.exec_driver_sql("PRAGMA index_list(shooting_entry_photos)").fetchall()
    }

    missing_columns = {"dominant_color", "thumbnail_path"} - shooting_entry_photo_columns
    if missing_columns:
        raise RuntimeError(f"Missing shooting_entry_photos columns after migration: {sorted(missing_columns)}")
    if "thumbnail_path" not in photo_columns:
        raise RuntimeError("Missing photos.thumbnail_path after migration")
    if "uq_shooting_entry_photos_entry_file_path" not in shooting_entry_photo_indexes:
        raise RuntimeError("Missing shooting entry photo unique index after migration")


def check_database_connection() -> bool:
    with Session(engine) as session:
        session.exec(text("SELECT 1"))
    return True


def get_session():
    with Session(engine) as session:
        yield session
