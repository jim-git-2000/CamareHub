import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from PIL import Image
from sqlalchemy import delete, func, or_
from sqlmodel import Session, select

from app.database import PROJECT_ROOT
from app.models import Camera, Film, Item, Lens, Photo, ShootingEntry, ShootingEntryItem, ShootingEntryPhoto, Transaction, utc_now
from app.schemas import (
    CameraBase,
    FilmBase,
    ItemCreate,
    ItemRead,
    ItemUpdate,
    LensBase,
    PhotoRead,
    ShootingEntryCreate,
    ShootingEntryItemLinkBase,
    ShootingEntryItemLinkRead,
    ShootingEntryListResponse,
    ShootingEntryPhotoRead,
    ShootingEntryRead,
    ShootingEntryUpdate,
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
)


VALID_ITEM_TYPES = {"camera", "lens", "film", "accessory"}
VALID_TRANSACTION_TYPES = {"purchase", "repair", "sale", "maintenance", "accessory"}
VALID_SHOOTING_ENTRY_ITEM_ROLES = {"camera", "lens", "film", "other"}
ALLOWED_PHOTO_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024
THUMBNAIL_MAX_SIZE = (640, 640)
THUMBNAIL_QUALITY = 80
SHOOTING_ENTRIES_UPLOAD_DIR = "shooting-entries"
SHOOTING_ENTRY_FOLDER_FALLBACK = "shooting-entry"
VALID_SORTS = {
    "created_at": Item.created_at,
    "-created_at": Item.created_at.desc(),
    "updated_at": Item.updated_at,
    "-updated_at": Item.updated_at.desc(),
    "brand": Item.brand,
    "-brand": Item.brand.desc(),
    "model": Item.model,
    "-model": Item.model.desc(),
    "purchase_date": Item.purchase_date,
    "-purchase_date": Item.purchase_date.desc(),
}


def _item_order_by(sort: str | None):
    if sort == "-purchase_date":
        return (Item.purchase_date.is_(None), Item.purchase_date.desc(), Item.created_at.desc(), Item.id.desc())
    if sort == "purchase_date":
        return (Item.purchase_date.is_(None), Item.purchase_date, Item.created_at.desc(), Item.id.desc())
    return (VALID_SORTS.get(sort or "-created_at", Item.created_at.desc()),)


def _validate_item_type(item_type: str) -> None:
    if item_type not in VALID_ITEM_TYPES:
        raise ValueError(f"Unsupported item type: {item_type}")


def _validate_transaction_type(transaction_type: str) -> None:
    if transaction_type not in VALID_TRANSACTION_TYPES:
        raise ValueError(f"Unsupported transaction type: {transaction_type}")


def _validate_shooting_entry_role(role: str) -> None:
    if role not in VALID_SHOOTING_ENTRY_ITEM_ROLES:
        raise ValueError(f"Unsupported shooting entry item role: {role}")


def _item_fields(payload: ItemCreate | ItemUpdate) -> dict:
    data = payload.model_dump(exclude_unset=True)
    return {key: value for key, value in data.items() if key not in {"camera", "lens", "film"}}


def _create_item_fields(payload: ItemCreate) -> dict:
    data = _item_fields(payload)
    if data.get("purchase_price") is not None and data.get("current_value") is None:
        data["current_value"] = data["purchase_price"]
    return data


def _update_item_fields(item: Item, payload: ItemUpdate) -> dict:
    data = _item_fields(payload)
    if (
        "current_value" in data
        and data["current_value"] is None
        and item.current_value is None
        and data.get("purchase_price") is not None
    ):
        data["current_value"] = data["purchase_price"]
    return data


def _extension_model(item_type: str):
    return {"camera": Camera, "lens": Lens, "film": Film}.get(item_type)


def _extension_payload(payload: ItemCreate | ItemUpdate, item_type: str):
    return {
        "camera": payload.camera,
        "lens": payload.lens,
        "film": payload.film,
    }.get(item_type)


def _read_extension(session: Session, item: Item) -> Camera | Lens | Film | None:
    model = _extension_model(item.type)
    if model is None or item.id is None:
        return None
    return session.exec(select(model).where(model.item_id == item.id)).first()


