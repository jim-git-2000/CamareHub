from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete, func, or_
from sqlmodel import Session, select

from app.database import PROJECT_ROOT
from app.models import Camera, Film, Item, Lens, Photo, Transaction, utc_now
from app.schemas import (
    CameraBase,
    FilmBase,
    ItemCreate,
    ItemRead,
    ItemUpdate,
    LensBase,
    PhotoRead,
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
)


VALID_ITEM_TYPES = {"camera", "lens", "film", "accessory"}
VALID_TRANSACTION_TYPES = {"purchase", "repair", "sale", "maintenance", "accessory"}
ALLOWED_PHOTO_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024
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


def _validate_item_type(item_type: str) -> None:
    if item_type not in VALID_ITEM_TYPES:
        raise ValueError(f"Unsupported item type: {item_type}")


def _validate_transaction_type(transaction_type: str) -> None:
    if transaction_type not in VALID_TRANSACTION_TYPES:
        raise ValueError(f"Unsupported transaction type: {transaction_type}")


def _item_fields(payload: ItemCreate | ItemUpdate) -> dict:
    data = payload.model_dump(exclude_unset=True)
    return {key: value for key, value in data.items() if key not in {"camera", "lens", "film"}}


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


def _delete_photo_files(photos: list[Photo]) -> None:
    for photo in photos:
        path = Path(photo.file_path)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        if path.exists() and path.is_file():
            path.unlink()


def _photo_url(photo: Photo) -> str:
    path = Path(photo.file_path)
    return f"/uploads/{path.name}"


def _to_photo_read(photo: Photo) -> PhotoRead:
    data = photo.model_dump()
    data["url"] = _photo_url(photo)
    return PhotoRead.model_validate(data)


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


def _to_item_read(session: Session, item: Item) -> ItemRead:
    extension = _read_extension(session, item)
    data = item.model_dump()
    data["camera"] = extension if isinstance(extension, Camera) else None
    data["lens"] = extension if isinstance(extension, Lens) else None
    data["film"] = extension if isinstance(extension, Film) else None
    return ItemRead.model_validate(data)


def create_item(session: Session, payload: ItemCreate) -> ItemRead:
    _validate_item_type(payload.type)
    item = Item(**_item_fields(payload))
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

    order_by = VALID_SORTS.get(sort or "-created_at", Item.created_at.desc())
    statement = statement.order_by(order_by).offset((page - 1) * page_size).limit(page_size)

    total = session.exec(count_statement).one()
    items = session.exec(statement).all()
    return [_to_item_read(session, item) for item in items], total


def update_item(session: Session, item_id: int, payload: ItemUpdate) -> ItemRead | None:
    item = session.get(Item, item_id)
    if item is None:
        return None

    item_data = _item_fields(payload)
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
    relative_path = f"uploads/{stored_name}"
    target_path = _upload_dir() / stored_name
    target_path.write_bytes(content)

    photo = Photo(
        item_id=item_id,
        file_path=relative_path,
        file_name=file_name,
        content_type=content_type,
        file_size=len(content),
    )
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
    return [_to_photo_read(photo) for photo in photos]


def delete_photo(session: Session, photo_id: int) -> bool:
    photo = session.get(Photo, photo_id)
    if photo is None:
        return False

    _delete_photo_files([photo])
    session.delete(photo)
    session.commit()
    return True
