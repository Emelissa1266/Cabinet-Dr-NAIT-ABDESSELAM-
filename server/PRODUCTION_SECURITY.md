# Production Security Readiness

This project is not deployed by this checklist. It documents the controls that
must be verified by the deployment owner before production traffic is allowed.

## Required Environment

- Use `DJANGO_SETTINGS_MODULE=config.settings.production`.
- Provide a real `DJANGO_SECRET_KEY`; never reuse the development template value.
- Set explicit `DJANGO_ALLOWED_HOSTS`. Do not use `*`, `localhost`, or loopback hosts.
- Set only approved HTTPS origins in `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.
- Keep `AUTH_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`, and HTTPS-only traffic.
- Configure `RATE_LIMIT_REDIS_URL` with `django-redis` installed, or another shared cache
  backend reviewed for multi-worker rate limiting.
- Keep `PRIVATE_MEDIA_ROOT` outside public static roots and outside the Next.js `public/`
  directory.

## HTTPS And Reverse Proxy

- Terminate TLS at a trusted reverse proxy or load balancer.
- Strip incoming `X-Forwarded-*` headers from clients before setting trusted values.
- Enable `DJANGO_SECURE_PROXY_SSL_HEADER=True` only when the backend is reachable only
  from trusted proxy IPs listed in `TRUSTED_PROXY_IPS`.
- Restrict direct public access to the Django backend port.
- Preserve `Secure`, `HttpOnly`, and `SameSite` cookie attributes end to end.
- WebSockets are not currently used; add explicit proxy rules before introducing them.

## HSTS Rollout

- Start with HTTPS redirect and `DJANGO_SECURE_HSTS_SECONDS=31536000`.
- Enable `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True` only after every subdomain is HTTPS-ready.
- Keep `DJANGO_SECURE_HSTS_PRELOAD=False` until domain ownership, subdomain coverage,
  preload consequences, and rollback limitations are formally accepted.

## Private Files And Uploads

- Private documents and clinical photos must be served only by authenticated Django views.
- Do not expose `PRIVATE_MEDIA_ROOT` through Nginx, Apache, CDN, object-store public
  buckets, or Next.js `public/`.
- Current validation checks size, extension, signature-derived MIME type, image integrity,
  randomized storage keys, and path-safe filenames.
- Antivirus or malware scanning is not implemented. Add an asynchronous scanner before
  accepting higher-risk file types or external bulk imports.

## Backups And Recovery

- Back up PostgreSQL, private documents, clinical photos, generated financial documents,
  and the exact configuration needed to restore them.
- Encrypt backups at rest and in transit; restrict restore privileges.
- Keep offsite copies and separate access from normal application operators.
- Test restores on sanitized data at a regular cadence.
- Choose RTO and RPO with clinic approval. A starting proposal is daily full backups,
  frequent WAL/archive backups for PostgreSQL, and restore testing at least quarterly.
- Database and private media backups must be point-in-time consistent.

## Deployment Checklist

- Production settings import succeeds only with safe placeholder-free values.
- `python manage.py check --deploy` has been reviewed; warnings are classified.
- Redis/shared rate limiter is reachable and verified under concurrency.
- PostgreSQL TLS, least-privilege credentials, backups, and monitoring are verified.
- API docs are restricted to authenticated ADMIN users.
- Error logs do not include secrets, tokens, patient records, or file contents.
- Static assets may be cached; authenticated API, documents, photos, invoices, and PDFs
  must remain `no-store`.
- Dependency advisories are reviewed before each release. Current production npm audit
  is clean; known remaining npm advisories are development-tooling only.
