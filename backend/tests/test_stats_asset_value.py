import unittest

from sqlmodel import Session, SQLModel, create_engine

from app.models import Film, Item
from app.routers import stats


class StatsAssetValueTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self._add_item("camera", "Camera", "Brand A", 1000)
        owned_film = self._add_item("film", "Film", "Brand A", 50)
        sold_film = self._add_item("film", "Sold film", "Brand B", 80, status="sold")
        empty_quantity_film = self._add_item("film", "Empty film", "Brand B", 60)
        self.session.add(Film(item_id=owned_film.id, quantity=3))
        self.session.add(Film(item_id=sold_film.id, quantity=4))
        self.session.add(Film(item_id=empty_quantity_film.id, quantity=None))
        self.session.commit()

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

    def _add_item(self, item_type: str, model: str, brand: str, current_value: float, status: str = "owned") -> Item:
        item = Item(type=item_type, brand=brand, model=model, current_value=current_value, status=status)
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return item

    def test_stats_count_film_value_per_roll(self) -> None:
        summary = stats.summary(self.session)
        by_brand = {bucket.key: bucket.total_value for bucket in stats.by_brand(self.session)}
        by_type = {bucket.key: bucket.total_value for bucket in stats.by_type(self.session)}

        self.assertEqual(summary.total_value, 1150)
        self.assertEqual(by_brand["Brand A"], 1150)
        self.assertEqual(by_brand["Brand B"], 0)
        self.assertEqual(by_type["camera"], 1000)
        self.assertEqual(by_type["film"], 150)
        self.assertEqual(sum(by_brand.values()), summary.total_value)
        self.assertEqual(sum(by_type.values()), summary.total_value)
