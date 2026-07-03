# Entra ID Group-Gated Training Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing MFA Authenticator Training page on Azure Static Web Apps so only members of the Entra ID groups `Sec_Sales` and `Sec_Management` (company tenant) can view it, behind a branded login page, with bots blocked.

**Architecture:** Azure Static Web Apps (Standard plan) with a custom Microsoft Entra ID provider scoped to the company tenant. A `GetRoles` Azure Function queries Microsoft Graph (`/me/memberOf`) at sign-in and returns the custom role `training` for members of either group. `staticwebapp.config.json` gates the training route by that role and routes unauthorized users to a branded denied page.

**Tech Stack:** Azure Static Web Apps (Standard), Azure Functions (Node.js), Microsoft Graph, GitHub Actions, static HTML/CSS/SVG.

## Global Constraints

- SWA **Standard** plan (custom auth + rolesSource function require it).
- Single tenant only — custom `azureActiveDirectory` provider, `openIdIssuer` pinned to the company tenant ID.
- Brand palette: background `#FBF7F4`, accent red `#E71C22`, near-black text `#1E1715`.
- All HTML pages self-contained: inline CSS + inline SVG, **no external file references**.
- Every page: `<meta name="robots" content="noindex, nofollow">`; site-wide `X-Robots-Tag: noindex, nofollow`; `robots.txt` disallows all.
- Custom role name is exactly `training`.
- Group membership via Microsoft Graph call (not token claim).
- Placeholders to be filled at setup time (kept as literal tokens in files):
  `<YOUR_ENTRA_TENANT_ID>`, `<SEC_SALES_OBJECT_ID>`, `<SEC_MANAGEMENT_OBJECT_ID>`,
  `<SUPPORT_EMAIL>`, `<SWA_HOST>`.

---

## File Structure

```
/
├── frontend/
│   ├── index.html               # branded login landing page
│   ├── training.html            # existing MFA training content (moved in)
│   ├── denied.html              # access-denied page
│   ├── robots.txt               # Disallow all
│   └── staticwebapp.config.json # routes, roles, auth, response overrides, headers
├── api/
│   └── GetRoles/
│       ├── index.js             # Graph group-membership -> role mapping
│       └── function.json        # HTTP trigger binding
├── .github/workflows/azure-static-web-apps.yml
├── SETUP.md                     # manual Azure/Entra portal steps
└── .gitignore
```

App location `/frontend`, API location `/api`, output location blank.

Note: this folder is **not yet a git repo**. Task 1 initialises it.

---

### Task 1: Initialise repository and scaffold

**Files:**
- Create: `.gitignore`
- Create: `frontend/` and `api/GetRoles/` directories (via the files below in later tasks)

- [ ] **Step 1: Initialise git**

Run:
```bash
git init
git branch -M main
```
Expected: `Initialized empty Git repository`.

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.env
local.settings.json
.vscode/
*.log
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: initialise repo"
```

---

### Task 2: Move training content into the site

**Files:**
- Move: `MFA Authenticator Training - 1st Staff.html` -> `frontend/training.html`

**Interfaces:**
- Produces: route `/training.html` serving the existing training bundle, unmodified except an added robots meta tag.

- [ ] **Step 1: Move the file**

```bash
mkdir -p frontend
git mv "MFA Authenticator Training - 1st Staff.html" frontend/training.html 2>/dev/null || mv "MFA Authenticator Training - 1st Staff.html" frontend/training.html
```

- [ ] **Step 2: Add robots meta to the training page `<head>`**

In `frontend/training.html`, immediately after the `<meta charset="utf-8">` line, add:

```html
  <meta name="robots" content="noindex, nofollow">
