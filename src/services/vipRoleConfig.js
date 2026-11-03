export const vipRoles = {
 streamer: process.env.VIP_ROLE_STREAMER || '1557242080428957706',
 lite: process.env.VIP_ROLE_LITE || '1557241841680777286',
 sigma: process.env.VIP_ROLE_SIGMA || '1557242266022576241',
 supremo: process.env.VIP_ROLE_SUPREMO || '1557242437125013534',
 mega: process.env.VIP_ROLE_MEGA || '1557242618348441620'
};
export const vipPriority = ['mega', 'supremo', 'sigma', 'lite', 'streamer'];
export function desiredPlan(snapshot, now = Math.floor(Date.now()/1000)) {
 const valid = snapshot.memberships.filter(m => m.expires > now);
 return valid.find(m => m.plan === snapshot.active)?.plan ||
  vipPriority.find(plan => valid.some(m => m.plan === plan)) || null;
}
export function validateSnapshot(data) {
 if (!data || typeof data.account !== 'string' || !data.account.trim() || data.account.length > 64 || data.account !== data.account.trim() || !Number.isSafeInteger(data.version) || data.version < 1 || !Array.isArray(data.memberships) || data.memberships.length > 5 || typeof data.active !== 'string' || (data.active && !Object.hasOwn(vipRoles,data.active))) throw Object.assign(new Error('Snapshot VIP inválido'),{statusCode:400});
 const seen = new Set();
 for (const m of data.memberships) {
  if (!m || !Object.hasOwn(vipRoles,m.plan) || seen.has(m.plan) || !Number.isSafeInteger(m.expires) || m.expires < 0) throw Object.assign(new Error('Plano ou validade inválidos'),{statusCode:400});
  seen.add(m.plan);
 }
 return {account:data.account,version:data.version,active:data.active,memberships:data.memberships.map(m=>({plan:m.plan,expires:m.expires}))};
}

export function desiredPlans(snapshot, now = Math.floor(Date.now()/1000)) {
 return vipPriority.filter(plan => snapshot.memberships.some(m => m.plan === plan && m.expires > now));
}
