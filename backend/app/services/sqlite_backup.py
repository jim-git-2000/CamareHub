from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def verify_sqlite_database(database_path: Path) -> None:
    if not database_path.is_file():
        raise FileNotFoundError(f"SQLite database does not exist: {database_path}")

    with sqlite3.connect(f"file:{database_path.as_posix()}?mode=ro", uri=True) as connection:
        result = connection.execute("PRAGMA integrity_check").fetchone()

    if result is None or result[0] != "ok":
        detail = result[0] if result else "no result"
        raise RuntimeError(f"SQLite integrity check failed for {database_path}: {detail}")


def create_sqlite_backup(source_path: Path, backup_dir: Path, *, label: str) -> Path:
    source_path = source_path.resolve()
    backup_dir = backup_dir.resolve()
    verify_sqlite_database(source_path)
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = backup_dir / f"gear-{label}-{timestamp}-{uuid4().hex[:8]}.db"
    temporary_path = backup_path.with_suffix(".db.tmp")

    try:
        with sqlite3.connect(f"file:{source_path.as_posix()}?mode=ro", uri=True) as source:
            with sqlite3.connect(temporary_path) as destination:
                source.backup(destination)
        verify_sqlite_database(temporary_path)
        temporary_path.replace(backup_path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise

    return backup_path


def restore_sqlite_backup(backup_path: Path, target_path: Path, backup_dir: Path) -> Path | None:
    backup_path = backup_path.resolve()
    target_path = target_path.resolve()
    verify_sqlite_database(backup_path)

    recovery_path: Path | None = None
    if target_path.exists():
        recovery_path = create_sqlite_backup(target_path, backup_dir, label="before-rollback")

    target_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = target_path.with_suffix(f"{target_path.suffix}.restore.tmp")
    temporary_path.unlink(missing_ok=True)

    try:
        with sqlite3.connect(f"file:{backup_path.as_posix()}?mode=ro", uri=True) as source:
            with sqlite3.connect(temporary_path) as destination:
                source.backup(destination)
        verify_sqlite_database(temporary_path)
        temporary_path.replace(target_path)
        verify_sqlite_database(target_path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        if recovery_path is not None:
            with sqlite3.connect(f"file:{recovery_path.as_posix()}?mode=ro", uri=True) as source:
                with sqlite3.connect(target_path) as destination:
                    source.backup(destination)
        raise

    return recovery_path