```

- [ ] **Step 3: Verify the file still opens**

Open `frontend/training.html` in a browser. Expected: the training content renders as before.

- [ ] **Step 4: Commit**

```bash
git add frontend/training.html
git commit -m "feat: move training content into frontend/"
```

---

### Task 3: Branded login landing page

**Files:**
- Create: `frontend/index.html`

**Interfaces:**
- Produces: `/` — anonymous-accessible page with a link to `/.auth/login/aad`.

- [ ] **Step 1: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>1st Staff — Training Sign In</title>
  <style>
    :root { --bg:#FBF7F4; --red:#E71C22; --ink:#1E1715; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:var(--bg); color:var(--ink); min-height:100vh; display:flex;
      align-items:center; justify-content:center; padding:24px;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .card { background:#fff; border-radius:16px; padding:48px 40px; max-width:420px; width:100%;
      box-shadow:0 8px 30px rgba(30,23,21,.10); text-align:center; }
    .logo { display:inline-flex; align-items:center; gap:10px; margin-bottom:28px; }
    .logo svg { display:block; }
    .logo .word { font-weight:800; font-size:22px; letter-spacing:-.5px; color:var(--ink); }
    .logo .word span { color:var(--red); }
    h1 { font-size:20px; font-weight:700; margin-bottom:10px; }
    p { font-size:15px; line-height:1.5; color:#5c534f; margin-bottom:28px; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:10px;
      width:100%; padding:14px 20px; background:var(--red); color:#fff; border:none;
      border-radius:10px; font-size:16px; font-weight:600; text-decoration:none; cursor:pointer;
      transition:filter .15s; }
    .btn:hover { filter:brightness(.92); }
    .note { margin-top:22px; font-size:13px; color:#8a807b; }
  </style>
</head>
<body>
  <main class="card">
    <div class="logo">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#E71C22"></rect>
        <text x="17" y="23" text-anchor="middle" font-family="sans-serif" font-weight="800"
          font-size="16" fill="#fff">1</text>
      </svg>
      <span class="word">1st <span>Staff</span></span>
    </div>
    <h1>Sales &amp; Management Training</h1>
    <p>Access is restricted to authorised staff. Sign in with your 1st Staff Microsoft account to continue.</p>
    <a class="btn" href="/.auth/login/aad?post_login_redirect_uri=/training.html">
      <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
        <rect x="1"  y="1"  width="10" height="10" fill="#fff"></rect>
        <rect x="12" y="1"  width="10" height="10" fill="#fff" opacity=".85"></rect>
        <rect x="1"  y="12" width="10" height="10" fill="#fff" opacity=".85"></rect>
        <rect x="12" y="12" width="10" height="10" fill="#fff" opacity=".7"></rect>
      </svg>
      Sign in with Microsoft
    </a>
    <p class="note">Trouble signing in? Contact <a href="mailto:<SUPPORT_EMAIL>"><SUPPORT_EMAIL></a></p>
  </main>
</body>
</html>
```

- [ ] **Step 2: Verify it renders**