def _set_extension(
    session: Session,
    item: Item,
    payload: CameraBase | LensBase | FilmBase | None,
) -> None:
    model = _extension_model(item.type)
    if model is None or payload is None or item.id is None:
        return

    data = payload.model_dump(exclude_unset=True)
    existing = session.exec(select(model).where(model.item_id == item.id)).first()
    if existing is None:
        session.add(model(item_id=item.id, **data))
        return

    for key, value in data.items():
        setattr(existing, key, value)
    session.add(existing)


def _delete_extensions(session: Session, item_id: int) -> None:
    for model in (Camera, Lens, Film):
        session.exec(delete(model).where(model.item_id == item_id))


def _safe_folder_name(value: str | None) -> str:
    slug = re.sub(r"[^\w-]+", "-", (value or "").strip().lower()).strip("-_")
    return slug or SHOOTING_ENTRY_FOLDER_FALLBACK


def _folder_title(value: str) -> str:
    name = value.strip()
    match = re.match(r"^\d+-(.+)$", name)
    if match:
        name = match.group(1)
    return name.replace("-", " ").strip() or SHOOTING_ENTRY_FOLDER_FALLBACK


def _shooting_entry_folder(entry: ShootingEntry) -> str:
    return f"{entry.id}-{_safe_folder_name(entry.title)}"


def _shooting_entries_dir() -> Path:
    return _upload_dir() / SHOOTING_ENTRIES_UPLOAD_DIR


def _ensure_shooting_entries_dir() -> Path:
    path = _shooting_entries_dir()
    path.mkdir(parents=True, exist_ok=True)
    return path


def _find_shooting_entry_folders(entry_id: int) -> list[Path]:
    prefix = f"{entry_id}-"
    root = _ensure_shooting_entries_dir()
    return sorted(
        (folder for folder in root.iterdir() if folder.is_dir() and folder.name.startswith(prefix)),
        key=lambda folder: folder.name.lower(),
    )


def _find_shooting_entry_folder(entry_id: int) -> Path | None:
    folders = _find_shooting_entry_folders(entry_id)
    return folders[0] if folders else None


def _rewrite_shooting_entry_photo_folder_paths(
    session: Session,
    entry_id: int,
    old_folder_name: str,
    new_folder_name: str,
) -> None:
    photos = session.exec(select(ShootingEntryPhoto).where(ShootingEntryPhoto.entry_id == entry_id)).all()
    changed = False

    for photo in photos:
        photo_changed = False
        for field_name in ("file_path", "thumbnail_path"):
            value = getattr(photo, field_name)
            if not value:
                continue

            relative_path = _upload_relative_path(value)
            if (
                relative_path is None
                or len(relative_path.parts) < 3
                or relative_path.parts[0] != SHOOTING_ENTRIES_UPLOAD_DIR
                or relative_path.parts[1] != old_folder_name
            ):
                continue

            next_path = Path(SHOOTING_ENTRIES_UPLOAD_DIR) / new_folder_name / Path(*relative_path.parts[2:])
            setattr(photo, field_name, _stored_upload_path(next_path))
            photo_changed = True

        if photo_changed:
            session.add(photo)
            changed = True

    if changed:
        session.commit()


