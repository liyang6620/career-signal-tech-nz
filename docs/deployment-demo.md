# Free portfolio deployment

This runbook deploys CareerSignal as a controlled interview demonstration. It is not the unrestricted production topology described in `docs/architecture.md`.

## Topology

- Cloudflare Pages: React/PWA frontend
- Render Free service `careersignal-api`: FastAPI, Alembic migrations and the background worker in one demo container
- Supabase Free project: PostgreSQL/pgvector and a private S3-compatible bucket
- Resend Free: SMTP delivery

Current public endpoints:

```text
Frontend: https://career-signal-tech-nz.pages.dev
API: https://careersignal-api-ze3r.onrender.com
```

Keep every CareerSignal resource separate from the football project. Never reuse its database, service, bucket, connection string or secret. Both Render services share the workspace's monthly free-instance-hour pool. Free services do not consume instance hours while spun down, so do not configure uptime monitors or keep-alive requests.

## Demo security boundary

Set `MALWARE_SCAN_MODE=trusted_demo` only while uploads are restricted to CVs controlled by the repository owner. The worker still enforces the supported PDF/DOCX content types, file signatures and the configured size limit, but it does not call ClamAV. Do not enable unrestricted public uploads with this setting.

Use a redacted CV without a home address, private phone number, referee details or other unnecessary personal data. A production deployment must use `MALWARE_SCAN_MODE=clamav` and an isolated scanner.

## Supabase

1. Create a separate free project and enable the `vector` extension.
2. Apply `alembic upgrade head` through the API deployment command.
3. Create a private bucket named `career-signal-private`.
4. Create S3 access credentials for that bucket and configure its CORS policy to allow `PUT` from the final Cloudflare Pages origin.
5. Use the transaction-pooler PostgreSQL URL with the `postgresql+psycopg://` SQLAlchemy scheme. URL-encode special characters in the password.

Supabase S3 endpoints follow this form:

```text
https://<project-ref>.storage.supabase.co/storage/v1/s3
```

## Render service

Create a Blueprint from the repository's `render.yaml`. It builds `backend/Dockerfile.demo`, which starts the worker beside the API in one free web service. This is appropriate for an interview demo because both processes sleep together; production should separate their scaling and lifecycle.

Configure the unsynchronised secrets requested by the Blueprint:

```text
ENVIRONMENT=production
DATABASE_URL=postgresql+psycopg://...
JWT_SECRET=<at-least-32-random-bytes>
INGESTION_API_KEY=<independent-random-secret>
EMBEDDING_MODE=hash
MALWARE_SCAN_MODE=trusted_demo
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=<Resend-API-key>
SMTP_FROM_EMAIL=<verified-sender>
SMTP_USE_TLS=true
STORAGE_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
STORAGE_PUBLIC_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
STORAGE_REGION=<Supabase-project-region>
STORAGE_BUCKET=career-signal-private
STORAGE_MANAGE_CORS=false
STORAGE_ACCESS_KEY=<Supabase-S3-access-key>
STORAGE_SECRET_KEY=<Supabase-S3-secret-key>
```

The service also needs the final origins after the two public URLs exist:

```text
CORS_ORIGINS=https://<pages-project>.pages.dev
FRONTEND_URL=https://<pages-project>.pages.dev
```

## Cloudflare Pages

Connect the GitHub repository with:

```text
Root directory: frontend
Build command: npm run build
Build output directory: dist
Environment variable: VITE_API_URL=https://<render-api-host>
```

Cloudflare Pages serves the Vite SPA's clean client-side routes directly. HTTPS enables the PWA installation prompt and service worker.

## Verification

After deployment:

1. Confirm `/health` and `/ready` return HTTP 200.
2. Create and verify the owner demo account through Resend.
3. Upload only the redacted demonstration CV and confirm it reaches evidence review.
4. Exercise GitHub analysis, role decoding, profile, pathways and the application tracker.
5. Install the PWA and verify an offline public-shell reload.
6. Confirm no secret appears in the frontend bundle, repository, build log or browser storage.

Resend's free plan currently includes 3,000 transactional emails per month and 100 per day. Without a verified custom domain, use Resend's test sender only for the email address that owns the Resend account. Keep public self-registration disabled in practice by sharing only the pre-verified owner demo account until a sending domain is configured.
