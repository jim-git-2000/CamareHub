from datetime import date as Date
from datetime import datetime

from sqlmodel import SQLModel


class CameraBase(SQLModel):
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


class LensBase(SQLModel):
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


class FilmBase(SQLModel):
    iso: int | None = None
    film_format: str | None = None
    color_type: str | None = None
    process: str | None = None
    expiry_date: Date | None = None
    quantity: int | None = None
    storage_location: str | None = None


class ItemBase(SQLModel):
    type: str
    brand: str
    model: str
    nickname: str | None = None
    serial_number: str | None = None
    status: str = "owned"
    purchase_date: Date | None = None
    purchase_price: float | None = None
    current_value: float | None = None
    currency: str = "CNY"
    condition: str = "unknown"
    location: str | None = None
    notes: str | None = None
    custom_fields: str | None = None


class ItemCreate(ItemBase):
    camera: CameraBase | None = None
    lens: LensBase | None = None
    film: FilmBase | None = None


class ItemUpdate(SQLModel):
    type: str | None = None
    brand: str | None = None
    model: str | None = None
    nickname: str | None = None
    serial_number: str | None = None
    status: str | None = None
    purchase_date: Date | None = None
    purchase_price: float | None = None
    current_value: float | None = None
    currency: str | None = None
    condition: str | None = None
    location: str | None = None
    notes: str | None = None
    custom_fields: str | None = None
    camera: CameraBase | None = None
    lens: LensBase | None = None
    film: FilmBase | None = None


class CameraRead(CameraBase):
    id: int
    item_id: int


class LensRead(LensBase):
    id: int
    item_id: int


class FilmRead(FilmBase):
    id: int
    item_id: int


class ItemRead(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    camera: CameraRead | None = None
    lens: LensRead | None = None
    film: FilmRead | None = None


class ItemListResponse(SQLModel):
    items: list[ItemRead]
    page: int
    page_size: int
    total: int
