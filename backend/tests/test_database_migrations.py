import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlmodel import create_engine

from app import database
from app.services.sqlite_backup import create_sqlite_backup, restore_sqlite_backup, verify_sqlite_database


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


class DatabaseMigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory(dir="/tmp")
        self.root = Path(self.temporary_directory.name)
        self.database_path = self.root / "gear.db"
        self.backup_dir = self.root / "backups"
        self.upload_path = self.root / "uploads" / "shooting-entries" / "photo.jpg"
        self.upload_path.parent.mkdir(parents=True)
        self.upload_path.write_bytes(b"unchanged-photo-content")
        self.upload_hash = file_sha256(self.upload_path)
        self._create_legacy_database()

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def _create_legacy_database(self) -> None:
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(
                """
                CREATE TABLE photos (
                    id INTEGER PRIMARY KEY,
                    item_id INTEGER NOT NULL,
                    file_path VARCHAR NOT NULL,
                    file_name VARCHAR NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL
                );
                CREATE TABLE shooting_entry_photos (
                    id INTEGER PRIMARY KEY,
                    entry_id INTEGER NOT NULL,
                    file_path VARCHAR NOT NULL,
                    file_name VARCHAR NOT NULL,
                    content_type VARCHAR,
                    file_size INTEGER,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL
                );
                INSERT INTO shooting_entry_photos
                    (id, entry_id, file_path, file_name, content_type, file_size, sort_order, created_at)
                VALUES
                    (1, 7, '/uploads/a.jpg', 'first.jpg', 'image/jpeg', 10, 0, '2026-01-01T00:00:00'),
                    (2, 7, '/uploads/a.jpg', 'second.jpg', 'image/jpeg', 20, 1, '2026-01-02T00:00:00'),
                    (3, 7, '/uploads/a.jpg', 'third.jpg', 'image/jpeg', 30, 2, '2026-01-03T00:00:00'),
                    (4, 7, '/uploads/b.jpg', 'unique.jpg', 'image/jpeg', 40, 0, '2026-01-04T00:00:00');
                """
            )

    def test_migration_archives_duplicates_and_is_idempotent(self) -> None:
        backup_path = create_sqlite_backup(
            self.database_path,
            self.backup_dir,
            label="before-schema-migration",
        )
        engine = create_engine(f"sqlite:///{self.database_path}")
        try:
            database._run_sqlite_compatibility_migrations(backup_path=backup_path, target_engine=engine)
            database._run_sqlite_compatibility_migrations(backup_path=backup_path, target_engine=engine)
        finally:
            engine.dispose()

        with sqlite3.connect(self.database_path) as connection:
            active_rows = connection.execute(
                "SELECT id, file_name FROM shooting_entry_photos ORDER BY id"
            ).fetchall()
            archived_rows = connection.execute(
                """
                SELECT original_id, file_name, file_size, sort_order
                FROM migration_shooting_entry_photo_duplicates
                ORDER BY original_id
                """
            ).fetchall()
            migration_rows = connection.execute(
                "SELECT name, backup_path FROM schema_migrations"
            ).fetchall()
            indexes = {row[1] for row in connection.execute("PRAGMA index_list(shooting_entry_photos)")}

        self.assertEqual(active_rows, [(1, "first.jpg"), (4, "unique.jpg")])
        self.assertEqual(archived_rows, [(2, "second.jpg", 20, 1), (3, "third.jpg", 30, 2)])
        self.assertEqual(migration_rows, [(database.CURRENT_SCHEMA_MIGRATION, str(backup_path))])
        self.assertIn("uq_shooting_entry_photos_entry_file_path", indexes)
        self.assertEqual(file_sha256(self.upload_path), self.upload_hash)
        verify_sqlite_database(backup_path)

    def test_migration_failure_rolls_back_active_record_changes(self) -> None:
        engine = create_engine(f"sqlite:///{self.database_path}")
        try:
            with patch("app.database._verify_current_sqlite_schema", side_effect=RuntimeError("injected failure")):
                with self.assertRaisesRegex(RuntimeError, "injected failure"):
                    database._run_sqlite_compatibility_migrations(target_engine=engine)
        finally:
            engine.dispose()

        with sqlite3.connect(self.database_path) as connection:
            rows = connection.execute("SELECT id, file_name FROM shooting_entry_photos ORDER BY id").fetchall()
            migration_table = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
            ).fetchone()
            migration_count = (
                connection.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0]
                if migration_table
                else 0
            )

        self.assertEqual(len(rows), 4)
        self.assertEqual(migration_count, 0)
        self.assertEqual(file_sha256(self.upload_path), self.upload_hash)

    def test_database_can_be_restored_from_pre_migration_backup(self) -> None:
        backup_path = create_sqlite_backup(self.database_path, self.backup_dir, label="before-schema-migration")
        engine = create_engine(f"sqlite:///{self.database_path}")
        try:
            database._run_sqlite_compatibility_migrations(backup_path=backup_path, target_engine=engine)
        finally:
            engine.dispose()

        recovery_path = restore_sqlite_backup(backup_path, self.database_path, self.backup_dir)

        self.assertIsNotNone(recovery_path)
        with sqlite3.connect(self.database_path) as connection:
            rows = connection.execute("SELECT id, file_name FROM shooting_entry_photos ORDER BY id").fetchall()
            migration_table = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
            ).fetchone()

        self.assertEqual(len(rows), 4)
        self.assertIsNone(migration_table)
        self.assertEqual(file_sha256(self.upload_path), self.upload_hash)

    def test_backup_failure_does_not_change_source_database(self) -> None:
        invalid_backup_dir = self.root / "not-a-directory"
        invalid_backup_dir.write_text("blocked", encoding="utf-8")
        original_hash = file_sha256(self.database_path)

        with self.assertRaises(FileExistsError):
            create_sqlite_backup(self.database_path, invalid_backup_dir, label="failure")

        self.assertEqual(file_sha256(self.database_path), original_hash)
        verify_sqlite_database(self.database_path)


if __name__ == "__main__":
    unittest.main()
