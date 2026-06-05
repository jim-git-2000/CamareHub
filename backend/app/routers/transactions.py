from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app import crud
from app.database import get_session
from app.schemas import TransactionCreate, TransactionRead, TransactionUpdate


router = APIRouter(tags=["transactions"])


@router.get("/items/{item_id}/transactions", response_model=list[TransactionRead])
def list_transactions(
    item_id: int,
    session: Session = Depends(get_session),
) -> list[TransactionRead]:
    transactions = crud.list_transactions(session, item_id)
    if transactions is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return transactions


@router.post(
    "/items/{item_id}/transactions",
    response_model=TransactionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    item_id: int,
    payload: TransactionCreate,
    session: Session = Depends(get_session),
) -> TransactionRead:
    try:
        transaction = crud.create_transaction(session, item_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return transaction


@router.put("/transactions/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    session: Session = Depends(get_session),
) -> TransactionRead:
    try:
        transaction = crud.update_transaction(session, transaction_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return transaction


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    session: Session = Depends(get_session),
) -> None:
    deleted = crud.delete_transaction(session, transaction_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