def _merge_shooting_entry_folder(source: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for child in source.iterdir():
        destination = target / child.name
        if not destination.exists():
            child.rename(destination)
    try:
        source.rmdir()
    except OSError:
        pass


def _sync_shooting_entry_folder_name(session: Session, entry: ShootingEntry, create: bool = False) -> Path:
    if entry.id is None:
        raise ValueError("Shooting entry id is required")

    root = _ensure_shooting_entries_dir()
    target = root / _shooting_entry_folder(entry)
    folders = _find_shooting_entry_folders(entry.id)
    existing = target if target in folders else (folders[0] if folders else None)

    if existing is None:
        if create:
            target.mkdir(parents=True, exist_ok=True)
        return target

    if existing == target:
        for folder in folders:
            if folder == target:
                continue
            old_folder_name = folder.name
            _merge_shooting_entry_folder(folder, target)
            _rewrite_shooting_entry_photo_folder_paths(session, entry.id, old_folder_name, target.name)
        return target

    root_resolved = root.resolve(strict=False)
    existing_resolved = existing.resolve(strict=False)
    target_resolved = target.resolve(strict=False)
    try:
        existing_resolved.relative_to(root_resolved)
        target_resolved.relative_to(root_resolved)
    except ValueError:
        return existing

    old_folder_name = existing.name
    if target.exists() and target.is_dir():
        _merge_shooting_entry_folder(existing, target)
    elif not target.exists():
        existing.rename(target)
    else:
        return existing

    _rewrite_shooting_entry_photo_folder_paths(session, entry.id, old_folder_name, target.name)
    return target


def _shooting_entry_synced_relative_dir(session: Session, entry: ShootingEntry, create: bool = False) -> Path:
    folder = _sync_shooting_entry_folder_name(session, entry, create=create)
    return Path(SHOOTING_ENTRIES_UPLOAD_DIR) / folder.name


def _upload_relative_path(file_path: str) -> Path | None:
    path = Path(file_path)

    if path.is_absolute():
        try:
            return path.resolve(strict=False).relative_to(_upload_dir().resolve(strict=False))
        except ValueError:
            return None

    parts = path.parts
    if parts and parts[0] == "uploads":
        parts = parts[1:]

    if not parts or any(part in {"", ".", ".."} for part in parts):
        return None

    relative = Path(*parts)
    if relative.is_absolute():
        return None

    target = (_upload_dir() / relative).resolve(strict=False)
    try:
        target.relative_to(_upload_dir().resolve(strict=False))
    except ValueError:
        return None

    return relative


def _upload_target_path(relative_path: Path) -> Path:
    target_path = _upload_dir() / relative_path
    target_path.parent.mkdir(parents=True, exist_ok=True)
    return target_path


def _stored_upload_path(relative_path: Path) -> str:
    return f"uploads/{relative_path.as_posix()}"


def _upload_url(file_path: str) -> str:
    relative_path = _upload_relative_path(file_path)
    if relative_path is None:
        return f"/uploads/{Path(file_path).name}"
    return f"/uploads/{relative_path.as_posix()}"


def _thumbnail_relative_path(file_path: str) -> Path | None:
    relative_path = _upload_relative_path(file_path)
    if relative_path is None:
        return None
    return relative_path.parent / "thumbs" / f"{relative_path.stem}.webp"


def _generate_thumbnail(source_path: Path, original_file_path: str) -> str | None:
    thumbnail_relative_path = _thumbnail_relative_path(original_file_path)
    if thumbnail_relative_path is None:
        return None

    thumbnail_path = _upload_dir() / thumbnail_relative_path
    if thumbnail_path.exists():
        return _stored_upload_path(thumbnail_relative_path)

    try:
        with Image.open(source_path) as image:
            image = image.convert("RGB")
            image.thumbnail(THUMBNAIL_MAX_SIZE)
            thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(thumbnail_path, "WEBP", quality=THUMBNAIL_QUALITY, method=6)
    except Exception:
        return None

    return _stored_upload_path(thumbnail_relative_path)


def _ensure_photo_thumbnail(photo: Photo | ShootingEntryPhoto) -> None:
    if photo.thumbnail_path:
        thumbnail_relative_path = _upload_relative_path(photo.thumbnail_path)
        if thumbnail_relative_path is not None and (_upload_dir() / thumbnail_relative_path).is_file():
            return
        photo.thumbnail_path = None

    relative_path = _upload_relative_path(photo.file_path)
    if relative_path is None:
        return

    thumbnail_path = _generate_thumbnail(_upload_dir() / relative_path, photo.file_path)
    if thumbnail_path is not None:
        photo.thumbnail_path = thumbnail_path


def _ensure_photo_thumbnails(session: Session, photos: list[Photo | ShootingEntryPhoto]) -> None:
    changed = False
    for photo in photos:
        original_thumbnail_path = photo.thumbnail_path
        _ensure_photo_thumbnail(photo)
        if photo.thumbnail_path != original_thumbnail_path:
            session.add(photo)
            changed = True

    if changed:
        session.commit()


def _delete_upload_files(file_paths: list[str]) -> None:
    for file_path in file_paths:
        relative_path = _upload_relative_path(file_path)
        if relative_path is None:
            continue

        path = _upload_dir() / relative_path
        if path.exists() and path.is_file():
            path.unlink()


def _delete_photo_files(photos: list[Photo]) -> None:
    _delete_upload_files([path for photo in photos for path in (photo.file_path, photo.thumbnail_path) if path])


def _photo_url(photo: Photo) -> str:
    return _upload_url(photo.file_path)


def _photo_thumbnail_url(photo: Photo) -> str | None:
    return _upload_url(photo.thumbnail_path) if photo.thumbnail_path else None


def _shooting_entry_photo_url(photo: ShootingEntryPhoto) -> str:
    return _upload_url(photo.file_path)


def _shooting_entry_photo_thumbnail_url(photo: ShootingEntryPhoto) -> str | None:
    return _upload_url(photo.thumbnail_path) if photo.thumbnail_path else None


def _to_photo_read(photo: Photo) -> PhotoRead:
    data = photo.model_dump()
    data["url"] = _photo_url(photo)
    data["thumbnail_url"] = _photo_thumbnail_url(photo)
    return PhotoRead.model_validate(data)


def _to_shooting_entry_photo_read(photo: ShootingEntryPhoto) -> ShootingEntryPhotoRead:
    data = photo.model_dump()
    data["url"] = _shooting_entry_photo_url(photo)
    data["thumbnail_url"] = _shooting_entry_photo_thumbnail_url(photo)
    return ShootingEntryPhotoRead.model_validate(data)


def _upload_dir() -> Path:
    from app.core.config import settings

    path = Path(settings.upload_dir)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def _validate_photo_upload(file_name: str, content_type: str | None, content: bytes) -> str:
    extension = Path(file_name).suffix.lower().lstrip(".")
    if extension not in ALLOWED_PHOTO_EXTENSIONS:
        raise ValueError("Only jpg, jpeg, png and webp images are allowed")
    if content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
        raise ValueError("Only image/jpeg, image/png and image/webp content types are allowed")
    if len(content) > MAX_PHOTO_SIZE_BYTES:
        raise ValueError("Image size must be 10MB or less")
    return extension


def _photo_content_type(path: Path) -> str | None:
    extension = path.suffix.lower().lstrip(".")
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(extension)


def calculate_dominant_color(content: bytes) -> str | None:
    try:
        from io import BytesIO

        with Image.open(BytesIO(content)) as image:
            image = image.convert("RGB")
            source_width, source_height = image.size
            crop_width = max(1, round(source_width * 0.28))
            image = image.crop((0, 0, crop_width, source_height)).resize((28, 28))
            pixels = list(image.getdata())
    except Exception:
        return None

    if not pixels:
        return None

    red = sum(pixel[0] for pixel in pixels) / len(pixels)
    green = sum(pixel[1] for pixel in pixels) / len(pixels)
    blue = sum(pixel[2] for pixel in pixels) / len(pixels)
    mix = 0.16
    red = round(red + (255 - red) * mix)
    green = round(green + (255 - green) * mix)
    blue = round(blue + (255 - blue) * mix)
    return f"#{red:02x}{green:02x}{blue:02x}"


def _to_item_read(session: Session, item: Item) -> ItemRead:
    extension = _read_extension(session, item)
    data = item.model_dump()
    data["camera"] = extension if isinstance(extension, Camera) else None
    data["lens"] = extension if isinstance(extension, Lens) else None
    data["film"] = extension if isinstance(extension, Film) else None
    return ItemRead.model_validate(data)


def _read_shooting_entry_items(session: Session, entry_id: int) -> list[ShootingEntryItemLinkRead]:
    links = session.exec(select(ShootingEntryItem).where(ShootingEntryItem.entry_id == entry_id).order_by(ShootingEntryItem.id)).all()
    result: list[ShootingEntryItemLinkRead] = []
    for link in links:
        item = session.get(Item, link.item_id)
        if item is None:
            continue
        data = link.model_dump()
        data["item"] = _to_item_read(session, item)
        result.append(ShootingEntryItemLinkRead.model_validate(data))
    return result


def _sync_shooting_entry_folder_photos(session: Session, entry: ShootingEntry) -> None:
    if entry.id is None:
        return

    folder = _sync_shooting_entry_folder_name(session, entry)
    if not folder.exists() or not folder.is_dir():
        return

    photos = session.exec(
        select(ShootingEntryPhoto)
        .where(ShootingEntryPhoto.entry_id == entry.id)
    ).all()
    seen_paths = {
        relative_path.as_posix()
        for photo in photos
        if (relative_path := _upload_relative_path(photo.file_path)) is not None
    }
    changed = False

    for path in sorted(folder.iterdir(), key=lambda item: item.name.lower()):
        if not path.is_file() or path.suffix.lower().lstrip(".") not in ALLOWED_PHOTO_EXTENSIONS:
            continue

        relative_path = Path(SHOOTING_ENTRIES_UPLOAD_DIR) / folder.name / path.name
        if relative_path.as_posix() in seen_paths:
            continue

        stat = path.stat()
        photo = ShootingEntryPhoto(
            entry_id=entry.id,
            file_path=_stored_upload_path(relative_path),
            file_name=path.name,
            content_type=_photo_content_type(path),
            file_size=stat.st_size,
            dominant_color=None,
            created_at=datetime.fromtimestamp(stat.st_mtime, timezone.utc),
        )
        _ensure_photo_thumbnail(photo)
        session.add(photo)
        changed = True

    if changed:
        session.commit()


def _read_shooting_entry_photos(
    session: Session,
    entry_id: int,
    include_folder_photos: bool = False,
) -> list[ShootingEntryPhotoRead]:
    if include_folder_photos:
        entry = session.get(ShootingEntry, entry_id)
        if entry is not None:
            _sync_shooting_entry_folder_photos(session, entry)

    photos = session.exec(
        select(ShootingEntryPhoto)
        .where(ShootingEntryPhoto.entry_id == entry_id)
        .order_by(ShootingEntryPhoto.sort_order, ShootingEntryPhoto.created_at, ShootingEntryPhoto.id)
    ).all()
    _ensure_photo_thumbnails(session, list(photos))
    result = [_to_shooting_entry_photo_read(photo) for photo in photos]

    return result


def _to_shooting_entry_read(
    session: Session,
    entry: ShootingEntry,
    include_folder_photos: bool = False,
) -> ShootingEntryRead:
    data = entry.model_dump()
    photos = _read_shooting_entry_photos(session, entry.id or 0, include_folder_photos=include_folder_photos)
    data["item_links"] = _read_shooting_entry_items(session, entry.id or 0)
    data["photos"] = photos
    data["photo_count"] = len(photos)
    return ShootingEntryRead.model_validate(data)


def _validate_shooting_entry_title(title: str | None) -> None:
    if title is None or not title.strip():
        raise ValueError("Title is required")


def _set_shooting_entry_items(
    session: Session,
    entry_id: int,
    item_links: list[ShootingEntryItemLinkBase],
) -> None:
    session.exec(delete(ShootingEntryItem).where(ShootingEntryItem.entry_id == entry_id))

    for item_link in item_links:
        _validate_shooting_entry_role(item_link.role)
        item = session.get(Item, item_link.item_id)
        if item is None:
            raise ValueError(f"Item not found: {item_link.item_id}")
        session.add(ShootingEntryItem(entry_id=entry_id, item_id=item_link.item_id, role=item_link.role))


def _delete_shooting_entry_photo_files(photos: list[ShootingEntryPhoto]) -> None:
    _delete_upload_files([path for photo in photos for path in (photo.file_path, photo.thumbnail_path) if path])


def _delete_shooting_entry_folder(entry: ShootingEntry) -> None:
    if entry.id is None:
        return

    folder = _find_shooting_entry_folder(entry.id)
    if folder is None or not folder.exists():
        return

    root = _shooting_entries_dir().resolve(strict=False)
    target = folder.resolve(strict=False)
    try:
        target.relative_to(root)
    except ValueError:
        return

    shutil.rmtree(target)


def _sync_shooting_entry_folders(session: Session) -> None:
    root = _shooting_entries_dir()
    root_existed = root.exists()
    root = _ensure_shooting_entries_dir()
    existing_entries = session.exec(select(ShootingEntry)).all()
    existing_ids = {entry.id for entry in existing_entries if entry.id is not None}
    folder_entry_ids = {
        int(match.group(1))
        for folder in root.iterdir()
        if folder.is_dir() and (match := re.match(r"^(\d+)-(.+)$", folder.name))
    }
    changed = False

    if root_existed:
        missing_entries = [entry for entry in existing_entries if entry.id is not None and entry.id not in folder_entry_ids]
        for entry in missing_entries:
            session.exec(delete(ShootingEntryItem).where(ShootingEntryItem.entry_id == entry.id))
            session.exec(delete(ShootingEntryPhoto).where(ShootingEntryPhoto.entry_id == entry.id))
            session.delete(entry)
            existing_ids.discard(entry.id)
            changed = True

    for folder in sorted(root.iterdir(), key=lambda item: item.name.lower()):
        if not folder.is_dir():
            continue

        match = re.match(r"^(\d+)-(.+)$", folder.name)
        if match and int(match.group(1)) in existing_ids:
            continue

        title = _folder_title(folder.name)
        entry = ShootingEntry(title=title)
        session.add(entry)
        session.commit()
        session.refresh(entry)

        if entry.id is None:
            continue

        existing_ids.add(entry.id)
        target = root / _shooting_entry_folder(entry)
        if folder != target and not target.exists():
            folder.rename(target)
        changed = True

    for entry in existing_entries:
        if entry.id is not None and entry.id in existing_ids:
            _sync_shooting_entry_folder_name(session, entry, create=True)

    if changed:
        session.commit()


def create_item(session: Session, payload: ItemCreate) -> ItemRead:
    _validate_item_type(payload.type)
    item = Item(**_create_item_fields(payload))
    session.add(item)
    session.commit()
    session.refresh(item)

    _set_extension(session, item, _extension_payload(payload, item.type))
    session.commit()
    session.refresh(item)
    return _to_item_read(session, item)


def get_item(session: Session, item_id: int) -> ItemRead | None:
    item = session.get(Item, item_id)
    if item is None:
        return None
    return _to_item_read(session, item)


def list_items(
    session: Session,
    item_type: str | None = None,
    brand: str | None = None,
    status: str | None = None,
    mount: str | None = None,
    keyword: str | None = None,
    sort: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ItemRead], int]:
    statement = select(Item)
    count_statement = select(func.count(Item.id))

    filters = []
    if item_type:
        filters.append(Item.type == item_type)
    if brand:
        filters.append(Item.brand == brand)
    if status:
        filters.append(Item.status == status)
    if keyword:
        pattern = f"%{keyword}%"
        filters.append(
            or_(
                Item.brand.ilike(pattern),
                Item.model.ilike(pattern),
                Item.nickname.ilike(pattern),
                Item.serial_number.ilike(pattern),
                Item.notes.ilike(pattern),
            )
        )
    if mount:
        camera_ids = select(Camera.item_id).where(Camera.mount == mount)
        lens_ids = select(Lens.item_id).where(Lens.mount == mount)
        filters.append(or_(Item.id.in_(camera_ids), Item.id.in_(lens_ids)))

    for filter_item in filters:
        statement = statement.where(filter_item)
        count_statement = count_statement.where(filter_item)

    statement = statement.order_by(*_item_order_by(sort)).offset((page - 1) * page_size).limit(page_size)

    total = session.exec(count_statement).one()
    items = session.exec(statement).all()
    return [_to_item_read(session, item) for item in items], total


