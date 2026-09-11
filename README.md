# Scanner de Arquivos

## O que este sistema faz
Scanner de arquivos de texto com interface web. A leitura acontece no navegador:

- o usuário escolhe uma pasta pelo seletor do navegador;
- o JavaScript filtra arquivos de texto e imagens;
- o resumo é gerado localmente no browser;
- o arquivo `resumo.txt` é baixado pelo navegador (ou salvo direto na pasta escolhida, quando o navegador permite).

Isso é necessário porque um site publicado na Vercel não pode acessar caminhos locais como `C:\Users\...` do computador de quem está usando.

## Estrutura de arquivos
```
public/
  index.html   -> interface do scanner
  script.js    -> leitura da pasta, montagem do resumo e download
  style.css    -> estilos da interface
  logo.png     -> logo do sistema (topo da página e favicon)
backend.py     -> servidor local antigo (Python), opcional, não usado no deploy da Vercel
README.md
```

Tudo que o site precisa fica dentro de `public/`. Isso importa porque o Vercel usa `public/` automaticamente como raiz do site quando ela existe — não é preciso nenhum `vercel.json` nem configuração manual no dashboard.

> Se um dia o site voltar a dar **404: NOT_FOUND** na Vercel, confira primeiro se algum arquivo (`index.html`, `script.js`, `style.css`, `logo.png`) saiu de dentro de `public/` ou se voltou a existir algum `vercel.json`/`package.json` na raiz — foi o que causou esse erro da última vez.

## Como rodar localmente
```bash
python -m http.server 8000 -d public
```
Depois acesse `http://localhost:8000`.

## Como fazer deploy na Vercel
1. Suba o repositório (com a estrutura acima) para o GitHub.
2. Importe o repositório na Vercel.
3. Não é necessário configurar Build Command, Output Directory nem Root Directory — deixe tudo em branco/padrão.
4. Aguarde o deploy ficar "Ready" e acesse o link.

## Arquivos analisados (texto)
Extensões cujo conteúdo entra no resumo:

`.txt, .py, .json, .csv, .md, .html, .htm, .css, .js, .xml, .yaml, .yml, .log, .ini, .cfg, .conf, .sql, .sh, .bat, .ts, .jsx, .tsx, .java, .c, .cpp, .h, .env, .toml, .ps1`

## Imagens encontradas
Além dos arquivos de texto, o sistema também detecta imagens dentro da pasta analisada:

`.png, .jpg, .jpeg, .gif, .webp, .svg, .bmp, .ico`

O conteúdo binário das imagens não entra no `resumo.txt`. Em vez disso:

- No `resumo.txt`: contagem de imagens por extensão e a lista de caminhos + tamanho de cada imagem.
- Na tela: seção separada "Imagens encontradas", com miniatura (gerada no próprio navegador, sem enviar nada a servidor), nome, tamanho e paginação "Mostrar mais imagens" para pastas com muitas fotos.
- Um arquivo que não é nem texto nem imagem continua contado apenas em "Outros elementos encontrados (não-texto e não-imagem)".

Essa detecção existe tanto no `backend.py` (versão local em Python) quanto no `public/script.js` (versão Vercel/navegador), mantendo o mesmo comportamento nos dois modos de uso.

## Arquivos vazios
Um arquivo de texto com 0 bytes aparece no resumo (tanto no `resumo.txt` quanto na lista exibida na tela) como:
```text
(Arquivo Vazio)
```
Essa regra vale só para arquivos de texto. Imagens vazias (0 bytes) aparecem normalmente na seção de imagens, só sem miniatura (o navegador não consegue exibir uma imagem sem dados).