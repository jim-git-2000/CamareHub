from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app import crud
from app.database import get_session
from app.schemas import ItemCreate, ItemListResponse, ItemRead, ItemUpdate


router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=ItemListResponse)
def list_items(
    type: str | None = None,
    brand: str | None = None,
    status: str | None = None,
    mount: str | None = None,
    keyword: str | None = None,
    sort: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> ItemListResponse:
    items, total = crud.list_items(
        session=session,
        item_type=type,
        brand=brand,
        status=status,
        mount=mount,
        keyword=keyword,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return ItemListResponse(items=items, page=page, page_size=page_size, total=total)


@router.get("/{item_id}", response_model=ItemRead)
def get_item(item_id: int, session: Session = Depends(get_session)) -> ItemRead:
    item = crud.get_item(session, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.post("", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate, session: Session = Depends(get_session)) -> ItemRead:
    try:
        return crud.create_item(session, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{item_id}", response_model=ItemRead)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    session: Session = Depends(get_session),
) -> ItemRead:
    try:
        item = crud.update_item(session, item_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, session: Session = Depends(get_session)) -> None:
    deleted = crud.delete_item(session, item_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
