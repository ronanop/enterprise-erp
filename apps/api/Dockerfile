FROM python:3.13-slim

WORKDIR /app

# python:3.13-slim already ships ca-certificates; avoid apt-get during Coolify
# builds (transient deb.debian.org failures → apt exit 100).

COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY src ./src
COPY scripts ./scripts
COPY mcp-server ./mcp-server
COPY docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh \
    && mkdir -p \
      /app/var/crm-attachments \
      /app/var/asset-storage \
      /app/var/ess-documents \
      /app/var/project-trackers \
      /app/var/marketing-deliverables

ENV PYTHONPATH=/app/src
ENV API_HOST=0.0.0.0
ENV API_PORT=8000
ENV OBJECT_STORAGE_BACKEND=s3
ENV ASSET_STORAGE_BACKEND=s3
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_DIR=/etc/ssl/certs

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/v1/health' % os.environ.get('API_PORT','8000'), timeout=4)" || exit 1

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["api"]
