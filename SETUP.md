# Setup — 1st Staff gated training on Azure Static Web Apps (Free plan)

This app runs on the **Free** plan. Because Free has no custom auth provider or
`rolesSource`, group membership is enforced inside the `GetTraining` managed
function using an **app-only** Microsoft Graph call. The training HTML is served
only by that function — it is **not** a public static file.

The group Object IDs are already filled in `api/GetTraining/index.js`. The only
remaining placeholder is `<SWA_HOST>` (your app URL, known after step 2).
(`TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` are set as app settings, not in files.)

## 1. Push to GitHub
Create a new **private** GitHub repo and push this project's `main` branch.

## 2. Create the Static Web App (Free plan)
Azure Portal → Create resource → Static Web Apps → Create.
- Plan type: **Free**.
- Source: GitHub → select your org/repo/branch `main`.
- Build presets: **Custom**. App location `/frontend`, API location `/api`, Output location blank.
Azure adds the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret and a workflow; keep this repo's
workflow (delete Azure's duplicate under `.github/workflows/` if one is generated).
After the first deploy, copy the app **URL** → this is `<SWA_HOST>`.

## 3. Group Object IDs (already set)
The `ALLOWED_GROUP_IDS` array in `api/GetTraining/index.js` is already populated
with the `Sec_Sales` and `Sec_Management` Object IDs. Update it only if the groups change.

## 4. App registration (app-only Graph)
This registration is used **only** by the `GetTraining` function to call Graph as an
application. It is **not** the sign-in app (Free-plan sign-in uses SWA's built-in
provider), so it needs no redirect URI and no ID-token settings.

Entra ID → App registrations → New registration.
- Name: `1st Staff Training SWA`.
- Supported account types: **Accounts in this organizational directory only**.
- Redirect URI: **leave blank**.
- After creation copy **Application (client) ID** (`GRAPH_CLIENT_ID`) and
  **Directory (tenant) ID** (`TENANT_ID`).
- Certificates & secrets → New client secret → copy the **Value** (`GRAPH_CLIENT_SECRET`).
- API permissions → Add a permission → Microsoft Graph → **Application permissions** →
  add **both** **`GroupMember.Read.All`** and **`User.ReadBasic.All`** → Add →
  **Grant admin consent** for your tenant.
  (Application permissions — not Delegated. Both are required: reading another
  user's group membership via `/users/{id}/checkMemberGroups` needs a user-read
  permission alongside the group one. Alternatively grant the single broader
  **`Directory.Read.All`** instead of the two.)
- Remove the default delegated **User.Read** permission if present — it isn't used.

> Note on sign-in: the Free plan uses the **preconfigured** Entra provider, which
> accepts any Microsoft account. Non-members (including other tenants) are rejected
> at the group check and sent to `/denied.html`, so tenant restriction is enforced
> by membership rather than at the sign-in boundary.

## 5. SWA application settings
Azure Portal → your Static Web App → Settings → Environment variables, add:
- `TENANT_ID` = directory (tenant) ID
- `GRAPH_CLIENT_ID` = application (client) ID
- `GRAPH_CLIENT_SECRET` = client secret value
Save. (Names must match exactly — see `api/GetTraining/index.js`.)

## 6. Redeploy
No file placeholders remain (group IDs are already set; there is no support email).
The app settings from step 5 take effect on save; push any further changes to redeploy.

## 7. Verify
- Anonymous visit to `/` → branded login page; protected routes redirect to Microsoft sign-in.
- Sign in as a `Sec_Sales`/`Sec_Management` member → `/api/training` returns the training page.
- Sign in as a non-member (or another tenant) → redirected to `/denied.html`.
- `curl -I https://<SWA_HOST>/` shows `X-Robots-Tag: noindex, nofollow`.

## Troubleshooting
- **Everyone is denied:** check `GRAPH_CLIENT_SECRET` is the secret *Value* (not its ID) and
  not expired, and that **admin consent** was granted for `GroupMember.Read.All` (application).
- **Members denied / Graph 403:** confirm the permission is an *Application* permission and
  consent is granted; app-only tokens carry no user context.
- **Wrong group not gating:** verify the Object IDs in `ALLOWED_GROUP_IDS` are the *group*
  Object IDs from Entra → Groups (not app or user IDs).
