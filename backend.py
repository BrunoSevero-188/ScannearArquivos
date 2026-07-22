import http.server
import socketserver
import json
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse

PORTA = 8000
PASTA_FRONTEND = Path(__file__).parent / "frontend"

# Extensões consideradas "arquivo de texto" -> só essas entram na análise
EXTENSOES_TEXTO = {".txt", ".py", ".json", ".csv", ".md", ".html", ".htm", ".css", ".js", ".xml",
                    ".yaml", ".yml", ".log", ".ini", ".cfg", ".conf", ".sql", ".sh", ".bat", ".ts", ".jsx", ".tsx",
                    ".java", ".c", ".cpp", ".h", ".env", ".toml", ".ps1", }

LIMITE_CARACTERES_POR_ARQUIVO = 20000  # evita travar o front com arquivos gigantes


def eh_arquivo_de_texto(caminho: Path) -> bool:
    return caminho.suffix.lower() in EXTENSOES_TEXTO


def ler_conteudo(caminho: Path) -> str:
    try:
        conteudo = caminho.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return f"[Não foi possível ler o arquivo: {e}]"

    if len(conteudo) > LIMITE_CARACTERES_POR_ARQUIVO:
        conteudo = (
            conteudo[:LIMITE_CARACTERES_POR_ARQUIVO]
            + f"\n\n[...conteúdo truncado - arquivo tem {len(conteudo)} caracteres...]"
        )
    return conteudo


def montar_texto_resumo(
    pasta_pai: Path,
    nome_arquivo: str,
    arquivos: list,
    contagem_por_extensao: dict,
    total_arquivos: int,
) -> str:
    linhas = []
    linhas.append(f'Caminho da pasta "pai" que foi analisado: {pasta_pai}')
    linhas.append(f"Nome do arquivo de resumo: {nome_arquivo}")
    linhas.append("")

    linhas.append(f"Quantidade de arquivos de texto encontrados: {total_arquivos}")
    linhas.append("Quebra por tipo (extensão):")
    if not contagem_por_extensao:
        linhas.append("- Nenhuma extensão encontrada")
    else:
        for extensao in sorted(contagem_por_extensao.keys()):
            linhas.append(f"- {extensao}: {contagem_por_extensao[extensao]}")
    linhas.append("")

    for item in arquivos:
        nome = Path(item["caminho"]).name
        linhas.append(f"Caminho do ({nome}):")
        linhas.append(item["conteudo"])
        linhas.append("")

    linhas.append("Análise concluída")
    return "\n".join(linhas)


def _definir_nome_arquivo(filename: str) -> str:
    nome = (filename or "").strip().strip('"')
    if not nome:
        nome = "resumo"
    if not nome.lower().endswith(".txt"):
        nome += ".txt"
    return nome


def _resolver_destino_final(destino: str, nome_arquivo: str):
    """Se um destino foi informado, resolve o caminho final onde o resumo será salvo.
    Retorna None se nenhum destino foi informado (nesse caso o front baixa pelo navegador)."""
    destino = (destino or "").strip().strip('"')
    if not destino:
        return None

    destino_path = Path(destino).expanduser()

    if destino_path.is_dir():
        return destino_path / nome_arquivo

    # Caminho ainda não existe e parece uma pasta (sem extensão de arquivo) -> cria a pasta
    if destino_path.suffix == "":
        destino_path.mkdir(parents=True, exist_ok=True)
        return destino_path / nome_arquivo

    # Caso contrário, é um caminho de arquivo completo
    destino_path.parent.mkdir(parents=True, exist_ok=True)
    return destino_path


def escanear_pasta(caminho_pasta: str, destino: str = "", filename: str = "") -> dict:
    pasta = Path(caminho_pasta.strip().strip('"')).expanduser()

    if not pasta.is_dir():
        raise ValueError(f"Pasta não encontrada: {pasta}")

    pasta_pai = pasta.resolve()
    nome_arquivo = _definir_nome_arquivo(filename)

    arquivos = []
    contagem_por_extensao = {}

    for caminho in sorted(pasta.rglob("*")):
        if caminho.is_file() and eh_arquivo_de_texto(caminho):
            # ignora qualquer arquivo com o mesmo nome do resumo que vai ser gerado,
            # pra não reanalisar um resumo antigo que esteja dentro da pasta
            if caminho.name == nome_arquivo:
                continue

            extensao = caminho.suffix.lower() or "(sem extensão)"
            contagem_por_extensao[extensao] = contagem_por_extensao.get(extensao, 0) + 1

            arquivos.append(
                {
                    "caminho": str(caminho.resolve()),
                    "conteudo": ler_conteudo(caminho),
                }
            )

    total_arquivos = len(arquivos)
    texto_resumo = montar_texto_resumo(
        pasta_pai=pasta_pai,
        nome_arquivo=nome_arquivo,
        arquivos=arquivos,
        contagem_por_extensao=contagem_por_extensao,
        total_arquivos=total_arquivos,
    )

    # O resumo NÃO é mais salvo dentro da pasta analisada.
    # Só é salvo em disco (no servidor) se o usuário informar um caminho de destino.
    # Se não informar, o texto completo volta no JSON e o front baixa pelo navegador.
    salvo_em = None
    destino_final = _resolver_destino_final(destino, nome_arquivo)
    if destino_final is not None:
        destino_final.write_text(texto_resumo, encoding="utf-8")
        salvo_em = str(destino_final)

    return {
        "pasta_pai": str(pasta_pai),
        "total_arquivos": total_arquivos,
        "contagem_por_extensao": contagem_por_extensao,
        "arquivos": arquivos,
        "nome_arquivo": nome_arquivo,
        "texto_resumo": texto_resumo,
        "salvo_em": salvo_em,
    }


class ScannerRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PASTA_FRONTEND), **kwargs)

    def do_POST(self):
        rota = urlparse(self.path).path

        if rota == "/api/scan":
            try:
                tamanho = int(self.headers.get("Content-Length", 0))
                corpo = self.rfile.read(tamanho)
                dados = json.loads(corpo or b"{}")
                caminho_pasta = dados.get("pasta", "")
                destino = dados.get("destino", "")
                filename = dados.get("filename", "")

                if not caminho_pasta:
                    self._responder_json(400, {"erro": "Informe o caminho da pasta."})
                    return

                resultado = escanear_pasta(caminho_pasta, destino, filename)
                self._responder_json(200, resultado)

            except ValueError as e:
                self._responder_json(400, {"erro": str(e)})
            except Exception as e:
                self._responder_json(500, {"erro": f"Erro interno: {e}"})
        else:
            self.send_error(404, "Rota não encontrada")

    def _responder_json(self, status: int, dados: dict):
        corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def log_message(self, formato, *args):
        print(f"[{datetime.now():%H:%M:%S}] {formato % args}")


class Servidor(socketserver.TCPServer):
    allow_reuse_address = True


def rodar_servidor():
    with Servidor(("", PORTA), ScannerRequestHandler) as httpd:
        print(f"Scanner de Arquivos rodando em: http://localhost:{PORTA}")
        print("Pressione Ctrl+C para encerrar.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")


if __name__ == "__main__":
    rodar_servidor()