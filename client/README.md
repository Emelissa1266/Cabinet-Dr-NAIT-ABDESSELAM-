# Clinic Management frontend — Doctor & Nurse V1

Next.js 16.3.5, React 19.2.8, TypeScript, Tailwind CSS 4, npm.

## Run locally

From this directory:

```powershell
npm.cmd install
npm.cmd run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000/login. On shells without PowerShell execution restrictions, `npm` works in place of `npm.cmd`. Dependencies are already installed in the current workspace.

## Development-only login

All fictional demo accounts use the password `DemoClinic!2026`:

| Username | Role |
| --- | --- |
| `dr.gaya` | DOCTOR |
| `infirmier.demo` | NURSE |
| `secretaire.demo` | SECRETARY |
| `admin.demo` | ADMIN |

Unknown usernames and incorrect passwords produce an error. Empty fields receive validation and focus. Password visibility, pending submission, administrator assistance, logout, and session restoration are implemented.

The mock service works only with `NODE_ENV=development`. Production login rejects all attempts until a real adapter is connected. The remembered fictional profile expires after seven days; an unremembered profile uses session storage with an eight-hour expiry. No passwords or access/refresh tokens are saved. The client-side route gate and role filtering are demo behavior, **not a security boundary**.

`features/auth/services/auth-service.ts` is the replacement point for Django `POST /api/auth/login/`. The typed response contract contains `access`, `refresh`, `user`, and `role`. Backend authentication, refresh, server-side session validation and authorization will be implemented separately. There is no signup route.

## Routes

- `/` redirects to `/login`.
- `/login` implements the Figma login screen.
- `/dashboard` contains the Doctor dashboard, gated by the development session.
- `/patients` and `/patients/[id]` provide the patient list and records.
- `/agenda` provides the duration-aware calendar and appointment details.
- `/interventions` provides the surgical programme and clinical details.
- `/care` provides configurable care categories, treatment programmes and session history.
- `/prescriptions` provides prescription history, a medication editor and draft details.
- `/phototheque` provides a filterable local demo-photo grid and detail viewer.
- `/billing` provides invoice history, line items, balances and payment/invoice statuses.

All Doctor module links are enabled. Nurse V1 has dedicated routes below. Secretary and Administrator interfaces are not implemented. Doctor global search/notifications and shared settings remain unavailable.

## Frontend demonstration boundaries

The four new modules reuse the existing Figma-derived components and styles; no additional Figma calls or new design system were used. Each feature owns its types, fixtures, service adapter and interactive components. Server route components load initial data; loading routes and empty filter states are included.

Care categories and treatment programmes can be created and edited. A treatment references a patient directly, without a required consultation. Completed/remaining sessions are derived from read-only session history; the Doctor cannot execute or validate nursing sessions. New programmes and prescriptions are held in component memory and reset on a full reload or route remount. Prescription saves create demonstration drafts only.

Photo fixtures reuse the existing local images. These public assets are for demonstration only: real medical images must use authenticated metadata and private media URLs via `features/phototheque/services/photo-service.ts`. There are no sharing controls or cloud uploads.

Billing is read-only. Draft invoices are excluded from issued/paid/outstanding summary totals. Payment processing, invoice generation, prescription printing/PDF, backend persistence and Django are deliberately not implemented.

## Structure and components

```text
app/
  (auth)/login/page.tsx
  (dashboard)/layout.tsx
  (dashboard)/dashboard/page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  ui/                   Button, Input
  shared/               ClinicBrand, Icon
  layout/               ApplicationShell, Sidebar, Header, MainContent,
                        PageHeader, Breadcrumb, NavigationItem, UserProfile
features/auth/
  components/           AuthProvider, LoginForm
  services/             AuthService adapter, mock service, demo session storage
  types.ts              Credentials, response, user, role, session contracts
