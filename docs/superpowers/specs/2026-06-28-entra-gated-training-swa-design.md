# Design: Entra ID Group-Gated Training Site on Azure Static Web Apps

**Date:** 2026-06-28
**Author:** Fred (1st Staff)
**Status:** Approved design — pending implementation plan

## Goal

Restrict access to the existing **MFA Authenticator Training** page so that only
members of the Entra ID security groups **Sec_Sales** and **Sec_Management** (in the
1st Staff company tenant) can view it. Present a branded login landing page. Deploy
on **Azure Static Web Apps** with GitHub CI/CD. Block search engine / bot indexing.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| What is protected | The existing `MFA Authenticator Training - 1st Staff.html` content |
| Tenant | Single company tenant (custom Entra ID provider, not the multi-tenant preconfigured one) |
| Deployment | GitHub repo + Static Web Apps CI/CD (GitHub Action) |
| Unauthorized (signed-in, not in group) | Branded **Access Denied** page with sign-out + contact info |
| Login UX | Branded landing page with "Sign in with Microsoft" button |
| Group membership check | **Option B — Microsoft Graph call** (robust, group-count independent) |
| Branding | Reuse palette from existing training CSS; inline assets, no external files |
| Bots | `noindex, nofollow` everywhere |

## Brand palette (extracted from existing training file CSS)

- Background: `#FBF7F4` (warm off-white)
- Primary / accent red: `#E71C22`
- Near-black text: `#1E1715`
- Logo: inline "1st Staff" SVG wordmark in the above palette (no external image file)

## Architecture

Azure Static Web Apps configured with a **custom Microsoft Entra ID (AAD) provider**
scoped to the company tenant. A **`GetRoles` Azure Function** runs at sign-in, calls
Microsoft Graph with the user's access token to read group membership, and returns a
custom role (`training`) when the user belongs to either target group.
`staticwebapp.config.json` enforces the role on the training route and redirects
unauthorized/unauthenticated users to the appropriate branded page.

### Authentication & authorization flow

1. User visits `/` → branded **index.html** login landing page.
2. Clicks **Sign in with Microsoft** → `/.auth/login/aad` (custom AAD provider, company tenant only).
3. On successful auth, SWA invokes **`GetRoles`**:
   - Receives the user's access token.
   - Calls Microsoft Graph (`/me/memberOf` or `checkMemberGroups`) to resolve group membership.
   - Maps the two group **Object IDs** → role `training`.
   - Returns `{ "roles": ["training"] }` if a member; otherwise no custom role.
4. User requests `/training` (the training content):
   - Gated by `allowedRoles: ["training"]`.
   - Member → content served.
   - Authenticated non-member → **403** → branded **denied.html**.
   - Unauthenticated → **401** → redirect to `/.auth/login/aad`.

## Repository layout

```
/
├── public/
│   ├── index.html        # branded login landing page (inline CSS + SVG logo)
│   ├── training.html     # existing MFA training content (moved here)
│   ├── denied.html       # access-denied page (sign-out + contact)
│   └── robots.txt        # Disallow: /
├── api/
│   └── GetRoles/
│       ├── index.js      # Graph group-membership → role mapping
│       └── function.json
├── staticwebapp.config.json
└── .github/workflows/azure-static-web-apps.yml
```

## staticwebapp.config.json (behaviour)

- `routes`:
  - `/training*` → `allowedRoles: ["training"]`
  - public assets (`/`, `/index.html`, `/denied.html`, login/logout) → anonymous
- `responseOverrides`:
  - `401` → redirect `302` to `/.auth/login/aad`
  - `403` → rewrite to `/denied.html`
- `auth.identityProviders.azureActiveDirectory` → custom provider, company tenant,
  client ID + secret from SWA application settings.
- `globalHeaders` → `X-Robots-Tag: noindex, nofollow`

## Bot / indexing protection

- `robots.txt` → `User-agent: * / Disallow: /`
- `<meta name="robots" content="noindex, nofollow">` in each HTML head
- `X-Robots-Tag: noindex, nofollow` response header (covers non-HTML too)

(Note: the entire site already requires authentication, so it is not crawlable anyway;
these are defence-in-depth.)

## GetRoles function (Option B — Graph)

- Trigger: HTTP (invoked by SWA roles endpoint).
- Reads the user's bearer access token from the request.
- Calls Microsoft Graph to determine membership in the two target group Object IDs.
- `roleGroupMappings`: `{ training: [<Sec_Sales objectId>, <Sec_Management objectId>] }`.
- Returns `{ roles: ["training"] }` when matched.
- Requires the app registration to have Graph permission **User.Read.All**
  (or `Directory.Read.All`) with **admin consent**.

## Manual Entra / Azure setup (to be documented in the plan)

1. **App registration** in the company tenant:
   - Redirect URI: `https://<swa-host>/.auth/login/aad/callback`
   - Client secret → stored as SWA application setting `AAD_CLIENT_SECRET`
   - Client ID → SWA application setting `AAD_CLIENT_ID`
2. **API permission**: `User.Read.All` (delegated) + admin consent.
3. **Group Object IDs**: capture GUIDs for `Sec_Sales` and `Sec_Management`, place in `GetRoles`.
4. **Create the Static Web App** linked to the GitHub repo (Standard plan recommended; custom auth + functions work, confirm plan during setup).

## Out of scope (YAGNI)

- Multiple training pages / portal menu (single page for now).
- Self-service access requests.
- Per-user invitation roles (group-based only).
- Analytics / telemetry.

## Success criteria

- A Sec_Sales or Sec_Management member can sign in and view the training.
- A signed-in user in neither group sees the Access Denied page, never the content.
- An anonymous visitor is redirected to Microsoft sign-in.
- Sign-in is restricted to the company tenant only.
- Search engines cannot index the site.
- No external file dependencies in the HTML pages.
