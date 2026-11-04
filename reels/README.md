# Reel diário — Rotina Baratinha

Todo dia, depois da curadoria (commit `Vitrine: ofertas de DD/MM` no `produtos.json`), o GitHub Actions
(`.github/workflows/reel-diario.yml`):

1. escolhe a **melhor oferta do dia** (Shopee ou Mercado Livre): desconto ≥ 20%, maior `desconto × log(vendidos)`, sem repetir produto dos últimos 14 Reels;
2. baixa a foto do produto e **sorteia a pose da personagem** (`poses/poseN.png`, sem fundo, nunca igual à de ontem);
3. monta o vídeo 1080×1920, 16,6 s, a partir do `template.html` (Playwright + ffmpeg), com efeitos sonoros de `sfx/` no ritmo das animações;
4. publica como Reel no Instagram com a legenda de `legenda.txt` e a capa no frame de 7,6 s (produto + preço + selo), se os secrets `IG_TOKEN` e `IG_USER_ID` existirem;
5. anota em `historico.json`.

O vídeo também fica 14 dias em *Actions → execução → Artifacts*, mesmo sem publicar.

## Rodar à mão
*Actions → Reel diário → Run workflow*: dá para escolher o produto (ID do `produtos.json`), a pose, publicar ou não, e forçar um segundo Reel no mesmo dia.

No computador: `node reels/gerar_reel.mjs [--id ID] [--pose N] [--produto-img foto.jpg] [--previa] [--forcar]`
(`--previa` só tira 5 fotos dos momentos principais em `reels/saida/`).

## Personalizar
- **Poses:** adicione `poses/poseN.png` com fundo transparente (vertical, recortada rente à personagem, ~1500 px de altura). Ela aparece inteira no cartão rosa, apoiada embaixo. Fotos `.jpg` com fundo só entram se não houver nenhum PNG (aí vale o `foco` em `poses/poses.json`).
- **Efeitos sonoros:** `sfx/*.wav`; quando e com que volume cada um toca está na lista `SFX` do `gerar_reel.mjs`.
- **Música:** coloque faixas livres de direitos em `reels/musica/*.mp3`; uma é sorteada por Reel e toca baixinho por baixo dos efeitos.
- **Legenda do post:** `legenda.txt`. **Capa:** variável `IG_CAPA_MS` (milissegundos).
- **Textos e cores:** `template.html` (falas do balão em `#b1..#b4`).

## Segurança
O repositório é público: o token do Instagram fica **só** em *Settings → Secrets and variables → Actions*. Nunca no código.
