# Setup — 1st Staff gated training on Azure Static Web Apps

Replace every `<PLACEHOLDER>` in the repo before/at deploy time:
`<YOUR_ENTRA_TENANT_ID>`, `<SEC_SALES_OBJECT_ID>`, `<SEC_MANAGEMENT_OBJECT_ID>`, `<SUPPORT_EMAIL>`, `<SWA_HOST>`.

## 1. Push to GitHub
Create a new **private** GitHub repo and push this project's `main` branch.

## 2. Create the Static Web App (Standard plan)
Azure Portal → Create resource → Static Web Apps → Create.
- Plan type: **Standard** (required for custom auth + rolesSource).
- Source: GitHub → select your org/repo/branch `main`.
- Build presets: **Custom**. App location `/frontend`, API location `/api`, Output location blank.
Azure adds the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret and a workflow; keep this repo's
workflow (delete Azure's duplicate under `.github/workflows/` if one is generated).

## 3. Get the group Object IDs
Entra ID → Groups → open `Sec_Sales`, copy **Object Id** → `<SEC_SALES_OBJECT_ID>`.
Repeat for `Sec_Management` → `<SEC_MANAGEMENT_OBJECT_ID>`. Paste into `api/GetRoles/index.js`.

## 4. App registration
Entra ID → App registrations → New registration.
- Name: `1st Staff Training SWA`.
- Supported account types: **Accounts in this organizational directory only**.
- Redirect URI (Web): `https://<SWA_HOST>/.auth/login/aad/callback`.
- After creation copy **Application (client) ID** and **Directory (tenant) ID** (`<YOUR_ENTRA_TENANT_ID>`).
- Authentication → enable **ID tokens (used for implicit and hybrid flows)** → Save.
- Certificates & secrets → New client secret → copy the **Value**.
- API permissions → Add → Microsoft Graph → Delegated → **User.Read.All** → **Grant admin consent**.

## 5. SWA application settings
Azure Portal → your Static Web App → Configuration → Application settings, add:
- `ENTRA_CLIENT_ID` = application (client) ID
- `ENTRA_CLIENT_SECRET` = client secret value
Save.

## 6. Fill placeholders and push
Set `<YOUR_ENTRA_TENANT_ID>` in `frontend/staticwebapp.config.json`, group IDs in
`api/GetRoles/index.js`, `<SUPPORT_EMAIL>` in `index.html`/`denied.html`. Commit and push;
the GitHub Action redeploys.

## 7. Verify
- Anonymous visit to `/` → login page; other routes redirect to Microsoft sign-in.
- Sign in as a `Sec_Sales`/`Sec_Management` member → `/training.html` loads.
- Sign in as a non-member → `/denied.html`.
- `curl -I https://<SWA_HOST>/` shows `X-Robots-Tag: noindex, nofollow`.
