FROM python:3.12-slim

WORKDIR /app

ENV APP_NAME=CameraHub \
    DATABASE_URL=sqlite:////app/data/gear.db \
    UPLOAD_DIR=/app/uploads \
    BACKUP_DIR=/app/backups \
    BACKEND_CORS_ORIGINS=http://localhost:3010,http://127.0.0.1:3010 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-cache --no-dev

COPY backend/app/ ./app/

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
