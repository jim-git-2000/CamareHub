import unittest

from pydantic import ValidationError
from sqlmodel import Session, SQLModel, create_engine

from app import crud
from app.models import Item
from app.schemas import TransactionCreate, TransactionUpdate


class TransactionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.item = Item(
            type="camera",
            brand="Test",
            model="Camera",
            status="owned",
            purchase_price=1000,
            current_value=800,
            currency="CNY",
        )
        self.session.add(self.item)
        self.session.commit()
        self.session.refresh(self.item)

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

    def test_transaction_crud_does_not_modify_item_fields(self) -> None:
        transaction = crud.create_transaction(
            self.session,
            self.item.id,
            TransactionCreate(type="purchase", amount=1000, currency="CNY", vendor="Store"),
        )
        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.type, "purchase")

        updated = crud.update_transaction(
            self.session,
            transaction.id,
            TransactionUpdate(type="repair", amount=120, notes="CLA service"),
        )
        self.assertIsNotNone(updated)
        self.assertEqual(updated.type, "repair")
        self.assertEqual(updated.amount, 120)

        transactions = crud.list_transactions(self.session, self.item.id)
        self.assertEqual([entry.id for entry in transactions], [transaction.id])

        item = self.session.get(Item, self.item.id)
        self.assertEqual(item.status, "owned")
        self.assertEqual(item.purchase_price, 1000)
        self.assertEqual(item.current_value, 800)

        self.assertTrue(crud.delete_transaction(self.session, transaction.id))
        self.assertEqual(crud.list_transactions(self.session, self.item.id), [])

    def test_invalid_transaction_type_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unsupported transaction type"):
            crud.create_transaction(
                self.session,
                self.item.id,
                TransactionCreate(type="unknown", amount=1, currency="CNY"),
            )

    def test_negative_amount_is_rejected_by_schema(self) -> None:
        with self.assertRaises(ValidationError):
            TransactionCreate(type="purchase", amount=-1, currency="CNY")

    def test_missing_item_and_transaction_return_not_found_result(self) -> None:
        missing = crud.create_transaction(
            self.session,
            9999,
            TransactionCreate(type="purchase", amount=1, currency="CNY"),
        )
        self.assertIsNone(missing)
        self.assertIsNone(crud.update_transaction(self.session, 9999, TransactionUpdate(notes="missing")))
        self.assertFalse(crud.delete_transaction(self.session, 9999))


if __name__ == "__main__":
    unittest.main()
