// Registra no reels/historico.json a oferta que virou Reel (evita repetir oferta e pose).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const of = JSON.parse(fs.readFileSync(path.join(DIR, 'saida', 'oferta.json'), 'utf8'));
const pubPath = path.join(DIR, 'saida', 'publicado.json');
const pub = fs.existsSync(pubPath) ? JSON.parse(fs.readFileSync(pubPath, 'utf8')) : {};
const hp = path.join(DIR, 'historico.json');
const hist = fs.existsSync(hp) ? JSON.parse(fs.readFileSync(hp, 'utf8')) : [];
hist.push({ dia: of.dia, id: of.id, nome: of.curto || of.nome, loja: of.loja, preco: of.preco, pose: of.pose, publicado: !!pub.id, permalink: pub.permalink || null });
fs.writeFileSync(hp, JSON.stringify(hist.slice(-120), null, 2) + '\n');
console.log('Histórico:', hist.length, 'Reels');
