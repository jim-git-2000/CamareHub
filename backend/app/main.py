from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import check_database_connection, create_db_and_tables
from app.core.config import settings
from app.routers import health


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    check_database_connection()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
