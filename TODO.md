# TODO - Otimizações de performance

## Frontend (`frontend/script.js`)
- [x] 1. Adicionar constantes `CONCORRENCIA_LEITURA` e `ARQUIVOS_POR_PAGINA` + variáveis de paginação.
- [x] 2. Truncar arquivos grandes durante a leitura (ler apenas preview) em `lerConteudo`.
- [x] 3. Criar `lerArquivosComProgresso` (leitura em paralelo com limite de concorrência).
- [x] 4. Usar leitura em paralelo no `escanear` e atualizar progresso real.
- [x] 5. Remover progresso simulado e mostrar progresso real (`atualizarProgresso`).
- [x] 6. Renderizar resultados por páginas (`renderizarMaisArquivos` e botão "Mostrar mais").

## Frontend (`frontend/style.css`)
- [x] 7. Estilizar o botão `botao-mostrar-mais`.
- [x] 8. Reajustar o tamanho dos botões na versão desktop (>=1024px).

## Backend (`backend.py`)
- [x] 9. Adicionar `import os`, constantes `PASTAS_IGNORADAS` e `LIMITE_PREVIEW_POR_ARQUIVO`.
- [x] 10. Truncar arquivos grandes durante a leitura em `ler_conteudo` (Python).
- [x] 11. Usar `os.walk` no `escanear_pasta` para ignorar pastas desnecessárias.

## Testes
- [x] 12. Validar sintaxe do `backend.py` (ast.parse) e do `frontend/script.js` (node --check).
