import unittest

from sqlmodel import Session, SQLModel, create_engine

from app import crud
from app.models import Item, ShootingEntry


class ListScalingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.session.add_all(
            Item(type="accessory", brand="Scale", model=f"Item {index:03d}")
            for index in range(250)
        )
        self.session.add_all(ShootingEntry(title=f"Entry {index:03d}") for index in range(250))
        self.session.commit()

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

    def test_item_pages_have_no_duplicates_or_gaps(self) -> None:
        found_ids: list[int] = []
        for page in range(1, 12):
            items, total = crud.list_items(self.session, sort="model", page=page, page_size=24)
            found_ids.extend(item.id for item in items)
        self.assertEqual(total, 250)
        self.assertEqual(len(found_ids), 250)
        self.assertEqual(len(set(found_ids)), 250)

    def test_shooting_entry_pages_include_records_after_one_hundred(self) -> None:
        found_ids: list[int] = []
        for page in range(1, 12):
            response = crud.list_shooting_entries(self.session, page=page, page_size=24)
            found_ids.extend(entry.id for entry in response.items)
        self.assertEqual(response.total, 250)
        self.assertEqual(len(found_ids), 250)
        self.assertEqual(len(set(found_ids)), 250)


if __name__ == "__main__":
    unittest.main()
