from __future__ import annotations

import argparse
import importlib.metadata
from pathlib import Path

from app.core.config import settings
from app.database import PROJECT_ROOT, project_path, sqlite_database_path
from app.services.backup_archive import create_backup_archive, restore_backup_archive, verify_backup_archive
from app.services.sqlite_backup import restore_sqlite_backup, verify_sqlite_database


def _default_database_path() -> Path:
    database_path = sqlite_database_path(settings.database_url)
    if database_path is None:
        raise SystemExit("当前 DATABASE_URL 不是文件型 SQLite 数据库。")
    return database_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CameraHub 维护命令")
    subparsers = parser.add_subparsers(dest="command", required=True)

    verify_parser = subparsers.add_parser("verify-database", help="验证 SQLite 数据库完整性")
    verify_parser.add_argument("database", type=Path)

    rollback_parser = subparsers.add_parser("rollback-database", help="从迁移备份回滚 SQLite 数据库")
    rollback_parser.add_argument("backup", type=Path)
    rollback_parser.add_argument("--database", type=Path, default=None)
    subparsers.add_parser("backup", help="创建完整备份归档")
    verify_archive_parser = subparsers.add_parser("verify", help="验证完整备份归档")
    verify_archive_parser.add_argument("archive", type=Path)
    restore_parser = subparsers.add_parser("restore", help="恢复完整备份归档（必须先停止服务）")
    restore_parser.add_argument("archive", type=Path)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    app_version = importlib.metadata.version("backend")

    if args.command == "verify-database":
        verify_sqlite_database(args.database)
        print(f"数据库完整性校验通过：{args.database.resolve()}")
        return

    if args.command == "rollback-database":
        target_path = args.database.resolve() if args.database else _default_database_path()
        recovery_path = restore_sqlite_backup(args.backup, target_path, project_path(settings.backup_dir))
        print(f"数据库已回滚：{target_path}")
        if recovery_path is not None:
            print(f"回滚前恢复点：{recovery_path}")
        return

    database_path = _default_database_path()
    quote_path = PROJECT_ROOT / "data" / "quote_banner.txt"
    upload_dir = project_path(settings.upload_dir)
    backup_dir = project_path(settings.backup_dir)

    if args.command == "backup":
        archive = create_backup_archive(
            database_path=database_path, quote_path=quote_path, upload_dir=upload_dir,
            backup_dir=backup_dir, app_version=app_version,
        )
        manifest = verify_backup_archive(archive)
        print(f"备份完成：{archive}")
        print(f"文件数量：{len(manifest['files'])}")
        return
    if args.command == "verify":
        manifest = verify_backup_archive(args.archive)
        print(f"备份校验通过：{args.archive.resolve()}")
        print(f"文件数量：{len(manifest['files'])}")
        return
    if args.command == "restore":
        recovery = restore_backup_archive(
            archive_path=args.archive, database_path=database_path, quote_path=quote_path,
            upload_dir=upload_dir, backup_dir=backup_dir, app_version=app_version,
        )
        print(f"恢复完成：{database_path}")
        print(f"恢复前保护备份：{recovery}")


if __name__ == "__main__":
    main()
