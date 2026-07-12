# Scanner de Arquivos

## O que é este sistema
Este projeto é um **scanner local de arquivos de texto** com interface web.

Ele é composto por:
- **backend.py**: servidor HTTP simples em Python (usando apenas a biblioteca padrão), que faz a varredura de uma pasta no seu computador.
- **frontend/**: interface em HTML/CSS/JS que permite informar o caminho de uma pasta e visualizar os resultados.

## Como funciona
1. O front-end envia um **POST** para o backend com o caminho de uma pasta.
2. O backend **varre recursivamente** todos os arquivos dentro dessa pasta.
3. Apenas arquivos com **extensões consideradas de texto** são analisados.
4. O conteúdo de cada arquivo (com limite de tamanho) é incluído em um **resumo.txt** gerado **dentro da própria pasta analisada**.
5. O backend retorna um JSON com:
   - caminho da pasta analisada
   - caminho do `resumo.txt`
   - total de arquivos de texto encontrados
   - lista dos arquivos e seus conteúdos (para o front mostrar)

## Arquivos analisados (extensões)
O sistema considera “arquivo de texto” as seguintes extensões:
`.txt, .py, .json, .csv, .md, .html, .htm, .css, .js, .xml, .yaml, .yml, .log, .ini, .cfg, .conf, .sql, .sh, .bat, .ts, .jsx, .tsx, .java, .c, .cpp, .h, .env, .toml, .ps1`

> Observação: o scanner **ignora** o próprio arquivo `resumo.txt` para não ficar reanalisando o resultado.

## Rotas do backend
- **POST `/api/scan`**
  - Body (JSON): `{ "pasta": "<caminho>" }`
  - Resposta: JSON com os dados do scan e o conteúdo dos arquivos encontrados.

- **GET `/api/download?caminho=<caminho>`**
  - Permite baixar o arquivo **somente se** o arquivo se chamar `resumo.txt`.

## Rodando
1. Inicie o servidor:
   - `python backend.py`
2. Abra no navegador:
   - `http://localhost:8000`
3. Informe o caminho da pasta e clique em **Escanear**.

