// Serves the gated training page on the Azure Static Web Apps FREE plan.
//
// Free plan has no rolesSource/custom-provider, so group membership cannot be
// enforced via SWA roles. Instead this managed function:
//   1. Reads the signed-in user from the x-ms-client-principal header
//      (injected by SWA on all plans; the route is gated to "authenticated").
//   2. Acquires an APP-ONLY Microsoft Graph token (client credentials).
//   3. Asks Graph checkMemberGroups whether the user belongs to either allowed
//      group. Members receive the training HTML; everyone else is redirected to
//      /denied.html. Because only members of these tenant groups pass, this also
//      implicitly restricts access to the company tenant.
//
// Required SWA application settings:
//   TENANT_ID           - the company Entra tenant (directory) ID
//   GRAPH_CLIENT_ID     - app registration (client) ID
//   GRAPH_CLIENT_SECRET - app registration client secret value
// Required app registration: Microsoft Graph APPLICATION permission
//   GroupMember.Read.All (admin consent granted).

const fs = require('fs');
const path = require('path');

const ALLOWED_GROUP_IDS = [
  '39b7dce4-d032-4975-b38e-6241714e775d', // Sec_Sales
  '414e4ac5-ed8e-49ed-bba6-f8787784206e'  // Sec_Management
];

const TRAINING_FILE = path.join(__dirname, 'content', 'training.html');

function getClientPrincipal(req) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function getAppGraphToken() {
  const tenant = process.env.TENANT_ID;
  const body = new URLSearchParams({
    client_id: process.env.GRAPH_CLIENT_ID,
    client_secret: process.env.GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });
  const resp = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  );
  if (!resp.ok) throw new Error(`Token request failed: ${resp.status}`);
  const data = await resp.json();
  return data.access_token;
}

// Returns true if the user (by object id or UPN) is in any allowed group.
async function isMember(userKey, token) {
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userKey)}/checkMemberGroups`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupIds: ALLOWED_GROUP_IDS })
    }
  );
  if (!resp.ok) throw new Error(`checkMemberGroups failed: ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data.value) && data.value.length > 0;
}

module.exports = async function (context, req) {
  const principal = getClientPrincipal(req);
  if (!principal || !principal.userId) {
    // Route is gated to authenticated, so this should not happen; fail safe.
    context.res = { status: 302, headers: { Location: '/.auth/login/aad?post_login_redirect_uri=/api/training' } };
    return;
  }

  // Prefer the stable object id claim; fall back to userDetails (UPN/email).
  const oidClaim = (principal.claims || []).find(
    (c) => c.typ === 'http://schemas.microsoft.com/identity/claims/objectidentifier' || c.typ === 'oid'
  );
  const userKey = (oidClaim && oidClaim.val) || principal.userDetails;

  try {
    const token = await getAppGraphToken();
    const allowed = await isMember(userKey, token);
    if (!allowed) {
      context.res = { status: 302, headers: { Location: '/denied.html' } };
      return;
    }
    const html = fs.readFileSync(TRAINING_FILE, 'utf8');
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      },
      body: html
    };
  } catch (err) {
    context.log('GetTraining error:', err);
    context.res = { status: 302, headers: { Location: '/denied.html' } };
  }
};
