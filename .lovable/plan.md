## What I found

The failed request is `POST https://softphone.voicehost.io/api/auth/login` returning **502 Bad Gateway**. That usually means nginx cannot get a valid response from the self-hosted Express API on `127.0.0.1:3000`, or the API crashes/throws during login.

The last self-host migration did **not** delete login data: it only adds branding/booking columns and modifies the `card_events.event_type` enum. The login path still reads from `users` and `user_roles`.

## Most likely causes

1. The backend service is down or failed to restart after the migration/build.
2. The migration partially failed because it re-adds columns without `IF NOT EXISTS`; rerunning it can error and leave deployment steps incomplete.
3. Login is throwing while querying `users` or `user_roles`, and nginx surfaces it as a 502 if the service crashes or times out.
4. The deployed frontend/backend path is misaligned, but the 502 specifically points at the backend proxy/service.

## Fix plan

1. Add a safe follow-up self-host migration that is idempotent, so reruns do not fail on already-added columns and the `card_events` enum is corrected without touching data.
2. Harden the self-host login route so database/auth errors are returned as JSON 500s instead of potentially killing the request path.
3. Add a lightweight CLI verification checklist/commands for your VPS:
   - service status
   - last backend logs
   - direct localhost healthcheck
   - direct login endpoint smoke test
4. If the issue is caused by `user_roles` missing or malformed, add a repair SQL snippet that recreates only the admin role row without deleting existing users.

## Technical details

Files I expect to touch after approval:

- `selfhost/migrations/...sql` — add a safe repair/idempotent migration for the branding/booking schema.
- `selfhost/src/routes/auth.ts` — wrap login DB/auth work in a guarded `try/catch` and log a clear server-side error.

No data-deleting SQL will be used.