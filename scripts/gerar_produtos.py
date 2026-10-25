#!/usr/bin/env python3
"""Gera produtos.json (vitrine pública) a partir da aba "Fila" da planilha.

Uso: python3 scripts/gerar_produtos.py <fila.json> [produtos.json]

<fila.json> é o resultado de get_values em "Fila!A:R" (objeto com "values"
ou a lista de linhas direto). Só colunas públicas vão para o site: comissão,
ganhos, remetente, status e texto da postagem ficam de fora.
"""
import json
import sys
from datetime import date, datetime, timedelta, timezone

JANELA_DIAS = 7  # hoje + 6 dias anteriores
TZ = timezone(timedelta(hours=-3))


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("R$", "").replace(" ", "")
    if not s:
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "produtos.json"
    raw = json.load(open(src, encoding="utf-8"))
    rows = raw.get("values", raw) if isinstance(raw, dict) else raw
    head = [h.strip().lower() for h in rows[0]]
    idx = {h: i for i, h in enumerate(head)}

    def g(r, k):
        i = idx.get(k)
        return r[i].strip() if i is not None and i < len(r) and isinstance(r[i], str) else (r[i] if i is not None and i < len(r) else "")

    itens = []
    for r in rows[1:]:
        link = str(g(r, "link") or "")
        dia = str(g(r, "data") or "").lstrip("'")[:10]
        if not link.startswith("https://meli.la/") or len(dia) != 10:
            continue
        lista = str(g(r, "lista") or "").lower()
        itens.append({
            "id": f"{dia}-{g(r, 'n')}",
            "data": dia,
            "lista": "destaque" if lista in ("a", "comissao", "comissão") else "volume",
            "nome": g(r, "produto"),
            "curto": g(r, "remetente") or g(r, "produto"),
            "categoria": g(r, "categoria") or "Outros",
            "preco": num(g(r, "preco")),
            "preco_antigo": num(g(r, "preco_antigo")),
            "desconto": int(num(g(r, "desconto_pct")) or 0),
            "vendidos": int(num(g(r, "vendidos")) or 0),
            "link": link,
            "imagem": (g(r, "imagem") or None) if str(g(r, "imagem") or "").startswith("https://") else None,
        })

    if not itens:
        sys.exit("nenhuma linha válida na planilha")
    ultimo = max(date.fromisoformat(i["data"]) for i in itens)
    corte = ultimo - timedelta(days=JANELA_DIAS - 1)
    itens = [i for i in itens if date.fromisoformat(i["data"]) >= corte]
    # sem repetir produto: fica a ocorrência mais recente
    vistos, final = set(), []
    for i in sorted(itens, key=lambda x: (x["data"], -int(x["id"].split("-")[-1] or 0)), reverse=True):
        k = i["nome"].lower()[:60]
        if k in vistos:
            continue
        vistos.add(k)
        final.append(i)

    payload = {
        "atualizado_em": datetime.now(TZ).isoformat(timespec="minutes"),
        "ultimo_dia": ultimo.isoformat(),
        "total": len(final),
        "produtos": final,
    }
    json.dump(payload, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{out}: {len(final)} produtos (de {corte} a {ultimo})")


if __name__ == "__main__":
    main()
