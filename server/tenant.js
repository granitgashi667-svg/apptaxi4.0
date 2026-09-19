// Helper multi-tenant — filtron automatikisht sipas tenant_id
export function scoped(req) {
  return { tenantId: req.user.tenantId };
}

// Kthen WHERE tenant_id = ? + params për prepared statements
export function tenantWhere(req, extraWhere = '', extraParams = []) {
  const parts = ['tenant_id = ?'];
  const params = [req.user.tenantId];
  if (extraWhere) { parts.push(extraWhere); params.push(...extraParams); }
  return { where: 'WHERE ' + parts.join(' AND '), params };
}

// Shton tenant_id në INSERT automatikisht
export function withTenant(req, data) {
  return { ...data, tenant_id: req.user.tenantId };
}
