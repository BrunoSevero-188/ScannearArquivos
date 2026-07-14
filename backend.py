import http.server
import socketserver
import json
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse, parse_qs, unquote

PORTA = 8000
PASTA_FRONTEND = Path(__file__).parent / "frontend"

# Extensões consideradas "arquivo de texto" -> só essas entram na análise
EXTENSOES_TEXTO = {
    ".txt",
    ".py",
    ".json",
    ".csv",
    ".md",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".xml",
    ".yaml",
    ".yml",
    ".log",
    ".ini",
    ".cfg",
    ".conf",
    ".sql",
    ".sh",
    ".bat",
    ".ts",
    ".jsx",
    ".tsx",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".env",
    ".toml",
    ".ps1",
}

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
    resumo_txt: Path,
    arquivos: list,
    contagem_por_extensao: dict,
    total_arquivos: int,
) -> str:
    linhas = []
    linhas.append(f'Caminho da pasta "pai" que foi analisado: {pasta_pai}')
    linhas.append(f"Link local do resumo.txt: {resumo_txt}")
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
        nome_arquivo = Path(item["caminho"]).name
        linhas.append(f"Caminho do ({nome_arquivo}):")
        linhas.append(item["conteudo"])
        linhas.append("")

    linhas.append("Análise concluída")
    return "\n".join(linhas)


def escanear_pasta(caminho_pasta: str) -> dict:
    pasta = Path(caminho_pasta.strip().strip('"')).expanduser()

    if not pasta.is_dir():
        raise ValueError(f"Pasta não encontrada: {pasta}")

    pasta_pai = pasta.resolve()
    resumo_txt_path = pasta_pai / "resumo.txt"

    arquivos = []
    contagem_por_extensao = {}

    for caminho in sorted(pasta.rglob("*")):
        if caminho.is_file() and eh_arquivo_de_texto(caminho):
            if caminho.resolve() == resumo_txt_path:
                continue  # não inclui o próprio resumo.txt gerado pelo scanner

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
        resumo_txt=resumo_txt_path,
        arquivos=arquivos,
        contagem_por_extensao=contagem_por_extensao,
        total_arquivos=total_arquivos,
    )
    resumo_txt_path.write_text(texto_resumo, encoding="utf-8")

    return {
        "pasta_pai": str(pasta_pai),
        "resumo_txt_path": str(resumo_txt_path),
        "total_arquivos": total_arquivos,
        "contagem_por_extensao": contagem_por_extensao,
        "arquivos": arquivos,
    }


class ScannerRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PASTA_FRONTEND), **kwargs)

    def do_GET(self):
        rota_completa = urlparse(self.path)

        if rota_completa.path == "/api/download":
            self._servir_download(rota_completa.query)
            return

        super().do_GET()

    def _servir_download(self, query_string: str):
        parametros = parse_qs(query_string)
        caminho_bruto = parametros.get("caminho", [""])[0]
        caminho_bruto = unquote(caminho_bruto)

        if not caminho_bruto:
            self.send_error(400, "Parâmetro 'caminho' é obrigatório")
            return

        caminho = Path(caminho_bruto)

        # só permite baixar arquivos chamados resumo.txt, gerados pelo próprio scanner
        if caminho.name != "resumo.txt":
            self.send_error(403, "Só é permitido baixar arquivos resumo.txt")
            return

        if not caminho.is_file():
            self.send_error(404, "Arquivo não encontrado")
            return

        try:
            conteudo = caminho.read_bytes()
        except Exception as e:
            self.send_error(500, f"Erro ao ler arquivo: {e}")
            return

        filename = parametros.get("filename", [""])[0]
        filename = filename.strip().strip('"') if filename else "resumo.txt"
        if not filename:
            filename = "resumo.txt"

        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        # Deixa o browser salvar com o nome enviado pelo front
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(conteudo)))
        self.end_headers()
        self.wfile.write(conteudo)

    def do_POST(self):
        rota = urlparse(self.path).path

        if rota == "/api/scan":
            try:
                tamanho = int(self.headers.get("Content-Length", 0))
                corpo = self.rfile.read(tamanho)
                dados = json.loads(corpo or b"{}")
                caminho_pasta = dados.get("pasta", "")

                if not caminho_pasta:
                    self._responder_json(400, {"erro": "Informe o caminho da pasta."})
                    return

                resultado = escanear_pasta(caminho_pasta)
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

