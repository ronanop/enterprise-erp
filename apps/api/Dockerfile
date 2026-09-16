FROM python:3.13-slim

WORKDIR /app

# python:3.13-slim already ships ca-certificates; avoid apt-get during Coolify
# builds (transient deb.debian.org failures → apt exit 100).

# Cert paths must be set before pip (Coolify may inject empty SSL/proxy ARGs).
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    SSL_CERT_DIR=/etc/ssl/certs \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_ROOT_USER_ACTION=ignore

COPY requirements-prod.txt .

# Coolify injects many ARG/env values into RUN (DATABASE_URL, proxies, etc.).
# An empty HTTP(S)_PROXY / SSL_* from build-args can break pip; isolate install.
RUN set -eu; \
    echo "PyPI connectivity check..."; \
    env -i \
      HOME="/root" \
      PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin" \
      LANG="C.UTF-8" \
      SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt" \
      REQUESTS_CA_BUNDLE="/etc/ssl/certs/ca-certificates.crt" \
      SSL_CERT_DIR="/etc/ssl/certs" \
      python -c "import urllib.request; urllib.request.urlopen('https://pypi.org/simple/pip/', timeout=45); print('pypi ok')"; \
    env -i \
      HOME="/root" \
      PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin" \
      LANG="C.UTF-8" \
      SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt" \
      REQUESTS_CA_BUNDLE="/etc/ssl/certs/ca-certificates.crt" \
      SSL_CERT_DIR="/etc/ssl/certs" \
      PIP_DISABLE_PIP_VERSION_CHECK="1" \
      PIP_DEFAULT_TIMEOUT="120" \
      PIP_ROOT_USER_ACTION="ignore" \
      python -m pip install --no-cache-dir --prefer-binary \
        --retries 10 \
        --trusted-host pypi.org \
        --trusted-host pypi.python.org \
        --trusted-host files.pythonhosted.org \
        -r requirements-prod.txt \
    || { \
      echo "===== pip install failed; retrying verbose ====="; \
      env -i \
        HOME="/root" \
        PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin" \
        LANG="C.UTF-8" \
        SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt" \
        REQUESTS_CA_BUNDLE="/etc/ssl/certs/ca-certificates.crt" \
        SSL_CERT_DIR="/etc/ssl/certs" \
        PIP_DISABLE_PIP_VERSION_CHECK="1" \
        PIP_DEFAULT_TIMEOUT="120" \
        PIP_ROOT_USER_ACTION="ignore" \
        python -m pip install -v --no-cache-dir --prefer-binary \
          --retries 3 \
          --trusted-host pypi.org \
          --trusted-host files.pythonhosted.org \
          -r requirements-prod.txt; \
      exit 1; \
    }

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
