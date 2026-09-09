# Scanner de Arquivos

## O que e este sistema
Este projeto e um scanner de arquivos de texto com interface web.

Na versao para Vercel, a leitura dos arquivos acontece no proprio navegador:

- o usuario escolhe uma pasta pelo seletor do navegador;
- o JavaScript filtra arquivos de texto e imagens;
- o resumo e gerado localmente no browser;
- o arquivo `resumo.txt` e baixado pelo navegador.

Isso e necessario porque um site publicado na Vercel nao pode acessar caminhos locais como `C:\Users\...` do computador de quem esta usando.

## Arquivos principais
- `frontend/index.html`: interface do scanner.
- `frontend/script.js`: leitura da pasta selecionada, montagem do resumo e download.
- `frontend/style.css`: estilos da interface.
- `public/logo.png`: logo do sistema, exibida no topo da pagina e usada como favicon (icone da guia do navegador).
- `vercel.json`: rewrites para servir o frontend na raiz do deploy (inclui a rota `/logo.png`).
- `backend.py`: servidor local antigo, util para rodar fora da Vercel se voce quiser manter a versao Python.

## Logo / identidade visual
O sistema usa um arquivo `logo.png` guardado na pasta `public/` (na raiz do projeto, fora de `frontend/`).

- No HTML, ela e referenciada via `/logo.png`.
- Aparece no topo da pagina, ao lado do titulo "Scanner de Arquivos".
- Tambem e usada como favicon (o icone que aparece na guia/aba do navegador), atraves das tags `<link rel="icon">` e `<link rel="apple-touch-icon">` no `<head>` do `index.html`.
- No `vercel.json` existe um rewrite de `/logo.png` para `/public/logo.png`, seguindo o mesmo padrao ja usado para `style.css` e `script.js`.

Para trocar a logo, basta substituir o arquivo `public/logo.png` mantendo o mesmo nome (ou renomear e atualizar as referencias em `index.html` e `vercel.json`).

## Como usar na Vercel
1. Publique o projeto normalmente na Vercel.
2. Abra o site gerado.
3. No primeiro campo, digite o caminho apenas como referencia ou clique em **Buscar** para escolher a pasta que sera analisada.
4. No segundo campo, opcionalmente clique em **Buscar** para escolher onde salvar o resumo, quando o navegador permitir.
5. Informe o nome do arquivo ou deixe em branco para usar `resumo.txt`.
6. Clique em **Escanear**.
7. O resumo sera salvo na pasta escolhida ou baixado automaticamente pelo navegador.

## Como rodar localmente
Abra `frontend/index.html` no navegador ou sirva a pasta `frontend/` com qualquer servidor estatico.

Exemplo:

```bash
python -m http.server 8000 -d frontend
```

Depois acesse:

```text
http://localhost:8000
```

> Rodando localmente dessa forma (sem o `vercel.json`), o caminho `/logo.png` so funciona se o arquivo `logo.png` tambem existir dentro de `frontend/`. Para testar a logo localmente, copie `public/logo.png` para `frontend/logo.png` ou sirva o projeto a partir da raiz.

## Arquivos analisados (texto)
O sistema considera arquivos de texto (com conteudo lido e incluido no resumo) as seguintes extensoes:

`.txt, .py, .json, .csv, .md, .html, .htm, .css, .js, .xml, .yaml, .yml, .log, .ini, .cfg, .conf, .sql, .sh, .bat, .ts, .jsx, .tsx, .java, .c, .cpp, .h, .env, .toml, .ps1`

## Imagens encontradas
Alem dos arquivos de texto, o sistema tambem detecta imagens dentro da pasta analisada, com as seguintes extensoes:

`.png, .jpg, .jpeg, .gif, .webp, .svg, .bmp, .ico`

Diferente dos arquivos de texto, o conteudo binario das imagens nao entra no `resumo.txt` (nao faria sentido em um arquivo de texto). Em vez disso:

- No `resumo.txt`, aparece uma contagem de imagens por extensao e a lista de caminhos de cada imagem encontrada (com o tamanho do arquivo).
- Na tela (versao Vercel/navegador), as imagens aparecem em uma seção separada, **"Imagens encontradas"**, com miniatura de cada uma (usando o proprio arquivo selecionado, sem enviar nada para nenhum servidor), nome e tamanho. Essa lista tambem usa paginacao ("Mostrar mais imagens") para não travar a pagina quando ha muitas imagens.
- Um arquivo que nao e nem texto nem imagem continua sendo contado apenas como "Outros elementos encontrados (não-texto e não-imagem)", igual ao comportamento anterior.

Essa deteccao existe tanto no `backend.py` (versao local em Python, que lista os caminhos e tamanhos das imagens no `resumo.txt`) quanto no `frontend/script.js` (versao Vercel, que le os arquivos no navegador e ainda gera as miniaturas), garantindo o mesmo comportamento de contagem/listagem nos dois modos de uso.

## Arquivos vazios
Se um arquivo de texto encontrado na pasta tiver 0 bytes (estiver vazio), o sistema nao tenta ler o conteudo dele. No lugar do conteudo, a analise (tanto no `resumo.txt` quanto na lista exibida na tela) mostra a descricao:

```text
(Arquivo Vazio)
```

Essa checagem existe tanto no `backend.py` (versao local em Python) quanto no `frontend/script.js` (versao Vercel, leitura no navegador), garantindo o mesmo comportamento nos dois modos de uso. Essa regra vale apenas para arquivos de texto; imagens vazias (0 bytes) sao listadas normalmente na secao de imagens, apenas sem miniatura (o navegador nao consegue exibir uma imagem sem dados).