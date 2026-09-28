# Clinic Management API

Django REST backend for the Clinic Management project.

## Prerequisites

- Python 3.12 or newer
- PostgreSQL 15+ or Supabase PostgreSQL
- The existing Next.js frontend in `../client`

## Setup

From the `server` directory:

```powershell
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements/development.txt
```

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Fill in `DJANGO_SECRET_KEY`, `DATABASE_URL` or the `DB_*` values, and the CORS origins for the frontend.

## Database

Use `DATABASE_URL` for Supabase PostgreSQL when available:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DB_SSL_REQUIRE=True
```

For local bootstrapping without database credentials, development settings fall back to `db.sqlite3`. Production must use PostgreSQL.

## Migrations

```powershell
python manage.py migrate
```

## Admin User

```powershell
python manage.py createsuperuser
```

## Development Server

```powershell
python manage.py runserver
```

The API health endpoint is available at:

```text
GET http://127.0.0.1:8000/api/v1/health/
```

Expected response:

```json
{
  "status": "ok",
  "service": "clinic-management-api"
}
```

## API Documentation

- Swagger UI: `http://127.0.0.1:8000/api/docs/`
- OpenAPI schema: `http://127.0.0.1:8000/api/schema/`

## JWT

Phase 1 configures JWT support and exposes the initial token endpoints:

- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`
- `POST /api/v1/auth/logout/`
- `GET /api/v1/auth/me/`

The login response includes JWT tokens and the authenticated user's role/profile details.

## Patients

Phase 2 exposes the patient API:

- `GET /api/v1/patients/`
- `POST /api/v1/patients/`
- `GET /api/v1/patients/{id}/`
- `PATCH /api/v1/patients/{id}/`
- `DELETE /api/v1/patients/{id}/`

Supported query features include `search`, filtering, ordering, and page-number pagination.

Patient references are generated automatically in the `P-00001` format. Clinical related information is modeled separately from administrative identity data.

## Checks And Tests

```powershell
python manage.py check
python manage.py test
```

The backend currently contains the foundation, accounts/roles, patients, patient medical-info structure, and patient audit preparation. Care, billing, agenda, documents, seed data, and later business-rule tests are intentionally deferred to later phases.
