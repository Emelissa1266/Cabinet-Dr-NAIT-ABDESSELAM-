# Clinic Management API

Django REST Framework backend for the Clinic Management project.

## Requirements

- Python 3.13 compatible environment
- PostgreSQL for development and production validation
- `server/.env` created from `server/.env.example`

## Setup

```powershell
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements/development.txt
Copy-Item .env.example .env
```

Generate a local `DJANGO_SECRET_KEY` in `.env` and keep the PostgreSQL `DATABASE_URL` pointed at the intended development database. Do not commit `.env`.

## Database

The expected local development URL is:

```env
DATABASE_URL=postgresql://clinic_user:clinic_dev_password@127.0.0.1:5432/clinic_db
DB_SSL_REQUIRE=False
```

Run migrations:

```powershell
python manage.py migrate
python manage.py showmigrations
```

## Development Users

For reproducible local authenticated testing:

```powershell
$env:CLINIC_DEV_USER_PASSWORD="choose-a-local-password"
python manage.py seed_dev_users
```

This command:

- refuses to run when `DEBUG=False`
- refuses SQLite
- creates or updates `admin.demo`, `doctor.demo`, `nurse.demo`, and `secretary.demo`
- requires the password through `CLINIC_DEV_USER_PASSWORD` or `--password`
- does not print the password

## Run

```powershell
python manage.py runserver
```

Useful development endpoints:

- `GET /api/v1/health/`
- `GET /api/schema/`
- `GET /api/docs/`

JWT endpoints:

- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`
- `POST /api/v1/auth/logout/`
- `GET /api/v1/auth/me/`

## Validation

Run against PostgreSQL:

```powershell
python manage.py check
python manage.py check --deploy
python manage.py makemigrations --check --dry-run
python -m ruff check .
python -m pytest
```

`check --deploy` may report deployment-environment requirements such as TLS, proxy, HSTS, production hostnames, cookie security, and non-development secrets. Do not weaken development settings to silence production-only warnings.

## Security Notes

- PostgreSQL is the authoritative development baseline.
- Private documents and clinical photos are served through authenticated endpoints, not public media URLs.
- API abuse protection uses Django/DRF throttling with configurable fixed-window policies:
  - login IP: `RATE_LIMIT_AUTH_LOGIN_IP` (default `10/min`)
  - login account failures: `RATE_LIMIT_AUTH_LOGIN_ACCOUNT` (default `5/5min`)
  - refresh: `RATE_LIMIT_AUTH_REFRESH`
  - CSRF bootstrap/session endpoints: `RATE_LIMIT_AUTH_CSRF`, `RATE_LIMIT_AUTH_SESSION`
  - authenticated API, sensitive writes, searches, uploads, downloads, PDFs:
    `RATE_LIMIT_API_GENERAL`, `RATE_LIMIT_SENSITIVE_WRITE`, `RATE_LIMIT_EXPENSIVE_SEARCH`,
    `RATE_LIMIT_FILE_UPLOAD`, `RATE_LIMIT_PRIVATE_DOWNLOAD`, `RATE_LIMIT_PDF_GENERATION`
- Local development uses Django's local-memory cache. Multi-worker production must configure
  a shared cache through `RATE_LIMIT_CACHE_ALIAS` or `RATE_LIMIT_REDIS_URL` with `django-redis`
  installed. Production settings require shared cache for critical auth limits unless explicitly
  overridden with `RATE_LIMIT_REQUIRE_SHARED_CACHE=False` during an operational recovery. DRF/cache
  throttles are lightweight fixed-window controls, not a complete DDoS defense; strict edge
  enforcement should be handled by the reverse proxy, WAF, or API gateway.
- Client IPs come from `REMOTE_ADDR` by default. Forwarded headers are accepted only when
  `REMOTE_ADDR` is listed in `TRUSTED_PROXY_IPS`; otherwise `X-Forwarded-For` and similar
  headers are ignored to prevent spoofing.
- Production must provide real secrets, TLS termination, backups, monitoring, email/SMS providers as needed, and regulatory/operational review.
