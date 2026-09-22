# Clinic Management frontend — Phase 1

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
- `/dashboard` contains the application shell and a neutral placeholder, gated by the development session.

Future module navigation is role-filtered but unavailable; it does not link to missing pages. Patients, Agenda, Consultations, Interventions, Soins, Ordonnances, Photothèque and Facturation are not implemented. Search, notifications and settings remain unavailable.

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

Feature folders, shared hooks and extra type modules should be introduced when they have real consumers. No empty module scaffolds or additional runtime dependencies were added. Server Components are used for route composition and static content; interactive forms, session state and the shell boundary use Client Components.

## Design references

[Clinic Management Figma](https://www.figma.com/design/Tj1jj4snH7aRgL742JNIaV/Clinic-Management)

- `00 — DESIGN SYSTEM`: semantic palette `61:35`, navigation and breadcrumb components `61:222`.
- `01 — APPLICATION`: login `4:5824` inside the requested section `59:6`; doctor shell `3:30`.
- `05 — COMPONENTS`: inspected; its Shared Components section was empty.

The shared CSS tokens follow the design-system palette; login-specific slate colors and teal controls follow the login frame. Plus Jakarta Sans is loaded by `next/font/google`. A fresh build may need network access to fetch the font. Images and icons are local files, so Figma's temporary export links are not runtime dependencies.

Desktop retains the split login and 230px sidebar / 56px header. Tablet and mobile use a single-column login and a modal navigation drawer with focus containment, Escape dismissal and scroll locking. Touch targets expand on mobile. The reference dashboard contains no breadcrumb, so Breadcrumb is prepared for future nested routes but not added there. The consultations item is prepared as requested; no icon was invented where the source shell supplied none.

Security, encryption, logging and certification wording on the login is retained from the supplied visual design. Those claims are design copy only and are **not implemented or verified** by this mock frontend; they must be reviewed against the real backend and hosting before release.

## Checks

```powershell
npm.cmd run lint
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build
```

The production build creates the login and shell routes, but does not enable demo authentication. `server/` is untouched.

Verified on 22 September 2026: ESLint, standalone TypeScript and the production build passed. Browser checks covered required fields, password visibility, loading, rejected credentials, all four demo roles, reload persistence, logout, unauthenticated redirects, mobile menu/Escape, mobile/tablet overflow and production rejection of mock credentials. A fresh browser session had no console warnings or errors after fixing explicit icon dimensions.

`next dev` also generated `AGENTS.md` and `CLAUDE.md` in this directory. These are Next.js tool-generated instructions, not application features.
