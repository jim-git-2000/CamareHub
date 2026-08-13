from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
import stat
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from uuid import uuid4

from app.services.sqlite_backup import create_sqlite_backup, verify_sqlite_database


ARCHIVE_FORMAT_VERSION = 1


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _file_entry(path: Path, archive_path: str) -> dict[str, object]:
    return {"path": archive_path, "size": path.stat().st_size, "sha256": _sha256(path)}


def _database_schema_info(database_path: Path) -> dict[str, object]:
    with sqlite3.connect(database_path) as connection:
        user_version = connection.execute("PRAGMA user_version").fetchone()[0]
        rows = connection.execute(
            "SELECT type, name, tbl_name, sql FROM sqlite_master "
            "WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
        ).fetchall()
    objects = [
        {"type": row[0], "name": row[1], "table": row[2], "sql": row[3]}
        for row in rows
    ]
    schema_payload = json.dumps(objects, ensure_ascii=False, sort_keys=True).encode()
    return {
        "sqlite_user_version": user_version,
        "schema_sha256": hashlib.sha256(schema_payload).hexdigest(),
        "objects": objects,
    }


def create_backup_archive(
    *, database_path: Path, quote_path: Path, upload_dir: Path, backup_dir: Path, app_version: str
) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive_path = backup_dir / f"camerahub-backup-{timestamp}-{uuid4().hex[:8]}.zip"

    with tempfile.TemporaryDirectory(dir="/tmp") as temporary_name:
        temporary_root = Path(temporary_name)
        database_snapshot = create_sqlite_backup(database_path, temporary_root, label="archive")
        files: list[tuple[Path, str]] = [(database_snapshot, "data/gear.db")]
        if quote_path.is_file():
            files.append((quote_path, "data/quote_banner.txt"))
        if upload_dir.is_dir():
            files.extend(
                (path, f"uploads/{path.relative_to(upload_dir).as_posix()}")
                for path in sorted(upload_dir.rglob("*"))
                if path.is_file() and not path.is_symlink()
            )

        manifest = {
            "format_version": ARCHIVE_FORMAT_VERSION,
            "app_version": app_version,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "database_schema": _database_schema_info(database_snapshot),
            "files": [_file_entry(path, name) for path, name in files],
        }
        temporary_archive = temporary_root / archive_path.name
        with zipfile.ZipFile(temporary_archive, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            for path, name in files:
                archive.write(path, name)
        shutil.copy2(temporary_archive, archive_path)

    verify_backup_archive(archive_path)
    return archive_path


def _safe_archive_name(name: str) -> bool:
    path = PurePosixPath(name)
    return not path.is_absolute() and ".." not in path.parts and name not in {"", "."}


def _archive_member_is_link(member: zipfile.ZipInfo) -> bool:
    return stat.S_ISLNK(member.external_attr >> 16)


def verify_backup_archive(archive_path: Path) -> dict[str, object]:
    with tempfile.TemporaryDirectory(dir="/tmp") as temporary_name:
        temporary_root = Path(temporary_name)
        with zipfile.ZipFile(archive_path) as archive:
            members = archive.infolist()
            if any(not _safe_archive_name(member.filename) for member in members):
                raise ValueError("备份归档包含不安全路径")
            if any(_archive_member_is_link(member) for member in members):
                raise ValueError("备份归档包含符号链接")
            member_names = [member.filename for member in members]
            if len(member_names) != len(set(member_names)):
                raise ValueError("备份归档包含重复路径")
            if "manifest.json" not in {member.filename for member in members}:
                raise ValueError("备份归档缺少 manifest.json")
            manifest = json.loads(archive.read("manifest.json"))
            if manifest.get("format_version") != ARCHIVE_FORMAT_VERSION:
                raise ValueError("不支持的备份格式版本")
            archive.extractall(temporary_root)

        expected_names = {"manifest.json", *(entry["path"] for entry in manifest.get("files", []))}
        actual_names = {member.filename for member in members if not member.is_dir()}
        if expected_names != actual_names:
            raise ValueError("备份文件清单与归档内容不一致")
        for entry in manifest["files"]:
            path = temporary_root / entry["path"]
            if path.stat().st_size != entry["size"] or _sha256(path) != entry["sha256"]:
                raise ValueError(f"备份文件校验失败：{entry['path']}")
        database_path = temporary_root / "data/gear.db"
        verify_sqlite_database(database_path)
        if manifest.get("database_schema") != _database_schema_info(database_path):
            raise ValueError("备份数据库 schema 信息校验失败")
        return manifest


def _replace_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    replacement = target.with_name(f"{target.name}.restore.tmp")
    replacement.unlink(missing_ok=True)
    shutil.copy2(source, replacement)
    replacement.replace(target)


def _verify_restored_files(
    *, manifest: dict[str, object], database_path: Path, quote_path: Path, upload_dir: Path
) -> None:
    entries = manifest.get("files")
    if not isinstance(entries, list):
        raise ValueError("备份 manifest 缺少文件清单")
    expected_uploads: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
            raise ValueError("备份 manifest 文件项无效")
        archive_name = entry["path"]
        if archive_name == "data/gear.db":
            target = database_path
        elif archive_name == "data/quote_banner.txt":
            target = quote_path
        elif archive_name.startswith("uploads/"):
            relative_name = archive_name.removeprefix("uploads/")
            expected_uploads.add(relative_name)
            target = upload_dir / relative_name
        else:
            raise ValueError(f"备份 manifest 包含不支持的文件：{archive_name}")
        if not target.is_file() or target.stat().st_size != entry.get("size") or _sha256(target) != entry.get("sha256"):
            raise ValueError(f"恢复后文件校验失败：{archive_name}")

    actual_uploads = {
        path.relative_to(upload_dir).as_posix()
        for path in upload_dir.rglob("*")
        if path.is_file() and not path.is_symlink()
    }
    if actual_uploads != expected_uploads:
        raise ValueError("恢复后上传文件清单不一致")


def _apply_backup_archive(
    *, archive_path: Path, database_path: Path, quote_path: Path, upload_dir: Path
) -> None:
    manifest = verify_backup_archive(archive_path)
    with tempfile.TemporaryDirectory(dir="/tmp") as temporary_name:
        temporary_root = Path(temporary_name)
        with zipfile.ZipFile(archive_path) as archive:
            archive.extractall(temporary_root)
        restored_database = temporary_root / "data/gear.db"
        verify_sqlite_database(restored_database)

        _replace_file(restored_database, database_path)
        restored_quote = temporary_root / "data/quote_banner.txt"
        if restored_quote.is_file():
            _replace_file(restored_quote, quote_path)
        else:
            quote_path.unlink(missing_ok=True)

        restored_uploads = temporary_root / "uploads"
        replacement = upload_dir.with_name(f"{upload_dir.name}.restore.tmp")
        old_uploads = upload_dir.with_name(f"{upload_dir.name}.restore.old")
        shutil.rmtree(replacement, ignore_errors=True)
        shutil.rmtree(old_uploads, ignore_errors=True)
        if restored_uploads.is_dir():
            shutil.copytree(restored_uploads, replacement)
        else:
            replacement.mkdir(parents=True)
        try:
            if upload_dir.exists():
                upload_dir.replace(old_uploads)
            replacement.replace(upload_dir)
        except Exception:
            if old_uploads.exists() and not upload_dir.exists():
                old_uploads.replace(upload_dir)
            raise
        finally:
            shutil.rmtree(replacement, ignore_errors=True)
        shutil.rmtree(old_uploads, ignore_errors=True)
        verify_sqlite_database(database_path)
        _verify_restored_files(
            manifest=manifest,
            database_path=database_path,
            quote_path=quote_path,
            upload_dir=upload_dir,
        )


def restore_backup_archive(
    *, archive_path: Path, database_path: Path, quote_path: Path, upload_dir: Path, backup_dir: Path, app_version: str
) -> Path:
    verify_backup_archive(archive_path)
    recovery_archive = create_backup_archive(
        database_path=database_path,
        quote_path=quote_path,
        upload_dir=upload_dir,
        backup_dir=backup_dir,
        app_version=app_version,
    )

    try:
        _apply_backup_archive(
            archive_path=archive_path,
            database_path=database_path,
            quote_path=quote_path,
            upload_dir=upload_dir,
        )
    except Exception as restore_error:
        try:
            _apply_backup_archive(
                archive_path=recovery_archive,
                database_path=database_path,
                quote_path=quote_path,
                upload_dir=upload_dir,
            )
        except Exception as rollback_error:
            raise RuntimeError(
                f"恢复失败，自动回滚也失败；恢复前备份位于 {recovery_archive}"
            ) from rollback_error
        raise RuntimeError(f"恢复失败，已从 {recovery_archive} 自动回滚") from restore_error

    return recovery_archive
