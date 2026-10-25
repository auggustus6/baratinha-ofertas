# Rotina Baratinha — ofertas do Mercado Livre

Site estático (Vercel) com as ofertas selecionadas todo dia.

- `index.html`: o site inteiro (layout, estilos e script). Nome e link do grupo ficam no bloco `CONFIG`.
- `produtos.json`: a vitrine. É gerado a partir da aba **Fila** da planilha "Fila Baratinha — ofertas ML" e atualizado todo dia por uma tarefa agendada do Claude, depois da curadoria da manhã. Só vão para cá dados públicos do anúncio (nome, categoria, preços, desconto, vendidos, link meli.la e foto); comissão, ganhos e status ficam fora.
- `scripts/gerar_produtos.py`: converte o resultado de `get_values("Fila!A:R")` em `produtos.json` (janela de 7 dias, sem repetir produto). Não reescreve o arquivo se os produtos forem os mesmos.

Cada push na `main` publica o site na Vercel.