Open `frontend/index.html` in a browser. Expected: centred white card, red 1st Staff logo, red "Sign in with Microsoft" button.

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat: add branded login landing page"
```

---

### Task 4: Access-denied page

**Files:**
- Create: `frontend/denied.html`

**Interfaces:**
- Produces: `/denied.html` — shown on 403 (authenticated, not in group). Links to `/.auth/logout` and support email.

- [ ] **Step 1: Create `frontend/denied.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>1st Staff — Access Denied</title>
  <style>
    :root { --bg:#FBF7F4; --red:#E71C22; --ink:#1E1715; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:var(--bg); color:var(--ink); min-height:100vh; display:flex;
      align-items:center; justify-content:center; padding:24px;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .card { background:#fff; border-radius:16px; padding:48px 40px; max-width:460px; width:100%;
      box-shadow:0 8px 30px rgba(30,23,21,.10); text-align:center; }
    .icon { width:56px; height:56px; margin:0 auto 22px; }
    h1 { font-size:20px; font-weight:700; margin-bottom:12px; }
    p { font-size:15px; line-height:1.55; color:#5c534f; margin-bottom:14px; }
    .actions { margin-top:26px; display:flex; flex-direction:column; gap:12px; }
    .btn { display:inline-flex; align-items:center; justify-content:center;
      padding:12px 20px; border-radius:10px; font-size:15px; font-weight:600; text-decoration:none; }
    .btn-primary { background:var(--red); color:#fff; }
    .btn-ghost { background:transparent; color:var(--ink); border:1px solid #e3dad4; }
  </style>
</head>
<body>
  <main class="card">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#E71C22" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="4.9" y1="4.9" x2="19.1" y2="19.1"></line>
    </svg>
    <h1>You don't have access to this training</h1>
    <p>Your account was signed in successfully, but it isn't a member of the
      <strong>Sales</strong> or <strong>Management</strong> groups required to view this content.</p>
    <p>If you believe this is a mistake, contact <a href="mailto:<SUPPORT_EMAIL>"><SUPPORT_EMAIL></a>
      to request access.</p>
    <div class="actions">
      <a class="btn btn-ghost" href="/.auth/logout?post_logout_redirect_uri=/">Sign out</a>
    </div>
  </main>
</body>
</html>
```

- [ ] **Step 2: Verify it renders**

Open `frontend/denied.html` in a browser. Expected: white card, red circle-slash icon, "You don't have access" heading, Sign out button.

- [ ] **Step 3: Commit**

```bash
git add frontend/denied.html
git commit -m "feat: add access-denied page"
```

---

### Task 5: robots.txt

**Files:**
- Create: `frontend/robots.txt`

- [ ] **Step 1: Create `frontend/robots.txt`**

```
User-agent: *
Disallow: /
```

- [ ] **Step 2: Commit**

```bash
git add frontend/robots.txt
git commit -m "feat: block all crawlers via robots.txt"
```

---

### Task 6: GetRoles Azure Function

**Files:**
- Create: `api/GetRoles/function.json`
- Create: `api/GetRoles/index.js`

**Interfaces:**
- Consumes: called by SWA runtime (`rolesSource: /api/GetRoles`) with body `{ accessToken, ... }`.
- Produces: HTTP 200 JSON `{ "roles": ["training"] }` when the caller is in either target group, else `{ "roles": [] }`.

- [ ] **Step 1: Create `api/GetRoles/function.json`**

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

- [ ] **Step 2: Create `api/GetRoles/index.js`**

```js
// Maps the custom SWA role "training" to the Entra group Object IDs allowed to
// view the training. SWA calls this function at sign-in with the user's Graph
// access token (loginParameters requested resource=https://graph.microsoft.com).
const roleGroupMappings = {
  training: [
    '<SEC_SALES_OBJECT_ID>',
    '<SEC_MANAGEMENT_OBJECT_ID>'
  ]
};

module.exports = async function (context, req) {
  const accessToken = req.body && req.body.accessToken;
  if (!accessToken) {
    context.res = { status: 200, body: { roles: [] } };
    return;
  }

  // Fetch the user's group memberships from Microsoft Graph (paged).
  const groupIds = new Set();
  let url = 'https://graph.microsoft.com/v1.0/me/memberOf?$select=id&$top=999';
  try {
    while (url) {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!resp.ok) {
        context.log(`Graph call failed: ${resp.status}`);
        break;
      }
      const data = await resp.json();
      for (const item of data.value || []) {
        if (item.id) groupIds.add(item.id);
      }
      url = data['@odata.nextLink'] || null;
    }
  } catch (err) {
    context.log('Graph request error:', err);
  }

  const roles = [];
  for (const [role, allowedGroups] of Object.entries(roleGroupMappings)) {
    if (allowedGroups.some((g) => groupIds.has(g))) roles.push(role);
  }

  context.res = { status: 200, body: { roles } };
};
```

- [ ] **Step 3: Verify JSON/JS parse locally**

Run:
```bash
node -e "require('./api/GetRoles/index.js'); JSON.parse(require('fs').readFileSync('./api/GetRoles/function.json')); console.log('ok')"
```
Expected: `ok` (Node 18+, where global `fetch` exists).

- [ ] **Step 4: Commit**

```bash
git add api/GetRoles/function.json api/GetRoles/index.js
git commit -m "feat: add GetRoles function mapping Entra groups to training role"
```

---

### Task 7: staticwebapp.config.json

**Files:**
- Create: `frontend/staticwebapp.config.json`

**Interfaces:**
- Consumes: role `training` from Task 6; pages from Tasks 3–5.
- Produces: gated `/training.html`, 401->login redirect, 403->denied rewrite, site-wide noindex header, tenant-pinned AAD provider.

- [ ] **Step 1: Create `frontend/staticwebapp.config.json`**

```json
{
  "auth": {
    "rolesSource": "/api/GetRoles",
    "identityProviders": {
      "azureActiveDirectory": {
        "userDetailsClaim": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/<YOUR_ENTRA_TENANT_ID>",
          "clientIdSettingName": "ENTRA_CLIENT_ID",
          "clientSecretSettingName": "ENTRA_CLIENT_SECRET"
        },
        "login": {
          "loginParameters": ["resource=https://graph.microsoft.com"]
        }
      }
    }
  },
  "routes": [
    { "route": "/.auth/login/github", "statusCode": 404 },
    { "route": "/training.html", "allowedRoles": ["training"] },
    { "route": "/", "allowedRoles": ["anonymous", "authenticated"] },
    { "route": "/index.html", "allowedRoles": ["anonymous", "authenticated"] },
    { "route": "/denied.html", "allowedRoles": ["anonymous", "authenticated"] },
    { "route": "/robots.txt", "allowedRoles": ["anonymous", "authenticated"] }
  ],
  "responseOverrides": {
    "401": { "statusCode": 302, "redirect": "/.auth/login/aad?post_login_redirect_uri=/training.html" },
    "403": { "rewrite": "/denied.html" }
  },
  "globalHeaders": {
    "X-Robots-Tag": "noindex, nofollow"
  },
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/training.html", "/denied.html", "/robots.txt", "/.auth/*"]
  }
}
```

- [ ] **Step 2: Validate JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('./frontend/staticwebapp.config.json')); console.log('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add frontend/staticwebapp.config.json
git commit -m "feat: gate training route by role, tenant-pin auth, block bots"
```

---

### Task 8: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/azure-static-web-apps.yml`

**Interfaces:**
- Consumes: repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (created by Azure when the SWA is linked to the repo — see SETUP.md).
- Produces: CI/CD deploy on push to `main`.

- [ ] **Step 1: Create `.github/workflows/azure-static-web-apps.yml`**

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: "/frontend"
          api_location: "/api"
          output_location: ""

  close_pr:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request
    steps:
      - name: Close Pull Request
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: close
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/azure-static-web-apps.yml
git commit -m "ci: add Static Web Apps deploy workflow"
```

---

### Task 9: SETUP.md — manual Azure/Entra steps

**Files:**
- Create: `SETUP.md`

- [ ] **Step 1: Create `SETUP.md`**

````markdown
# Setup — 1st Staff gated training on Azure Static Web Apps

Replace every `<PLACEHOLDER>` in the repo before/at deploy time:
`<YOUR_ENTRA_TENANT_ID>`, `<SEC_SALES_OBJECT_ID>`, `<SEC_MANAGEMENT_OBJECT_ID>`, `<SUPPORT_EMAIL>`.

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
````

- [ ] **Step 2: Commit**

```bash
git add SETUP.md
git commit -m "docs: add Azure/Entra setup guide"
```

---

## Manual verification (post-deploy)

Follow `SETUP.md` §7. All four checks must pass:
1. Anonymous → login/redirect.
2. Group member → training loads.
3. Non-member → denied page.
4. `X-Robots-Tag` header present.

## Notes / gotchas

- `rolesSource` function-based roles are a **preview** feature but supported on the Standard plan.
- Graph `User.Read.All` (delegated) with **admin consent** is required for `/me/memberOf`.
- `openIdIssuer` is pinned to the tenant, so only company accounts can sign in.
- The training bundle is large but static; SWA serves it directly, no build step.
