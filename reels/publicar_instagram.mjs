// Publica reels/saida/reel.mp4 como Reel no Instagram (sem legenda), pela Graph API.
// Precisa das variáveis IG_TOKEN e IG_USER_ID (GitHub Secrets). Nunca coloque o token no código.
// Uso: node reels/publicar_instagram.mjs [caminho.mp4]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = process.argv[2] || path.join(DIR, 'saida', 'reel.mp4');
const { IG_TOKEN, IG_USER_ID } = process.env;
const V = process.env.IG_API_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${V}`;
if (!IG_TOKEN || !IG_USER_ID) { console.error('Faltam IG_TOKEN / IG_USER_ID.'); process.exit(1); }

async function api(url, opts = {}) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${r.status} ${JSON.stringify(j.error || j)}`);
  return j;
}
const q = (o) => new URLSearchParams({ ...o, access_token: IG_TOKEN }).toString();

// 1. cria o container de Reel com upload resumível
const legenda = process.env.IG_CAPTION || '';
const cont = await api(`${GRAPH}/${IG_USER_ID}/media?` + q({ media_type: 'REELS', upload_type: 'resumable', share_to_feed: 'true', ...(legenda ? { caption: legenda } : {}) }), { method: 'POST' });
console.log('Container', cont.id);

// 2. envia o arquivo
const buf = fs.readFileSync(VIDEO);
const up = await fetch(cont.uri || `https://rupload.facebook.com/ig-api-upload/${V}/${cont.id}`, {
  method: 'POST',
  headers: { Authorization: `OAuth ${IG_TOKEN}`, offset: '0', file_size: String(buf.length), 'Content-Type': 'application/octet-stream' },
  body: buf,
});
const upj = await up.json().catch(() => ({}));
if (!up.ok || !upj.success) throw new Error('Upload falhou: ' + up.status + ' ' + JSON.stringify(upj));
console.log('Upload ok', (buf.length / 1e6).toFixed(1), 'MB');

// 3. espera o Instagram processar o vídeo
let status = '';
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 15000));
  const s = await api(`${GRAPH}/${cont.id}?` + q({ fields: 'status_code,status' }));
  status = s.status_code; console.log('Status', status, s.status || '');
  if (status === 'FINISHED') break;
  if (status === 'ERROR' || status === 'EXPIRED') throw new Error('Processamento falhou: ' + JSON.stringify(s));
}
if (status !== 'FINISHED') throw new Error('Tempo esgotado esperando o processamento');

// 4. publica — o Instagram às vezes devolve "erro interno genérico" (2207085), que é temporário:
// tenta de novo algumas vezes, sempre conferindo antes se o post já não saiu (para não duplicar)
let pub = null;
for (let tent = 1; tent <= 6 && !pub; tent++) {
  try {
    pub = await api(`${GRAPH}/${IG_USER_ID}/media_publish?` + q({ creation_id: cont.id }), { method: 'POST' });
  } catch (e) {
    console.log(`Tentativa ${tent} falhou:`, e.message);
    if (tent === 6) throw e;
    await new Promise(r => setTimeout(r, 30000 * tent));
    const s = await api(`${GRAPH}/${cont.id}?` + q({ fields: 'status_code' })).catch(() => ({}));
    if (s.status_code === 'PUBLISHED') {
      const ult = await api(`${GRAPH}/${IG_USER_ID}/media?` + q({ fields: 'id', limit: '1' }));
      pub = { id: ult.data?.[0]?.id }; console.log('Já tinha sido publicado.');
    }
  }
}
const info = await api(`${GRAPH}/${pub.id}?` + q({ fields: 'permalink' })).catch(() => ({}));
console.log('Publicado', pub.id, info.permalink || '');
fs.writeFileSync(path.join(DIR, 'saida', 'publicado.json'), JSON.stringify({ id: pub.id, permalink: info.permalink || null }, null, 2));