def update_item(session: Session, item_id: int, payload: ItemUpdate) -> ItemRead | None:
    item = session.get(Item, item_id)
    if item is None:
        return None

    item_data = _update_item_fields(item, payload)
    next_type = item_data.get("type", item.type)
    _validate_item_type(next_type)

    if next_type != item.type and item.id is not None:
        _delete_extensions(session, item.id)

    for key, value in item_data.items():
        setattr(item, key, value)
    item.updated_at = utc_now()
    session.add(item)
    session.commit()
    session.refresh(item)

    _set_extension(session, item, _extension_payload(payload, item.type))
    session.commit()
    session.refresh(item)
    return _to_item_read(session, item)


def delete_item(session: Session, item_id: int) -> bool:
    item = session.get(Item, item_id)
    if item is None:
        return False

    photos = session.exec(select(Photo).where(Photo.item_id == item_id)).all()
    _delete_photo_files(list(photos))
    _delete_extensions(session, item_id)
    session.exec(delete(Photo).where(Photo.item_id == item_id))
    session.exec(delete(Transaction).where(Transaction.item_id == item_id))
    session.delete(item)
    session.commit()
    return True


def create_transaction(
    session: Session,
    item_id: int,
    payload: TransactionCreate,
) -> TransactionRead | None:
    item = session.get(Item, item_id)
    if item is None:
        return None

    _validate_transaction_type(payload.type)
    transaction = Transaction(item_id=item_id, **payload.model_dump())
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return TransactionRead.model_validate(transaction)


