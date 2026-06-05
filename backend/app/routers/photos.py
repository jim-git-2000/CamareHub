from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session
from starlette.datastructures import UploadFile

from app import crud
from app.database import get_session
from app.schemas import PhotoRead


router = APIRouter(tags=["photos"])


@router.post(
    "/items/{item_id}/photos",
    response_model=PhotoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_photo(
    item_id: int,
    request: Request,
    session: Session = Depends(get_session),
) -> PhotoRead:
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
        photo = crud.create_photo(
            session=session,
            item_id=item_id,
            file_name=file.filename or "upload",
            content_type=file.content_type,
            content=content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return photo


@router.get("/items/{item_id}/photos", response_model=list[PhotoRead])
def list_photos(
    item_id: int,
    session: Session = Depends(get_session),
) -> list[PhotoRead]:
    photos = crud.list_photos(session, item_id)
    if photos is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return photos


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    photo_id: int,
    session: Session = Depends(get_session),
) -> None:
    deleted = crud.delete_photo(session, photo_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
