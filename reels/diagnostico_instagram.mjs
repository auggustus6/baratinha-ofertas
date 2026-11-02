// Diagnóstico da conexão com o Instagram (não imprime o token).
const { IG_TOKEN, IG_USER_ID } = process.env;
const G = 'https://graph.facebook.com/v21.0';
const get = async (p, extra = {}) => {
  const u = `${G}/${p}${p.includes('?') ? '&' : '?'}` + new URLSearchParams({ ...extra, access_token: IG_TOKEN });
  const r = await fetch(u); const j = await r.json().catch(() => ({}));
  return j;
};
const show = (t, j) => console.log(`\n== ${t}\n` + JSON.stringify(j, null, 2));
show('Token (debug_token)', await get('debug_token', { input_token: IG_TOKEN }).then(j => {
  const d = j.data || j; return { app_id: d.app_id, application: d.application, type: d.type, is_valid: d.is_valid, expires_at: d.expires_at, scopes: d.scopes, granular_scopes: d.granular_scopes, error: d.error || j.error };
}));
show('Quem é o token (/me)', await get('me', { fields: 'id,name' }));
show('Páginas acessíveis', await get('me/accounts', { fields: 'id,name,instagram_business_account{id,username}' }));
show('Conta do Instagram', await get(IG_USER_ID, { fields: 'id,username,name,media_count' }));
show('Limite de publicação', await get(`${IG_USER_ID}/content_publishing_limit`, { fields: 'config,quota_usage' }));
show('Últimos containers', await get(`${IG_USER_ID}/media`, { fields: 'id,media_type,timestamp', limit: '3' }));