def list_transactions(session: Session, item_id: int) -> list[TransactionRead] | None:
    item = session.get(Item, item_id)
    if item is None:
        return None

    statement = (
        select(Transaction)
        .where(Transaction.item_id == item_id)
        .order_by(Transaction.created_at.desc())
    )
    transactions = session.exec(statement).all()
    return [TransactionRead.model_validate(transaction) for transaction in transactions]


def update_transaction(
    session: Session,
    transaction_id: int,
    payload: TransactionUpdate,
) -> TransactionRead | None:
    transaction = session.get(Transaction, transaction_id)
    if transaction is None:
        return None

    data = payload.model_dump(exclude_unset=True)
    transaction_type = data.get("type")
    if transaction_type is not None:
        _validate_transaction_type(transaction_type)

    for key, value in data.items():
        setattr(transaction, key, value)

    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return TransactionRead.model_validate(transaction)


def delete_transaction(session: Session, transaction_id: int) -> bool:
    transaction = session.get(Transaction, transaction_id)
    if transaction is None:
        return False

    session.delete(transaction)
    session.commit()
    return True


def create_photo(
    session: Session,
    item_id: int,
    file_name: str,
    content_type: str | None,
    content: bytes,
) -> PhotoRead | None:
    item = session.get(Item, item_id)
    if item is None:
        return None

    extension = _validate_photo_upload(file_name, content_type, content)
    stored_name = f"{uuid4().hex}.{extension}"
    relative_path = Path(item.type) / stored_name
    target_path = _upload_target_path(relative_path)
    target_path.write_bytes(content)

    photo = Photo(
        item_id=item_id,
        file_path=_stored_upload_path(relative_path),
        file_name=file_name,
        content_type=content_type,
        file_size=len(content),
    )
    _ensure_photo_thumbnail(photo)
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return _to_photo_read(photo)


