from datetime import date as Date
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Item(SQLModel, table=True):
    __tablename__ = "items"

    id: int | None = Field(default=None, primary_key=True)
    type: str = Field(index=True)
    brand: str = Field(index=True)
    model: str = Field(index=True)
    nickname: str | None = None
    serial_number: str | None = Field(default=None, index=True)
    status: str = Field(default="owned", index=True)
    purchase_date: Date | None = None
    purchase_price: float | None = None
    current_value: float | None = None
    currency: str = Field(default="CNY")
    condition: str = Field(default="unknown")
    location: str | None = None
    notes: str | None = None
    custom_fields: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Camera(SQLModel, table=True):
    __tablename__ = "cameras"

    id: int | None = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="items.id", index=True)
    mount: str | None = None
    format: str | None = None
    camera_type: str | None = None
    film_format: str | None = None
    sensor_type: str | None = None
    megapixels: float | None = None
    shutter_type: str | None = None
    metering: str | None = None
    battery_type: str | None = None
    weight_g: float | None = None


class Lens(SQLModel, table=True):
    __tablename__ = "lenses"

    id: int | None = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="items.id", index=True)
    mount: str | None = None
    focal_length_min: float | None = None
    focal_length_max: float | None = None
    aperture_max: float | None = None
    aperture_min: float | None = None
    filter_size_mm: float | None = None
    minimum_focus_m: float | None = None
    stabilization: bool | None = None
    autofocus: bool | None = None
    weight_g: float | None = None


class Film(SQLModel, table=True):
    __tablename__ = "films"

    id: int | None = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="items.id", index=True)
    iso: int | None = None
    film_format: str | None = None
    color_type: str | None = None
    process: str | None = None
    expiry_date: Date | None = None
    quantity: int | None = None
    storage_location: str | None = None


class Photo(SQLModel, table=True):
    __tablename__ = "photos"

    id: int | None = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="items.id", index=True)
    file_path: str
    thumbnail_path: str | None = None
    file_name: str
    content_type: str | None = None
    file_size: int | None = None
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: int | None = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="items.id", index=True)
    type: str = Field(index=True)
    amount: float | None = None
    currency: str = Field(default="CNY")
    date: Date | None = None
    vendor: str | None = None
    notes: str | None = None
    created_at: datetime = Field(default_factory=utc_now)


class ShootingEntry(SQLModel, table=True):
    __tablename__ = "shooting_entries"

    id: int | None = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    date: Date | None = Field(default=None, index=True)
    location: str | None = None
    notes: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ShootingEntryItem(SQLModel, table=True):
    __tablename__ = "shooting_entry_items"

    id: int | None = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="shooting_entries.id", index=True)
    item_id: int = Field(foreign_key="items.id", index=True)
    role: str = Field(index=True)


class ShootingEntryPhoto(SQLModel, table=True):
    __tablename__ = "shooting_entry_photos"

    id: int | None = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="shooting_entries.id", index=True)
    file_path: str
    thumbnail_path: str | None = None
    file_name: str
    content_type: str | None = None
    file_size: int | None = None
    dominant_color: str | None = None
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)
