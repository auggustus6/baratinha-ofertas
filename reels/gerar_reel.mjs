// Gera o Reel do dia da Rotina Baratinha a partir do produtos.json.
// Uso: node reels/gerar_reel.mjs [--produto-img caminho.jpg] [--pose N] [--id ID_DO_PRODUTO]
// Saída: reels/saida/reel.mp4 e reels/saida/oferta.json
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// require() respeita NODE_PATH, então funciona com o playwright instalado globalmente
const { chromium } = createRequire(import.meta.url)('playwright');
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const OUT = path.join(DIR, 'saida');
fs.mkdirSync(OUT, { recursive: true });
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };

// ---------- 1. escolher a melhor oferta do dia ----------
const dados = JSON.parse(fs.readFileSync(path.join(ROOT, 'produtos.json'), 'utf8'));
const histPath = path.join(DIR, 'historico.json');
const hist = fs.existsSync(histPath) ? JSON.parse(fs.readFileSync(histPath, 'utf8')) : [];
const recentes = new Set(hist.filter(h => h.publicado).slice(-14).map(h => (h.nome || '').toLowerCase()));
const dia = dados.ultimo_dia;
// um Reel por dia: se já saiu o de hoje, não faz outro (a menos que --forcar)
if (hist.some(h => h.dia === dia && h.publicado) && !process.argv.includes('--forcar')) {
  console.log('Já existe Reel publicado para', dia, '— nada a fazer.'); process.exit(0);
}
for (const f of ['reel.mp4', 'oferta.json', 'publicado.json']) fs.rmSync(path.join(OUT, f), { force: true });
let cands = dados.produtos.filter(p => p.data === dia && p.imagem && p.preco > 0);
const forcarId = arg('id');
let oferta;
if (forcarId) oferta = dados.produtos.find(p => p.id === forcarId);
else {
  const score = p => (p.desconto || 0) * Math.log10((p.vendidos || 0) + 10);
  const boas = cands.filter(p => (p.desconto || 0) >= 20 && p.preco_antigo > p.preco && !recentes.has((p.curto || p.nome).toLowerCase()));
  boas.sort((a, b) => score(b) - score(a));
  oferta = boas[0] || cands.sort((a, b) => score(b) - score(a))[0];
}
if (!oferta) { console.error('Nenhuma oferta disponível em', dia); process.exit(2); }

// ---------- 2. imagem do produto ----------
let prodImg = arg('produto-img');
if (!prodImg) {
  const r = await fetch(oferta.imagem, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) { console.error('Falha ao baixar imagem', r.status); process.exit(3); }
  prodImg = path.join(OUT, 'produto' + (oferta.imagem.includes('.png') ? '.png' : '.jpg'));
  fs.writeFileSync(prodImg, Buffer.from(await r.arrayBuffer()));
}

// ---------- 3. pose da personagem (gira por dia, sem repetir a de ontem) ----------
const poses = fs.readdirSync(path.join(DIR, 'poses')).filter(f => /^pose\d+\.(jpg|png)$/.test(f)).sort();
const ultimaPose = hist.length ? hist[hist.length - 1].pose : null;
let pose = arg('pose') ? `pose${arg('pose')}.jpg` : null;
if (!pose) {
  const doy = Math.floor((new Date(dia + 'T12:00:00') - new Date(dia.slice(0, 4) + '-01-01T00:00:00')) / 864e5);
  pose = poses[doy % poses.length];
  if (pose === ultimaPose) pose = poses[(doy + 1) % poses.length];
}

const data = {
  nome: oferta.curto || oferta.nome, loja: oferta.loja || 'Mercado Livre',
  preco: oferta.preco, preco_antigo: oferta.preco_antigo, desconto: oferta.desconto, vendidos: oferta.vendidos,
  pose: 'poses/' + pose, produto: 'file://' + path.resolve(prodImg),
  foco: (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'poses', 'poses.json'), 'utf8'))[pose]?.foco ?? 0.5; } catch { return 0.5; } })(),
};
console.log('Oferta:', data.nome, '|', data.loja, '|', data.preco, '| pose', pose);

