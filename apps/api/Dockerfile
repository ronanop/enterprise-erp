FROM python:3.13-slim

WORKDIR /app

# Avoid apt-get (Coolify hosts often hit transient Debian mirror failures).
# Install Python deps from the committed wheelhouse so Coolify builds do not
# need outbound access to pypi.org during docker build (common DinD failure).

ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    SSL_CERT_DIR=/etc/ssl/certs \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

COPY requirements-prod.txt .
COPY wheels ./wheels

RUN python -m pip install --no-cache-dir --no-index --find-links=/app/wheels \
      -r requirements-prod.txt \
    && rm -rf /app/wheels

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/v1/health' % os.environ.get('API_PORT','8000'), timeout=4)" || exit 1

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["api"]