lib/navigation.ts       Typed role-based navigation
public/icons/           Exact exported Figma SVG assets
public/images/          Exact exported Figma reception and profile images
```

Feature folders now include `auth`, `doctor-dashboard`, `patients`, `agenda`, `interventions`, `care`, `prescriptions`, `phototheque` and `billing`. Shared UI includes DetailDialog, StatusBadge, ModuleSummary, ModuleLoading and scoped clinical styles. No additional runtime dependencies were added. Server Components compose routes; interactive forms and filters use Client Components.

## Design references

[Clinic Management Figma](https://www.figma.com/design/Tj1jj4snH7aRgL742JNIaV/Clinic-Management)

- `00 — DESIGN SYSTEM`: semantic palette `61:35`, navigation and breadcrumb components `61:222`.
- `01 — APPLICATION`: login `4:5824` inside the requested section `59:6`; doctor shell `3:30`.
- `05 — COMPONENTS`: inspected; its Shared Components section was empty.

The shared CSS tokens follow the design-system palette; login-specific slate colors and teal controls follow the login frame. Plus Jakarta Sans is loaded by `next/font/google`. A fresh build may need network access to fetch the font. Images and icons are local files, so Figma's temporary export links are not runtime dependencies.

Desktop retains the split login and 230px sidebar / 56px header. Tablet and mobile use a single-column login and a modal navigation drawer with focus containment, Escape dismissal and scroll locking. Tables scroll horizontally on smaller screens. Patient records reuse the shared breadcrumb. The eight Doctor navigation entries follow the implemented shell.

Security, encryption, logging and certification wording on the login is retained from the supplied visual design. Those claims are design copy only and are **not implemented or verified** by this mock frontend; they must be reviewed against the real backend and hosting before release.

## Checks

```powershell
npm.cmd run lint
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build
```

The production build includes all Doctor V1 routes, but does not enable demo authentication. `server/` is untouched.

Verified on 22 September 2026: ESLint, standalone TypeScript and the production build passed. Browser checks covered required fields, password visibility, loading, rejected credentials, all four demo roles, reload persistence, logout, unauthenticated redirects, mobile menu/Escape, mobile/tablet overflow and production rejection of mock credentials. A fresh browser session had no console warnings or errors after fixing explicit icon dimensions.

Doctor V1 continuation verified on 24 September 2026: TypeScript checks for each new module, full ESLint and production build passed. Browser checks covered care category creation/editing, treatment creation/editing and completion validation, prescription medication addition/removal and draft saving, photo viewing/filtering, invoice balances/status filters, empty states and tablet overflow. Recent development logs showed no new browser errors or warnings. The existing development server intermittently reported a Google Fonts fetch warning; the production build succeeded. No backend files or dependencies changed.

`next dev` also generated `AGENTS.md` and `CLAUDE.md` in this directory. These are Next.js tool-generated instructions, not application features.

## Nurse V1

Implemented from the supplied Nurse screenshot, without Figma MCP or new dependencies. Sign in as `infirmier.demo` with the development password above; the shell redirects to `/nurse/dashboard`.

- `/nurse/dashboard`: assigned daily care, summary and shared execution panel.
- `/nurse/agenda`: date navigation, day/week lists, search, status filters, selected-care details. Concurrent appointments use separate columns with local horizontal scrolling.
- `/nurse/care`: care/category filters, start, draft, actual laser parameters, tolerance, reactions, observations, local incident reports and combined completion/validation.
- `/nurse/patients` and `/nurse/patients/[id]`: search, essential clinical information, prescribed protocols, nursing history, relevant interventions and photo links.
- `/nurse/phototheque`: patient/category/before-after filters, comparison and a read-only photo viewer using existing local demo assets.

`features/nurse/data` contains fixtures; `types` contains contracts; `services` contains the replaceable data adapter, session transitions and agenda collision grouping; `components` contains the Nurse UI. The existing shell and shared dialogs, badges, icons and loading states are reused. Authentication and Doctor feature files are unchanged.

A provider shared by Nurse routes keeps saved drafts and session updates during client navigation. Reloading or signing out resets the mock data. Validation checks required execution fields, laser values and adverse-reaction notes. A completed session is locked and counted once; prescribed protocols remain unchanged. Reports are local records, not messages sent to a doctor. The demo planning date is 21 September 2026; overlapping appointments are also available on 25 September.

Role redirects and assignment checks are frontend demonstrations, not server authorization. A future Supabase/API adapter must enforce authenticated access, assignments, private photo delivery and durable, atomic validation. No backend, database, cloud storage or outbound communication was added.

Regression checks: `node --test features/nurse/services/session-state.test.mjs`.