FROM python:3.13-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY src ./src
COPY docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV PYTHONPATH=/app/src
ENV API_HOST=0.0.0.0
ENV API_PORT=8000

RUN mkdir -p /app/var/crm-attachments

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -sf "http://127.0.0.1:${API_PORT}/api/v1/health" || exit 1

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["api"]