def list_photos(session: Session, item_id: int) -> list[PhotoRead] | None:
    item = session.get(Item, item_id)
    if item is None:
        return None

    statement = (
        select(Photo)
        .where(Photo.item_id == item_id)
        .order_by(Photo.sort_order, Photo.created_at, Photo.id)
    )
    photos = session.exec(statement).all()
    _ensure_photo_thumbnails(session, list(photos))
    return [_to_photo_read(photo) for photo in photos]


def delete_photo(session: Session, photo_id: int) -> bool:
    photo = session.get(Photo, photo_id)
    if photo is None:
        return False

    _delete_photo_files([photo])
    session.delete(photo)
    session.commit()
    return True


def create_shooting_entry(session: Session, payload: ShootingEntryCreate) -> ShootingEntryRead:
    _sync_shooting_entry_folders(session)
    _validate_shooting_entry_title(payload.title)
    entry = ShootingEntry(
        title=payload.title.strip(),
        date=payload.date,
        location=payload.location,
        notes=payload.notes,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)

    if entry.id is None:
        raise ValueError("Shooting entry was not created")
    _sync_shooting_entry_folder_name(session, entry, create=True)
    _set_shooting_entry_items(session, entry.id, payload.item_links)
    session.commit()
    session.refresh(entry)
    _sync_shooting_entry_folder_name(session, entry, create=True)
    return _to_shooting_entry_read(session, entry, include_folder_photos=True)


