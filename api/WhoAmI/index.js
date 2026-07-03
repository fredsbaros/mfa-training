// TEMPORARY DIAGNOSTIC endpoint — remove after debugging.
// Reports what GetTraining sees at each boundary so we can locate the failure.
// Does NOT leak the client secret. Gated to "authenticated" in staticwebapp.config.json.

const ALLOWED_GROUP_IDS = [
  '39b7dce4-d032-4975-b38e-6241714e775d', // Sec_Sales
  '414e4ac5-ed8e-49ed-bba6-f8787784206e'  // Sec_Management
];

function getClientPrincipal(req) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = async function (context, req) {
  const out = { step: 'start', env: {}, principal: null, userKey: null, token: null, graph: null };

  // 1. Which app settings are present (values redacted)
  out.env = {
    TENANT_ID: process.env.TENANT_ID ? 'set' : 'MISSING',
    GRAPH_CLIENT_ID: process.env.GRAPH_CLIENT_ID ? 'set' : 'MISSING',
    GRAPH_CLIENT_SECRET: process.env.GRAPH_CLIENT_SECRET ? 'set' : 'MISSING'
  };

  // 2. The signed-in user as SWA sees them
  const principal = getClientPrincipal(req);
  out.principal = principal
    ? {
        identityProvider: principal.identityProvider,
        userId: principal.userId,
        userDetails: principal.userDetails,
        userRoles: principal.userRoles,
        claimTypes: (principal.claims || []).map((c) => c.typ)
      }
    : null;

  const oidClaim = (principal && principal.claims || []).find(
    (c) => c.typ === 'http://schemas.microsoft.com/identity/claims/objectidentifier' || c.typ === 'oid'
  );
  const userKey = (oidClaim && oidClaim.val) || (principal && principal.userDetails);
  out.userKey = userKey || null;

  // 3. App-only token acquisition
  try {
    const body = new URLSearchParams({
      client_id: process.env.GRAPH_CLIENT_ID,
      client_secret: process.env.GRAPH_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });
    const tResp = await fetch(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
    );
    const tText = await tResp.text();
    out.token = { status: tResp.status, ok: tResp.ok };
    if (!tResp.ok) {
      out.token.error = tText.slice(0, 400);
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out, null, 2) };
      return;
    }
    const token = JSON.parse(tText).access_token;

    // 4. Graph checkMemberGroups
    if (!userKey) {
      out.graph = { skipped: 'no userKey to look up' };
    } else {
      const gResp = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userKey)}/checkMemberGroups`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupIds: ALLOWED_GROUP_IDS })
        }
      );
      const gText = await gResp.text();
      out.graph = { status: gResp.status, ok: gResp.ok };
      if (gResp.ok) {
        const matched = JSON.parse(gText).value || [];
        out.graph.matchedGroups = matched;
        out.graph.isMember = matched.length > 0;
      } else {
        out.graph.error = gText.slice(0, 600);
      }
    }
  } catch (err) {
    out.exception = String(err);
  }

  context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out, null, 2) };
};
