# Operations Runbook

This project is a production-shaped beta. The commands below define the minimum operating boundary before inviting users beyond local development.

## Required production controls

- Supply `JWT_SECRET`, `INGESTION_API_KEY`, database credentials, object-storage credentials and SMTP credentials through the hosting provider's secret store.
- Set `ENVIRONMENT=production`, use an HTTPS reverse proxy, and allow the API only from the deployed frontend origin.
- Keep PostgreSQL, MinIO/S3 and ClamAV on private networks. Do not publish their ports to the public internet.
- Run the API and worker as separate restartable services. Only the worker claims collector, email and document jobs.
- Treat `/ready` as the deployment readiness probe and `/health` as the liveness probe.
- Scrape `/metrics` from a private network or sidecar; it contains low-cardinality request totals, duration sums, queue depths, failed work counts and overdue-source status without user payloads.

## Queue operations

Collector requests create a durable `queued` run. The worker claims it with a lease, retries transient failures three times and records the final error in `collector_runs`. Email delivery follows the same durable outbox pattern with five attempts. A failed run or email is never reported as successful merely because the API accepted the request.

Enabled collector sources have a recurring refresh interval and source-specific minimum interval. The worker checks due schedules every 30 seconds, creates at most one active run per source and advances `next_run_at` transactionally. A successful collection also updates changed RAG chunks; unchanged posting hashes are skipped. Monitor `next_run_at`, queue age and failed runs so a running worker cannot silently stop refreshing the market sample.

## Database backup

Run a daily `pg_dump` from a private host and retain at least 7 daily and 4 weekly copies. Back up the object-storage bucket containing private evidence with versioning and a separate retention policy. A backup is not complete until a restore is tested in an isolated database and bucket.

Example PowerShell command for a local backup:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
docker compose exec -T database pg_dump -U career_signal -d career_signal -Fc > .\backups\career_signal_$(Get-Date -Format yyyyMMdd_HHmm).dump
```

## Release checklist

1. Apply Alembic migrations in staging.
2. Run backend `ruff check app tests` and `pytest`, then frontend lint and build.
3. Run the browser smoke suite against staging: registration, verification, profile creation, CV review, GitHub review, role analysis restore, save-to-tracker and status update.
4. Run the RAG retrieval evaluation and review sample warnings before publishing market claims.
5. Confirm backup freshness, worker queue health, error rate and request latency dashboards.
6. Deploy behind HTTPS and keep the previous image available for rollback.

## Incident signals

Use the structured `http.request` log event with its `request_id` to trace failures. Alert on API 5xx rate, p95 latency, worker queue age, collector failures, email outbox failures, stale market records and storage/antivirus errors.
