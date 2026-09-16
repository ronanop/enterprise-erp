# Offline Linux/manylinux wheels for Coolify API image builds.
# Regenerate when requirements-prod.txt changes:
#
#   docker run --rm -v "$PWD:/work" -w /work python:3.13-slim \
#     bash -c 'pip install -q -U pip && pip download --prefer-binary -r requirements-prod.txt -d wheels'
