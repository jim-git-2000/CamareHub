import json
import sqlite3
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from app.services import backup_archive
from app.services.backup_archive import create_backup_archive, restore_backup_archive, verify_backup_archive


class BackupRestoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory(dir="/tmp")
        self.root = Path(self.temporary_directory.name)
        self.data_dir = self.root / "data"
        self.upload_dir = self.root / "uploads"
        self.backup_dir = self.root / "backups"
        self.database_path = self.data_dir / "gear.db"
        self.quote_path = self.data_dir / "quote_banner.txt"
        self.data_dir.mkdir()
        self.upload_dir.mkdir()
        self._write_database("original")
        self.quote_path.write_text("interval_seconds=10\n", encoding="utf-8")
        (self.upload_dir / "camera").mkdir()
        (self.upload_dir / "camera" / "photo.jpg").write_bytes(b"original-photo")

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def _write_database(self, value: str) -> None:
        self.database_path.unlink(missing_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            connection.execute("CREATE TABLE marker (value VARCHAR NOT NULL)")
            connection.execute("INSERT INTO marker VALUES (?)", (value,))

    def _read_marker(self) -> str:
        with sqlite3.connect(self.database_path) as connection:
            return connection.execute("SELECT value FROM marker").fetchone()[0]

    def test_backup_verify_and_restore_round_trip(self) -> None:
        archive = create_backup_archive(
            database_path=self.database_path, quote_path=self.quote_path, upload_dir=self.upload_dir,
            backup_dir=self.backup_dir, app_version="0.3.0",
        )
        manifest = verify_backup_archive(archive)
        self.assertEqual(manifest["format_version"], 1)
        self.assertEqual(manifest["database_schema"]["sqlite_user_version"], 0)
        self.assertIn("schema_sha256", manifest["database_schema"])
        self.assertIn("marker", {entry["name"] for entry in manifest["database_schema"]["objects"]})
        self.assertEqual({entry["path"] for entry in manifest["files"]}, {
            "data/gear.db", "data/quote_banner.txt", "uploads/camera/photo.jpg"
        })

        self._write_database("changed")
        self.quote_path.write_text("changed\n", encoding="utf-8")
        (self.upload_dir / "camera" / "photo.jpg").write_bytes(b"changed-photo")
        recovery = restore_backup_archive(
            archive_path=archive, database_path=self.database_path, quote_path=self.quote_path,
            upload_dir=self.upload_dir, backup_dir=self.backup_dir, app_version="0.3.0",
        )

        self.assertEqual(self._read_marker(), "original")
        self.assertEqual(self.quote_path.read_text(encoding="utf-8"), "interval_seconds=10\n")
        self.assertEqual((self.upload_dir / "camera" / "photo.jpg").read_bytes(), b"original-photo")
        verify_backup_archive(recovery)

    def test_tampered_archive_is_rejected_before_restore(self) -> None:
        archive = create_backup_archive(
            database_path=self.database_path, quote_path=self.quote_path, upload_dir=self.upload_dir,
            backup_dir=self.backup_dir, app_version="0.3.0",
        )
        rewritten = archive.with_name("tampered.zip")
        with zipfile.ZipFile(archive) as source, zipfile.ZipFile(rewritten, "w") as target:
            for member in source.infolist():
                content = source.read(member.filename)
                if member.filename == "uploads/camera/photo.jpg":
                    content = b"tampered"
                target.writestr(member, content)
        rewritten.replace(archive)
        with self.assertRaises((ValueError, zipfile.BadZipFile)):
            verify_backup_archive(archive)
        self.assertEqual(self._read_marker(), "original")

    def test_restore_failure_rolls_back_to_recovery_archive(self) -> None:
        archive = create_backup_archive(
            database_path=self.database_path, quote_path=self.quote_path, upload_dir=self.upload_dir,
            backup_dir=self.backup_dir, app_version="0.3.0",
        )
        self._write_database("before-restore")
        self.quote_path.write_text("before-restore\n", encoding="utf-8")
        (self.upload_dir / "camera" / "photo.jpg").write_bytes(b"before-restore-photo")
        original_apply = backup_archive._apply_backup_archive
        apply_count = 0

        def fail_then_rollback(**kwargs: object) -> None:
            nonlocal apply_count
            apply_count += 1
            if apply_count == 1:
                self._write_database("partial")
                self.quote_path.write_text("partial\n", encoding="utf-8")
                (self.upload_dir / "camera" / "photo.jpg").write_bytes(b"partial-photo")
                raise OSError("simulated restore failure")
            original_apply(**kwargs)

        with patch.object(backup_archive, "_apply_backup_archive", side_effect=fail_then_rollback):
            with self.assertRaisesRegex(RuntimeError, "已从.*自动回滚"):
                restore_backup_archive(
                    archive_path=archive, database_path=self.database_path, quote_path=self.quote_path,
                    upload_dir=self.upload_dir, backup_dir=self.backup_dir, app_version="0.3.0",
                )

        self.assertEqual(apply_count, 2)
        self.assertEqual(self._read_marker(), "before-restore")
        self.assertEqual(self.quote_path.read_text(encoding="utf-8"), "before-restore\n")
        self.assertEqual((self.upload_dir / "camera" / "photo.jpg").read_bytes(), b"before-restore-photo")

    def test_path_traversal_archive_is_rejected(self) -> None:
        archive = self.backup_dir / "unsafe.zip"
        self.backup_dir.mkdir()
        with zipfile.ZipFile(archive, "w") as zipped:
            zipped.writestr("manifest.json", json.dumps({"format_version": 1, "files": []}))
            zipped.writestr("../escape.txt", "blocked")
        with self.assertRaisesRegex(ValueError, "不安全路径"):
            verify_backup_archive(archive)

    def test_symbolic_link_archive_is_rejected(self) -> None:
        archive = self.backup_dir / "link.zip"
        self.backup_dir.mkdir()
        link = zipfile.ZipInfo("uploads/escape")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with zipfile.ZipFile(archive, "w") as zipped:
            zipped.writestr("manifest.json", json.dumps({"format_version": 1, "files": []}))
            zipped.writestr(link, "../../escape")
        with self.assertRaisesRegex(ValueError, "符号链接"):
            verify_backup_archive(archive)

    def test_backup_without_quote_file_is_supported(self) -> None:
        self.quote_path.unlink()
        archive = create_backup_archive(
            database_path=self.database_path, quote_path=self.quote_path, upload_dir=self.upload_dir,
            backup_dir=self.backup_dir, app_version="0.3.0",
        )
        manifest = verify_backup_archive(archive)
        self.assertNotIn("data/quote_banner.txt", {entry["path"] for entry in manifest["files"]})


if __name__ == "__main__":
    unittest.main()
