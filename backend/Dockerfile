FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
COPY evaluation ./evaluation
COPY alembic.ini ./
COPY migrations ./migrations
RUN pip install --no-cache-dir .
RUN useradd --create-home appuser \
    && mkdir -p /home/appuser/.cache/fastembed \
    && chown -R appuser:appuser /home/appuser/.cache
USER appuser
EXPOSE 8000
CMD ["python", "-m", "app.api_server"]
