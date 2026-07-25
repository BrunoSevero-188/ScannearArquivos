# Scanner de Arquivos

## O que e este sistema
Este projeto e um scanner de arquivos de texto com interface web.

Na versao para Vercel, a leitura dos arquivos acontece no proprio navegador:

- o usuario escolhe uma pasta pelo seletor do navegador;
- o JavaScript filtra arquivos de texto;
- o resumo e gerado localmente no browser;
- o arquivo `resumo.txt` e baixado pelo navegador.

Isso e necessario porque um site publicado na Vercel nao pode acessar caminhos locais como `C:\Users\...` do computador de quem esta usando.

## Arquivos principais
- `frontend/index.html`: interface do scanner.
- `frontend/script.js`: leitura da pasta selecionada, montagem do resumo e download.
- `frontend/style.css`: estilos da interface.
- `vercel.json`: rewrites para servir o frontend na raiz do deploy.
- `backend.py`: servidor local antigo, util para rodar fora da Vercel se voce quiser manter a versao Python.

## Como usar na Vercel
1. Publique o projeto normalmente na Vercel.
2. Abra o site gerado.
3. Clique em **Escolher pasta**.
4. Escolha a pasta que sera analisada.
5. Clique em **Escanear**.
6. O navegador baixa o resumo automaticamente.

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

## Arquivos analisados
O sistema considera arquivos com as seguintes extensoes:

`.txt, .py, .json, .csv, .md, .html, .htm, .css, .js, .xml, .yaml, .yml, .log, .ini, .cfg, .conf, .sql, .sh, .bat, .ts, .jsx, .tsx, .java, .c, .cpp, .h, .env, .toml, .ps1`