// ---------- 4. render: um arquivo por cena, depois concat ----------
const FPS = 30;
const cenas = [[0, 3.0], [3.0, 6.9], [6.9, 10.5], [10.5, 13.4], [13.4, 16.6]];
const run = (cmd, args, input) => new Promise((res, rej) => {
  const pr = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'inherit'] });
  pr.on('close', c => c === 0 ? res() : rej(new Error(cmd + ' saiu com ' + c)));
  if (input) input(pr.stdin);
});
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + path.join(DIR, 'template.html'));
await page.evaluate(d => window.setup(d), data);
// --previa: só tira fotos dos momentos mais cheios, para conferir antes do render completo
if (process.argv.includes('--previa')) {
  for (const t of [1.5, 5.5, 9.8, 12.0, 15.5]) {
    await page.evaluate(t => window.render(t), t);
    await page.screenshot({ path: path.join(OUT, `previa_${t}.jpg`), type: 'jpeg', quality: 85 });
  }
  await browser.close(); console.log('Prévias em', OUT); process.exit(0);
}
const arquivos = [];
for (let i = 0; i < cenas.length; i++) {
  const [a, z] = cenas[i]; const n = Math.round((z - a) * FPS);
  const tmp = path.join(OUT, `cena${i + 1}.tmp.mp4`), fin = path.join(OUT, `cena${i + 1}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let f = 0; f < n; f++) {
    await page.evaluate(t => window.render(t), a + f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg cena ' + (i + 1)))));
  fs.renameSync(tmp, fin); arquivos.push(fin);
}
await browser.close();
const lista = path.join(OUT, 'lista.txt');
fs.writeFileSync(lista, arquivos.map(f => `file '${f}'`).join('\n'));
const semAudio = path.join(OUT, 'video.mp4');
await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', semAudio]);

// ---------- 5. áudio: efeitos sonoros (reels/sfx) no ritmo das animações + música opcional (reels/musica) ----------
// [arquivo, segundo em que toca, volume]
const SFX = [
  ['plim1.wav', 0.35, 0.9],    // balão "Achei hoje"
  ['whoosh.wav', 3.05, 0.7],   // produto entrando
  ['carta.wav', 3.45, 0.8],    // cartão do produto pousa
  ['whoosh.wav', 6.85, 0.55],  // painel de preço sobe
  ['risco.wav', 7.8, 1.0],     // risca o preço antigo
  ['revelacao.wav', 8.15, 0.8],// preço novo aparece
  ['sinos.wav', 8.35, 0.8],    // selo de desconto
  ['plim2.wav', 10.6, 0.9],    // balão "O link tá no meu grupo"
  ['presente.wav', 13.4, 1.0], // vira o convite "Link na bio"
  ['plim3.wav', 13.65, 0.9],   // balão "Te espero lá"
];
const sfxDir = path.join(DIR, 'sfx');
const efeitos = SFX.filter(([f]) => fs.existsSync(path.join(sfxDir, f)));
const musDir = path.join(DIR, 'musica');
const musicas = fs.existsSync(musDir) ? fs.readdirSync(musDir).filter(f => /\.(mp3|m4a|wav)$/i.test(f)) : [];
const final = path.join(OUT, 'reel.mp4');
const DUR = 16.6;
const ins = ['-i', semAudio], partes = [];
efeitos.forEach(([f, t, v], k) => {
  ins.push('-i', path.join(sfxDir, f));
  const ms = Math.round(t * 1000);
  partes.push(`[${k + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${v},adelay=${ms}|${ms}[s${k}]`);
});
if (musicas.length) {
  ins.push('-i', path.join(musDir, musicas[Math.floor(Math.random() * musicas.length)]));
  partes.push(`[${efeitos.length + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.35,afade=t=in:d=0.5,afade=t=out:st=${DUR - 1}:d=1[mus]`);
}
const rotulos = efeitos.map((_, k) => `[s${k}]`).concat(musicas.length ? ['[mus]'] : []);
if (rotulos.length) {
  const grafo = partes.join(';') + `;${rotulos.join('')}amix=inputs=${rotulos.length}:normalize=0,volume=2.5,alimiter=limit=0.89,apad,atrim=0:${DUR}[a]`;
  await run('ffmpeg', ['-y', '-loglevel', 'error', ...ins, '-filter_complex', grafo, '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', final]);
} else {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', semAudio, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', final]);
}
fs.writeFileSync(path.join(OUT, 'oferta.json'), JSON.stringify({ ...oferta, pose, dia }, null, 2));
console.log('OK', final);
