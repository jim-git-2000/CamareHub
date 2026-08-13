import unittest
from datetime import date, datetime, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from app import crud
from app.models import Camera, Film, Item, Lens
from app.models import Photo


class ItemListingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)

        self._add_item("camera", "New camera", date(2026, 6, 1), camera_type="微单", mount="X")
        self._add_item("camera", "Old camera", date(2024, 1, 1), camera_type="旁轴", mount="X")
        self._add_item("lens", "Lens with date", date(2025, 5, 1), mount="Leica M")
        self._add_item("lens", "Lens without date", None, mount=" Leica M ")
        self._add_item("accessory", "Accessory", date(2026, 2, 1))
        self._add_item("film", "Film", date(2026, 3, 1), quantity=2)

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

    def _add_item(
        self,
        item_type: str,
        model: str,
        purchase_date: date | None,
        *,
        camera_type: str | None = None,
        mount: str | None = None,
        quantity: int | None = None,
    ) -> None:
        created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        item = Item(
            type=item_type,
            brand="Test",
            model=model,
            purchase_date=purchase_date,
            current_value=100,
            created_at=created_at,
            updated_at=created_at,
        )
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)

        if item_type == "camera":
            self.session.add(Camera(item_id=item.id, camera_type=camera_type, mount=mount))
        elif item_type == "lens":
            self.session.add(Lens(item_id=item.id, mount=mount))
        elif item_type == "film":
            self.session.add(Film(item_id=item.id, quantity=quantity))
        self.session.commit()

    def test_catalog_sort_groups_types_and_dates(self) -> None:
        items, _ = crud.list_items(self.session, sort="catalog", page_size=100)

        self.assertEqual(
            [item.model for item in items],
            ["New camera", "Old camera", "Lens with date", "Lens without date", "Accessory", "Film"],
        )

    def test_lens_mount_filter_does_not_return_cameras(self) -> None:
        items, _ = crud.list_items(self.session, item_type="lens", mount="Leica M", page_size=100)

        self.assertEqual({item.model for item in items}, {"Lens with date", "Lens without date"})
        self.assertTrue(all(item.type == "lens" for item in items))

    def test_camera_type_filter_matches_any_trimmed_field_value(self) -> None:
        items, _ = crud.list_items(self.session, item_type="camera", camera_type=" 微单 ", page_size=100)

        self.assertEqual({item.model for item in items}, {"New camera"})

    def test_camera_type_filter_does_not_map_unrelated_values(self) -> None:
        items, _ = crud.list_items(self.session, item_type="camera", camera_type="旁轴", page_size=100)
        unmatched_items, _ = crud.list_items(self.session, item_type="camera", camera_type="mirrorless", page_size=100)

        self.assertEqual({item.model for item in items}, {"Old camera"})
        self.assertEqual(unmatched_items, [])

    def test_item_facets_are_trimmed_and_dynamic(self) -> None:
        facets = crud.item_facets(self.session)

        self.assertEqual(facets["brands"], ["Test"])
        self.assertEqual(facets["lens_mounts"], ["Leica M"])
        self.assertEqual(set(facets["camera_types"]), {"微单", "旁轴"})

    def test_item_list_includes_cover_without_generating_files(self) -> None:
        item = self.session.exec(select(Item).where(Item.model == "New camera")).one()
        self.session.add(Photo(item_id=item.id, file_path="uploads/camera/original.jpg", file_name="original.jpg"))
        self.session.commit()

        items, _ = crud.list_items(self.session, keyword="New camera", page_size=10)

        self.assertEqual(items[0].cover_photo.url, "/uploads/camera/original.jpg")
        self.assertEqual(items[0].cover_photo.thumbnail_url, "/uploads/camera/original.jpg")