def get_shooting_entry(session: Session, entry_id: int) -> ShootingEntryRead | None:
    _sync_shooting_entry_folders(session)
    entry = session.get(ShootingEntry, entry_id)
    if entry is None:
        return None
    return _to_shooting_entry_read(session, entry, include_folder_photos=True)


def list_shooting_entries(
    session: Session,
    keyword: str | None = None,
    item_id: int | None = None,
    camera_item_ids: list[int] | None = None,
    lens_item_ids: list[int] | None = None,
    film_item_ids: list[int] | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ShootingEntryListResponse:
    _sync_shooting_entry_folders(session)
    entries = session.exec(
        select(ShootingEntry).order_by(ShootingEntry.date.desc(), ShootingEntry.created_at.desc(), ShootingEntry.id.desc())
    ).all()

    if keyword:
        needle = keyword.lower()
        entries = [
            entry
            for entry in entries
            if needle in entry.title.lower()
            or (entry.location is not None and needle in entry.location.lower())
            or (entry.notes is not None and needle in entry.notes.lower())
        ]

    if item_id is not None:
        entry_ids = {
            link.entry_id
            for link in session.exec(select(ShootingEntryItem).where(ShootingEntryItem.item_id == item_id)).all()
        }
        entries = [entry for entry in entries if entry.id in entry_ids]

    role_filters = [
        ("camera", camera_item_ids or []),
        ("lens", lens_item_ids or []),
        ("film", film_item_ids or []),
    ]
    for role, item_ids in role_filters:
        if not item_ids:
            continue
        entry_ids = {
            link.entry_id
            for link in session.exec(
                select(ShootingEntryItem)
                .where(ShootingEntryItem.role == role)
                .where(ShootingEntryItem.item_id.in_(item_ids))
            ).all()
        }
        entries = [entry for entry in entries if entry.id in entry_ids]

    total = len(entries)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = entries[start:end]

    return ShootingEntryListResponse(
        items=[_to_shooting_entry_read(session, entry) for entry in page_items],
        page=page,
        page_size=page_size,
        total=total,
    )


def update_shooting_entry(
    session: Session,
    entry_id: int,
    payload: ShootingEntryUpdate,
) -> ShootingEntryRead | None:
    entry = session.get(ShootingEntry, entry_id)
    if entry is None:
        return None

    data = payload.model_dump(exclude_unset=True, exclude={"item_links"})
    if "title" in data:
        _validate_shooting_entry_title(data["title"])
        data["title"] = data["title"].strip()
    for key, value in data.items():
        setattr(entry, key, value)

    entry.updated_at = utc_now()
    session.add(entry)
    if payload.item_links is not None:
        _set_shooting_entry_items(session, entry_id, payload.item_links)

    session.commit()
    session.refresh(entry)
    return _to_shooting_entry_read(session, entry, include_folder_photos=True)


def delete_shooting_entry(session: Session, entry_id: int) -> bool:
    entry = session.get(ShootingEntry, entry_id)
    if entry is None:
        return False

    photos = session.exec(select(ShootingEntryPhoto).where(ShootingEntryPhoto.entry_id == entry_id)).all()
    _delete_shooting_entry_photo_files(list(photos))
    _delete_shooting_entry_folder(entry)
    session.exec(delete(ShootingEntryItem).where(ShootingEntryItem.entry_id == entry_id))
    session.exec(delete(ShootingEntryPhoto).where(ShootingEntryPhoto.entry_id == entry_id))
    session.delete(entry)
    session.commit()
    return True


def create_shooting_entry_photo(
    session: Session,
    entry_id: int,
    file_name: str,
    content_type: str | None,
    content: bytes,
) -> ShootingEntryPhotoRead | None:
    entry = session.get(ShootingEntry, entry_id)
    if entry is None:
        return None

    extension = _validate_photo_upload(file_name, content_type, content)
    stored_name = f"{uuid4().hex}.{extension}"
    relative_path = _shooting_entry_synced_relative_dir(session, entry, create=True) / stored_name
    target_path = _upload_target_path(relative_path)
    target_path.write_bytes(content)

    photo = ShootingEntryPhoto(
        entry_id=entry_id,
        file_path=_stored_upload_path(relative_path),
        file_name=file_name,
        content_type=content_type,
        file_size=len(content),
        dominant_color=calculate_dominant_color(content),
    )
    _ensure_photo_thumbnail(photo)
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return _to_shooting_entry_photo_read(photo)


def list_shooting_entry_photos(session: Session, entry_id: int) -> list[ShootingEntryPhotoRead] | None:
    _sync_shooting_entry_folders(session)
    entry = session.get(ShootingEntry, entry_id)
    if entry is None:
        return None
    return _read_shooting_entry_photos(session, entry_id, include_folder_photos=True)


def delete_shooting_entry_photo(session: Session, photo_id: int) -> bool:
    photo = session.get(ShootingEntryPhoto, photo_id)
    if photo is None:
        return False

    _delete_shooting_entry_photo_files([photo])
    session.delete(photo)
    session.commit()
    return True


def set_shooting_entry_cover_photo(session: Session, photo_id: int) -> ShootingEntryPhotoRead | None:
    photo = session.get(ShootingEntryPhoto, photo_id)
    if photo is None:
        return None

    photos = session.exec(
        select(ShootingEntryPhoto)
        .where(ShootingEntryPhoto.entry_id == photo.entry_id)
        .order_by(ShootingEntryPhoto.sort_order, ShootingEntryPhoto.created_at, ShootingEntryPhoto.id)
    ).all()

    photo.sort_order = 0
    _ensure_photo_thumbnail(photo)
    session.add(photo)
    next_order = 1
    for item in photos:
        if item.id == photo.id:
            continue
        item.sort_order = next_order
        next_order += 1
        session.add(item)

    session.commit()
    session.refresh(photo)
    return _to_shooting_entry_photo_read(photo)
