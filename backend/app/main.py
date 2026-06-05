from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.database import PROJECT_ROOT, check_database_connection, create_db_and_tables
from app.routers import health, items, photos, stats, transactions


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    check_database_connection()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

upload_dir = Path(settings.upload_dir)
if not upload_dir.is_absolute():
    upload_dir = PROJECT_ROOT / upload_dir
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(photos.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
