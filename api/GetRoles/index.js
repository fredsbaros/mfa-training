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
