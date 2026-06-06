from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlmodel import Session
from starlette.datastructures import UploadFile

from app import crud
from app.database import get_session
from app.schemas import (
    ShootingEntryCreate,
    ShootingEntryListResponse,
    ShootingEntryPhotoRead,
    ShootingEntryRead,
    ShootingEntryUpdate,
)


router = APIRouter(tags=["shooting_entries"])


def _parse_item_ids(value: str | None) -> list[int]:
    if not value:
        return []
    try:
        return [int(item) for item in value.split(",") if item.strip()]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid item id filter") from exc


@router.get("/shooting-entries", response_model=ShootingEntryListResponse)
def list_shooting_entries(
    keyword: str | None = None,
    item_id: int | None = None,
    camera_item_ids: str | None = None,
    lens_item_ids: str | None = None,
    film_item_ids: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> ShootingEntryListResponse:
    return crud.list_shooting_entries(
        session=session,
        keyword=keyword,
        item_id=item_id,
        camera_item_ids=_parse_item_ids(camera_item_ids),
        lens_item_ids=_parse_item_ids(lens_item_ids),
        film_item_ids=_parse_item_ids(film_item_ids),
        page=page,
        page_size=page_size,
    )


@router.get("/shooting-entries/{entry_id}", response_model=ShootingEntryRead)
def get_shooting_entry(entry_id: int, session: Session = Depends(get_session)) -> ShootingEntryRead:
    entry = crud.get_shooting_entry(session, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shooting entry not found")
    return entry


@router.post("/shooting-entries", response_model=ShootingEntryRead, status_code=status.HTTP_201_CREATED)
def create_shooting_entry(
    payload: ShootingEntryCreate,
    session: Session = Depends(get_session),
) -> ShootingEntryRead:
    try:
        return crud.create_shooting_entry(session, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/shooting-entries/{entry_id}", response_model=ShootingEntryRead)
def update_shooting_entry(
    entry_id: int,
    payload: ShootingEntryUpdate,
    session: Session = Depends(get_session),
) -> ShootingEntryRead:
    try:
        entry = crud.update_shooting_entry(session, entry_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shooting entry not found")
    return entry


@router.delete("/shooting-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shooting_entry(entry_id: int, session: Session = Depends(get_session)) -> None:
    deleted = crud.delete_shooting_entry(session, entry_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shooting entry not found")


@router.post(
    "/shooting-entries/{entry_id}/photos",
    response_model=ShootingEntryPhotoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_shooting_entry_photo(
    entry_id: int,
    request: Request,
    session: Session = Depends(get_session),
) -> ShootingEntryPhotoRead:
    try:
        form = await request.form()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Multipart form data requires python-multipart",
        ) from exc

    file = form.get("file")
    if not isinstance(file, UploadFile):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is required")

    content = await file.read()
    try:
        photo = crud.create_shooting_entry_photo(
            session=session,
            entry_id=entry_id,
            file_name=file.filename or "upload",
            content_type=file.content_type,
            content=content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shooting entry not found")
    return photo


@router.get("/shooting-entries/{entry_id}/photos", response_model=list[ShootingEntryPhotoRead])
def list_shooting_entry_photos(
    entry_id: int,
    session: Session = Depends(get_session),
) -> list[ShootingEntryPhotoRead]:
    photos = crud.list_shooting_entry_photos(session, entry_id)
    if photos is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shooting entry not found")
    return photos


@router.delete("/shooting-entry-photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shooting_entry_photo(
    photo_id: int,
    session: Session = Depends(get_session),
) -> None:
    deleted = crud.delete_shooting_entry_photo(session, photo_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shooting entry photo not found")


@router.put("/shooting-entry-photos/{photo_id}/cover", response_model=ShootingEntryPhotoRead)
def set_shooting_entry_cover_photo(
    photo_id: int,
    session: Session = Depends(get_session),
) -> ShootingEntryPhotoRead:
    photo = crud.set_shooting_entry_cover_photo(session, photo_id)
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shooting entry photo not found")
    return photo
