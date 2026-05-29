## 1. Fix "Invalid url" on photo upload

**Cause:** the selfhost upload endpoint returns a relative path like `/uploads/abc.png`, but the form schema (`src/lib/employees.schema.ts`) validates `photo_url` with `z.string().url()`, which only accepts absolute URLs. Saving therefore fails with "Invalid url".

**Fix:** relax `photo_url` in `src/lib/employees.schema.ts` to accept either an absolute URL or a relative path starting with `/uploads/`:

```ts
photo_url: z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || v.startsWith("/uploads/") || /^https?:\/\//.test(v),
    "Must be an uploaded file or a full URL",
  )
  .optional()
  .or(z.literal(""))
  .nullable(),
```

No backend change needed — the card page already renders `/uploads/...` via the same origin.

## 2. Restyle Apple Wallet pass

In `selfhost/src/lib/wallet-apple.ts`, change `createPassJson()` so the generic pass uses:

- `headerFields`: company (e.g. "VoiceHost") — renders top-right, above the name
- `primaryFields`: full name
- `secondaryFields`: job title only (one row)
- `auxiliaryFields`: email only (one row)
- `backFields`: mobile, office phone, website, linkedin (extra detail on the back)

To get email and mobile in a single column (one under the other) we keep one field per row: email in `secondaryFields`, mobile in `auxiliaryFields`. Apple stacks these rows vertically, producing the requested single-column look.

Resulting `generic` block:

```ts
generic: {
  headerFields: e.company ? [{ key: "company", label: "Company", value: e.company }] : [],
  primaryFields: [{ key: "name", label: "Name", value: e.full_name }],
  secondaryFields: [
    ...(e.job_title ? [{ key: "title", label: "Title", value: e.job_title }] : []),
    ...(e.email ? [{ key: "email", label: "Email", value: e.email }] : []),
  ],
  auxiliaryFields: e.mobile ? [{ key: "mobile", label: "Mobile", value: e.mobile }] : [],
  backFields: [
    ...(e.office_phone ? [{ key: "office", label: "Office", value: e.office_phone }] : []),
    ...(e.website ? [{ key: "website", label: "Website", value: e.website }] : []),
    ...(e.linkedin ? [{ key: "linkedin", label: "LinkedIn", value: e.linkedin }] : []),
  ],
},
```

Note: if both job title and email go in `secondaryFields`, iOS renders them as two columns side-by-side. If you want strictly email-then-mobile stacked with nothing beside them, drop the title from `secondaryFields` (move it to `headerFields` alongside company, or to `backFields`). I'll go with: company in header, name primary, **email in secondary (single field = full width)**, **mobile in auxiliary (single field = full width)**, job title + everything else in backFields — that exactly matches "mobile under email, one column".

## Deploy
On the VPS after pulling:
```
cd /opt/connect-card/selfhost && npm run build && sudo systemctl restart business-card
```
(Frontend change requires rebuilding the SPA the usual way.)
