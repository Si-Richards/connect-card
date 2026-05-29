## Diagnosis

The upload itself is likely succeeding, but the employee form is failing validation before save.

The current code has two conflicting behaviours:

- The self-hosted API returns uploaded files as a relative path: `/uploads/<file>`.
- The frontend now converts that to an absolute URL before storing it, e.g. `https://your-domain.com/uploads/<file>`.
- The employee form then validates the full form with `employeeInputSchema` on Save.
- The visible message `Invalid url` is coming from Zod validation, most likely because the deployed self-hosted frontend is still using an older schema that requires `photo_url` to be a full `.url()`, or because a stale/invalid value remains in the hidden `photo_url` state.

## Plan

1. **Make upload URL handling deterministic**
   - Change `api.uploadFile()` so it returns the exact server path (`/uploads/...`) for self-hosted uploads instead of converting it to an absolute URL.
   - Keep absolute URLs untouched only when the backend explicitly returns one.

2. **Make employee photo validation match self-hosted storage**
   - Keep accepting:
     - empty string
     - `null`
     - `/uploads/...`
     - `http://...` / `https://...`
   - Improve the error message so it says the photo URL is invalid, not the generic `Invalid url`.

3. **Add a guard at save time**
   - Before validating/saving, normalise `photo_url`:
     - if empty, save as empty/null-compatible value
     - if it is a same-origin `/uploads/...` URL that was previously converted to absolute, convert it back to `/uploads/...`
   - This makes old uploaded values safe even if the form already contains an absolute self-host URL.

4. **Improve upload error visibility**
   - If upload succeeds, clear any previous error immediately.
   - If save validation fails, show the exact field-specific issue so the user can tell whether it is the photo, website, LinkedIn, etc.

5. **Self-host deployment note**
   - After implementation, rebuild and restart the self-hosted app so the browser is not running the old validation bundle:

```bash
cd /opt/connect-card
bun install
bun run build
sudo systemctl restart business-card
sudo systemctl reload nginx
```

## Files to change

- `src/lib/api.ts`
- `src/lib/employees.schema.ts`
- `src/routes/_authenticated/admin.new.tsx`
