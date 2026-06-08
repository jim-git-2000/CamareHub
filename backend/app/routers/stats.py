from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app import crud
from app.database import get_session
from app.models import Film, Item, Lens
from app.schemas import (
    FilmStockBucketRead,
    LensFocalLengthBucketRead,
    StatsBucketRead,
    StatsSummaryRead,
)


router = APIRouter(prefix="/stats", tags=["stats"])


TYPE_LABELS = {
    "camera": "相机",
    "lens": "镜头",
    "film": "胶片",
    "accessory": "配件",
}

FOCAL_CATEGORY_BUCKETS: tuple[tuple[str, str, float | None, float | None], ...] = (
    ("ultra_wide", "超广角", None, 24),
    ("wide", "广角", 24, 35),
    ("normal", "中焦", 35, 70),
    ("medium_tele", "中长焦", 70, 100),
    ("tele", "长焦", 100, 300),
    ("super_tele", "超长焦", 300, None),
)


def _item_value(item: Item) -> float:
    return item.current_value or 0


def _film_quantity(film: Film) -> int:
    return film.quantity or 0


def _lens_label(lens: Lens) -> str:
    start = lens.focal_length_min
    end = lens.focal_length_max

    if start is not None and end is not None:
        if start == end:
            return f"{start:g}mm"
        return f"{start:g}-{end:g}mm"
    if start is not None:
        return f"{start:g}mm"
    if end is not None:
        return f"{end:g}mm"
    return "未知焦段"


def _lens_sort_key(bucket: LensFocalLengthBucketRead) -> tuple[int, float, str]:
    if bucket.focal_length_min is None:
        return (1, 0, bucket.label)
    return (0, bucket.focal_length_min, bucket.label)


def _lens_range(lens: Lens) -> tuple[float, float] | None:
    values = [value for value in (lens.focal_length_min, lens.focal_length_max) if value is not None]
    if not values:
        return None
    return min(values), max(values)


def _is_zoom_lens(lens: Lens) -> bool:
    return (
        lens.focal_length_min is not None
        and lens.focal_length_max is not None
        and lens.focal_length_min != lens.focal_length_max
    )


def _range_overlaps(start: float, end: float, lower: float | None, upper: float | None) -> bool:
    if lower is not None and end < lower:
        return False
    if upper is not None and start >= upper:
        return False
    return True


@router.get("/summary", response_model=StatsSummaryRead)
def summary(session: Session = Depends(get_session)) -> StatsSummaryRead:
    items = session.exec(select(Item)).all()
    films = session.exec(select(Film)).all()
    recent_items, _ = crud.list_items(session=session, sort="-purchase_date", page=1, page_size=5)

    return StatsSummaryRead(
        total_value=sum(_item_value(item) for item in items),
        camera_count=sum(1 for item in items if item.type == "camera"),
        lens_count=sum(1 for item in items if item.type == "lens"),
        film_stock=sum(_film_quantity(film) for film in films),
        recent_items=recent_items,
    )


@router.get("/by-brand", response_model=list[StatsBucketRead])
def by_brand(session: Session = Depends(get_session)) -> list[StatsBucketRead]:
    buckets: dict[str, dict[str, float | int]] = defaultdict(lambda: {"count": 0, "total_value": 0.0})

    for item in session.exec(select(Item)).all():
        key = item.brand or "未知品牌"
        buckets[key]["count"] += 1
        buckets[key]["total_value"] += _item_value(item)

    return [
        StatsBucketRead(key=brand, label=brand, count=int(data["count"]), total_value=float(data["total_value"]))
        for brand, data in sorted(buckets.items(), key=lambda entry: (-int(entry[1]["count"]), entry[0]))
    ]


@router.get("/by-type", response_model=list[StatsBucketRead])
def by_type(session: Session = Depends(get_session)) -> list[StatsBucketRead]:
    buckets: dict[str, dict[str, float | int]] = defaultdict(lambda: {"count": 0, "total_value": 0.0})

    for item in session.exec(select(Item)).all():
        buckets[item.type]["count"] += 1
        buckets[item.type]["total_value"] += _item_value(item)

    return [
        StatsBucketRead(
            key=item_type,
            label=TYPE_LABELS.get(item_type, item_type),
            count=int(data["count"]),
            total_value=float(data["total_value"]),
        )
        for item_type, data in sorted(buckets.items(), key=lambda entry: (-int(entry[1]["count"]), entry[0]))
    ]


@router.get("/lens-focal-length", response_model=list[LensFocalLengthBucketRead])
def lens_focal_length(session: Session = Depends(get_session)) -> list[LensFocalLengthBucketRead]:
    buckets: dict[str, LensFocalLengthBucketRead] = {}

    for lens in session.exec(select(Lens)).all():
        label = _lens_label(lens)
        if label not in buckets:
            buckets[label] = LensFocalLengthBucketRead(
                label=label,
                count=0,
                focal_length_min=lens.focal_length_min,
                focal_length_max=lens.focal_length_max,
            )
        buckets[label].count += 1

    return sorted(buckets.values(), key=_lens_sort_key)


@router.get("/lens-zoom-type", response_model=list[StatsBucketRead])
def lens_zoom_type(session: Session = Depends(get_session)) -> list[StatsBucketRead]:
    buckets = {
        "prime": StatsBucketRead(key="prime", label="定焦", count=0),
        "zoom": StatsBucketRead(key="zoom", label="变焦", count=0),
    }

    for lens in session.exec(select(Lens)).all():
        if _lens_range(lens) is None:
            continue

        key = "zoom" if _is_zoom_lens(lens) else "prime"
        buckets[key].count += 1

    return [buckets["prime"], buckets["zoom"]]


@router.get("/lens-focal-category", response_model=list[StatsBucketRead])
def lens_focal_category(session: Session = Depends(get_session)) -> list[StatsBucketRead]:
    buckets = {
        key: StatsBucketRead(key=key, label=label, count=0)
        for key, label, _lower, _upper in FOCAL_CATEGORY_BUCKETS
    }

    for lens in session.exec(select(Lens)).all():
        lens_range = _lens_range(lens)
        if lens_range is None:
            continue

        start, end = lens_range
        for key, _label, lower, upper in FOCAL_CATEGORY_BUCKETS:
            if _range_overlaps(start, end, lower, upper):
                buckets[key].count += 1

    return [buckets[key] for key, _label, _lower, _upper in FOCAL_CATEGORY_BUCKETS]


@router.get("/film-stock", response_model=list[FilmStockBucketRead])
def film_stock(session: Session = Depends(get_session)) -> list[FilmStockBucketRead]:
    items = {item.id: item for item in session.exec(select(Item).where(Item.type == "film")).all()}
    buckets: list[FilmStockBucketRead] = []

    for film in session.exec(select(Film)).all():
        item = items.get(film.item_id)
        if item is None or item.id is None:
            continue

        buckets.append(
            FilmStockBucketRead(
                item_id=item.id,
                label=f"{item.brand} {item.model}",
                brand=item.brand,
                model=item.model,
                quantity=_film_quantity(film),
            )
        )

    return sorted(buckets, key=lambda bucket: (-bucket.quantity, bucket.label))
