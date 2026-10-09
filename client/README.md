# Clinic Management Frontend

Next.js 16, React 19, TypeScript, and the real Django API.

## Environment

Create `client/.env.local` when the API is not using the default local URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

Do not put JWTs, passwords, or production secrets in frontend environment files.

## Run

```powershell
npm install
npm run dev -- --hostname 0.0.0.0
```

Open `http://localhost:3000/login`.

## Authentication

The frontend uses real JWT endpoints:

- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`
- `POST /api/v1/auth/logout/`
- `GET /api/v1/auth/me/`

For local authenticated E2E accounts, seed backend development users from `server/`:

```powershell
$env:CLINIC_DEV_USER_PASSWORD="choose-a-local-password"
python manage.py seed_dev_users
```

The command is development-only, must be run manually, and does not print the password.

## Active Routes

- `/login`
- `/admin`, `/admin/users`, `/admin/care`, `/admin/agenda`, `/admin/surgery`, `/admin/billing`, `/admin/documents`
- `/dashboard`, `/patients`, `/patients/[id]`, `/agenda`, `/care`, `/interventions`, `/prescriptions`, `/phototheque`, `/billing`
- `/nurse/dashboard`, `/nurse/patients`, `/nurse/patients/[id]`, `/nurse/agenda`, `/nurse/care`, `/nurse/phototheque`, `/nurse/billing`
- `/secretary/dashboard`, `/secretary/patients`, `/secretary/patients/[id]`, `/secretary/agenda`, `/secretary/billing`

Route visibility is user-experience guidance only. Backend RBAC is authoritative.

## Validation

```powershell
npx tsc --noEmit
npm run lint
npm test
npm run build
```

`npm test` runs the stable Node regression tests:

- `features/clinic/services/workflows.test.mjs`
- `features/nurse/services/session-state.test.mjs`

Legacy fixture modules may remain for these tests or dormant historical components, but active production routes must use the authenticated API and must not fall back to mock clinical or financial data.
