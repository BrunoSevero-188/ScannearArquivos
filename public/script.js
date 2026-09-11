const statusPasta = document.getElementById("status-pasta");
const inputArquivos = document.getElementById("input-arquivos");
const statusDestino = document.getElementById("status-destino");
const inputNomeDownload = document.getElementById("input-nome-download");
const btnSelecionarPasta = document.getElementById("btn-selecionar-pasta");
const btnSelecionarDestino = document.getElementById("btn-selecionar-destino");
const btnEscanear = document.getElementById("btn-escanear");
const botaoScanProgresso = document.getElementById("botao-scan-progresso");
const botaoScanTexto = document.getElementById("botao-scan-texto");
const btnDrive = document.getElementById("btn-drive");
const mensagemErro = document.getElementById("mensagem-erro");
const areaResultado = document.getElementById("area-resultado");
const estadoVazio = document.getElementById("estado-vazio");

const metaPastaPai = document.getElementById("meta-pasta-pai");
const metaResumoTxt = document.getElementById("meta-resumo-txt");
const metaTotal = document.getElementById("meta-total");
const metaTipos = document.getElementById("meta-tipos");
const listaArquivos = document.getElementById("lista-arquivos");

const secaoImagens = document.getElementById("secao-imagens");
const metaTotalImagens = document.getElementById("meta-total-imagens");
const listaImagens = document.getElementById("lista-imagens");

const EXTENSOES_TEXTO = new Set([
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
]);

// Extensões consideradas "imagem" -> listadas com miniatura, mas sem conteúdo no resumo.txt
const EXTENSOES_IMAGEM = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
]);

const LIMITE_CARACTERES_POR_ARQUIVO = 20000;
const CONCORRENCIA_LEITURA = 4; // nº de arquivos lidos em paralelo
const ARQUIVOS_POR_PAGINA = 200; // quantos arquivos são renderizados por vez
const IMAGENS_POR_PAGINA = 60; // quantas miniaturas são renderizadas por vez
const DESCRICAO_ARQUIVO_VAZIO = "(Arquivo Vazio)";

let ultimoResultado = null;
let destinoHandle = null;
let progressoIntervalo = null;
let progressoAtual = 0;
let arquivosExibidos = 0; // contador de arquivos já renderizados (paginação)
let imagensExibidas = 0; // contador de imagens já renderizadas (paginação)
let urlsImagensAtuais = []; // object URLs criadas para as miniaturas do último scan

function definirNomeArquivo(filename) {
  let nome = (filename || "").trim().replace(/^"+|"+$/g, "");
  if (!nome) nome = "resumo";
  if (!nome.toLowerCase().endsWith(".txt")) nome += ".txt";
  return nome;
}

function obterExtensao(nomeArquivo) {
  const indice = nomeArquivo.lastIndexOf(".");
  return indice >= 0 ? nomeArquivo.slice(indice).toLowerCase() : "";
}

function ehArquivoDeTexto(arquivo) {
  return EXTENSOES_TEXTO.has(obterExtensao(arquivo.name));
}

function ehArquivoDeImagem(arquivo) {
  return EXTENSOES_IMAGEM.has(obterExtensao(arquivo.name));
}

function obterCaminhoRelativo(arquivo) {
  return arquivo.webkitRelativePath || arquivo.name;
}

function obterNomePasta(files) {
  const primeiro = files[0];
  const caminho = primeiro ? obterCaminhoRelativo(primeiro) : "";
  return caminho.split("/")[0] || "Pasta selecionada";
}

function formatarTamanho(bytes) {
  if (bytes === 0) return "0 B";
  const unidades = ["B", "KB", "MB", "GB"];
  let valor = bytes;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice++;
  }
  return `${indice === 0 ? valor : valor.toFixed(1)} ${unidades[indice]}`;
}

async function lerConteudo(arquivo) {
  try {
    const tamanhoTotal = arquivo.size;

    // Arquivo vazio (0 bytes): sinaliza direto, sem tentar ler nada.
    if (tamanhoTotal === 0) {
      return DESCRICAO_ARQUIVO_VAZIO;
    }

    if (tamanhoTotal > LIMITE_CARACTERES_POR_ARQUIVO) {
      const preview = arquivo.slice(0, LIMITE_CARACTERES_POR_ARQUIVO * 2);
      const conteudo = await preview.text();
      const cortado = conteudo.slice(0, LIMITE_CARACTERES_POR_ARQUIVO);
      return cortado + "\n\n[...conteudo truncado - arquivo tem " + tamanhoTotal + " bytes...]";
    }
    return await arquivo.text();
  } catch (erro) {
    return "[Nao foi possivel ler o arquivo: " + (erro.message || erro) + "]";
  }
}

// Lê vários arquivos em paralelo, respeitando um limite de concorrência.
// A ordem dos resultados é preservada (igual à ordem da lista de entrada).
// onProgresso(concluidos, total) é chamado a cada arquivo lido.
async function lerArquivosComProgresso(arquivos, onProgresso) {
  const resultados = new Array(arquivos.length);
  let concluidos = 0;
  let proximo = 0;

  async function trabalhador() {
    while (true) {
      const indice = proximo++;
      if (indice >= arquivos.length) break;
      resultados[indice] = await lerConteudo(arquivos[indice]);
      concluidos++;
      if (onProgresso) onProgresso(concluidos, arquivos.length);
    }
  }

  const quantidade = Math.min(CONCORRENCIA_LEITURA, arquivos.length);
  const workers = [];
  for (let i = 0; i < quantidade; i++) {
    workers.push(trabalhador());
  }
  await Promise.all(workers);
  return resultados;
}

function montarTextoResumo({ pastaPai, nomeArquivo, arquivos, contagemPorExtensao, imagens, contagemImagensPorExtensao, contagemNaoTextoPorExtensao }) {
  const linhas = [];
  linhas.push(`Caminho da pasta "pai" que foi analisado: ${pastaPai}`);
  linhas.push(`Nome do arquivo de resumo: ${nomeArquivo}`);
  linhas.push("");
  linhas.push(`Quantidade de arquivos de texto encontrados: ${arquivos.length}`);
  linhas.push("Quebra por tipo (extensão):");

  const extensoes = Object.keys(contagemPorExtensao).sort();
  if (extensoes.length === 0) {
    linhas.push("- Nenhuma extensão de texto encontrada");
  } else {
    for (const extensao of extensoes) {
      linhas.push(`- ${extensao}: ${contagemPorExtensao[extensao]}`);
    }
  }

  linhas.push("");
  linhas.push(`Quantidade de imagens encontradas: ${imagens.length}`);
  linhas.push("Quebra por tipo (extensão):");
  const extensoesImagem = Object.keys(contagemImagensPorExtensao || {}).sort();
  if (extensoesImagem.length === 0) {
    linhas.push("- Nenhuma imagem encontrada");
  } else {
    for (const extensao of extensoesImagem) {
      linhas.push(`- ${extensao}: ${contagemImagensPorExtensao[extensao]}`);
    }
  }
  if (imagens.length > 0) {
    linhas.push("Caminhos das imagens encontradas:");
    for (const item of imagens) {
      linhas.push(`- ${item.caminho} (${item.tamanhoLegivel})`);
    }
  }

  linhas.push("");
  linhas.push("Outros elementos encontrados (não-texto e não-imagem):");
  const extensoesOutros = Object.keys(contagemNaoTextoPorExtensao || {}).sort();
  if (extensoesOutros.length === 0) {
    linhas.push("- Nenhum outro elemento encontrado");
  } else {
    for (const ext of extensoesOutros) {
      linhas.push(`- Possui ${contagemNaoTextoPorExtensao[ext]} arquivo(s) .${ext.replace('.', '')} no caminho`);
    }
  }

  linhas.push("");

  for (const item of arquivos) {
    const nome = item.caminho.split("/").pop();
    linhas.push(`Caminho do (${nome}):`);
    linhas.push(item.conteudo);
    linhas.push("");
  }

  linhas.push("Análise concluída");
  return linhas.join("\n");
}

async function escanear() {
  const files = Array.from(inputArquivos.files || []);
  const nomeArquivo = definirNomeArquivo(inputNomeDownload.value);
  esconderErro();

  if (files.length === 0) {
    mostrarErro("Escolha uma pasta antes de escanear.");
    return;
  }

  iniciarEstadoCarregando();

  try {
    const pastaPai = obterNomePasta(files);

    const arquivosTexto = [];
    const arquivosImagem = [];
    const contagemNaoTextoPorExtensao = {};

    for (const arquivo of files) {
      if (arquivo.name === nomeArquivo) continue;

      if (ehArquivoDeTexto(arquivo)) {
        arquivosTexto.push(arquivo);
      } else if (ehArquivoDeImagem(arquivo)) {
        arquivosImagem.push(arquivo);
      } else {
        const extensao = obterExtensao(arquivo.name) || "(sem extensão)";
        contagemNaoTextoPorExtensao[extensao] = (contagemNaoTextoPorExtensao[extensao] || 0) + 1;
      }
    }

    arquivosTexto.sort((a, b) => obterCaminhoRelativo(a).localeCompare(obterCaminhoRelativo(b)));
    arquivosImagem.sort((a, b) => obterCaminhoRelativo(a).localeCompare(obterCaminhoRelativo(b)));

    const contagemPorExtensao = {};
    for (const arquivo of arquivosTexto) {
      const extensao = obterExtensao(arquivo.name) || "(sem extensão)";
      contagemPorExtensao[extensao] = (contagemPorExtensao[extensao] || 0) + 1;
    }

    const contagemImagensPorExtensao = {};
    for (const arquivo of arquivosImagem) {
      const extensao = obterExtensao(arquivo.name) || "(sem extensão)";
      contagemImagensPorExtensao[extensao] = (contagemImagensPorExtensao[extensao] || 0) + 1;
    }

    const conteudos = await lerArquivosComProgresso(arquivosTexto, (concluidos, total) => {
      atualizarProgressoTexto(concluidos, total);
    });

    const arquivos = arquivosTexto.map((arquivo, indice) => ({
      caminho: obterCaminhoRelativo(arquivo),
      conteudo: conteudos[indice],
    }));

    // Libera as miniaturas do scan anterior antes de gerar novas (evita vazamento de memória)
    liberarUrlsImagensAtuais();

    const imagens = arquivosImagem.map((arquivo) => {
      const url = URL.createObjectURL(arquivo);
      urlsImagensAtuais.push(url);
      return {
        caminho: obterCaminhoRelativo(arquivo),
        nome: arquivo.name,
        tamanho: arquivo.size,
        tamanhoLegivel: formatarTamanho(arquivo.size),
        url,
      };
    });

    const textoResumo = montarTextoResumo({
      pastaPai,
      nomeArquivo,
      arquivos,
      contagemPorExtensao,
      imagens,
      contagemImagensPorExtensao,
      contagemNaoTextoPorExtensao
    });

    const salvoEm = await salvarResumo(textoResumo, nomeArquivo);

    const resultado = {
      pasta_pai: pastaPai,
      total_arquivos: arquivos.length,
      contagem_por_extensao: contagemPorExtensao,
      imagens,
      contagem_imagens: contagemImagensPorExtensao,
      contagem_nao_texto: contagemNaoTextoPorExtensao,
      arquivos,
      nome_arquivo: nomeArquivo,
      texto_resumo: textoResumo,
      salvo_em: salvoEm,
    };

    renderizarResultado(resultado);
  } catch (erro) {
    mostrarErro(`Não foi possível concluir o scan: ${erro.message || erro}`);
  } finally {
    finalizarEstadoCarregando();
  }
}

function liberarUrlsImagensAtuais() {
  for (const url of urlsImagensAtuais) {
    URL.revokeObjectURL(url);
  }
  urlsImagensAtuais = [];
}

async function salvarResumo(conteudo, nomeArquivo) {
  if (!destinoHandle) {
    baixarPeloNavegador(conteudo, nomeArquivo);
    return null;
  }

  try {
    const arquivoHandle = await destinoHandle.getFileHandle(nomeArquivo, { create: true });
    const writable = await arquivoHandle.createWritable();
    await writable.write(conteudo);
    await writable.close();
    return `${destinoHandle.name}/${nomeArquivo}`;
  } catch (erro) {
    baixarPeloNavegador(conteudo, nomeArquivo);
    mostrarErro("Não foi possível salvar na pasta escolhida. O resumo foi baixado pelo navegador.");
    return null;
  }
}

function baixarPeloNavegador(conteudo, nomeArquivo) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo || "resumo.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function baixarNoDrive() {
  if (!ultimoResultado) return;
  baixarPeloNavegador(ultimoResultado.texto_resumo, ultimoResultado.nome_arquivo);
  window.open("https://drive.google.com/drive/my-drive", "_blank", "noopener");
}

function iniciarEstadoCarregando() {
  btnEscanear.disabled = true;
  btnEscanear.classList.add("escaneando");
  progressoAtual = 0;
  botaoScanProgresso.style.width = "0%";
  botaoScanTexto.textContent = "Escaneando... 0%";
}

// Progresso real durante a leitura: mostra a contagem de arquivos lidos.
function atualizarProgressoTexto(concluidos, total) {
  const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  progressoAtual = percentual;
  botaoScanProgresso.style.width = `${percentual}%`;
  botaoScanTexto.textContent = `Escaneando... ${concluidos}/${total} (${percentual}%)`;
}

function finalizarEstadoCarregando() {
  clearInterval(progressoIntervalo);
  botaoScanProgresso.style.width = "100%";
  botaoScanTexto.textContent = "Escaneando... 100%";

  setTimeout(() => {
    btnEscanear.disabled = false;
    btnEscanear.classList.remove("escaneando");
    botaoScanProgresso.style.width = "0%";
    botaoScanTexto.textContent = "Escanear";
  }, 400);
}

function mostrarErro(texto) {
  mensagemErro.textContent = texto;
  mensagemErro.hidden = false;
}

function esconderErro() {
  mensagemErro.hidden = true;
  mensagemErro.textContent = "";
}

function renderizarResultado(dados) {
  ultimoResultado = dados;

  estadoVazio.hidden = true;
  areaResultado.hidden = false;

  metaPastaPai.textContent = dados.pasta_pai;
  metaResumoTxt.textContent = dados.salvo_em
    ? `Salvo em: ${dados.salvo_em}`
    : `Baixado pelo navegador como "${dados.nome_arquivo}"`;
  metaTotal.textContent = `${dados.total_arquivos} arquivo(s) de texto`;

  const contagem = dados.contagem_por_extensao || {};
  const tipos = Object.keys(contagem)
    .sort((a, b) => contagem[b] - contagem[a])
    .map((ext) => `${ext}: ${contagem[ext]}`)
    .join(" | ");
  metaTipos.textContent = tipos ? `Tipos: ${tipos}` : "Tipos: -";

  listaArquivos.innerHTML = "";
  arquivosExibidos = 0;

  if (dados.arquivos.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "arquivo__conteudo";
    vazio.textContent = "Nenhum arquivo de texto encontrado nessa pasta.";
    listaArquivos.appendChild(vazio);
  } else {
    renderizarMaisArquivos();
  }

  renderizarSecaoImagens(dados);

  areaResultado.classList.remove("varrendo");
  void areaResultado.offsetWidth;
  areaResultado.classList.add("varrendo");
}

// Renderiza a próxima "página" de arquivos na lista. Evita criar milhares de nós
// DOM de uma vez, o que era uma das causas da lentidão/interface travando.
function renderizarMaisArquivos() {
  const dados = ultimoResultado;
  if (!dados) return;

  const lista = dados.arquivos;
  const fim = Math.min(arquivosExibidos + ARQUIVOS_POR_PAGINA, lista.length);

  for (let i = arquivosExibidos; i < fim; i++) {
    const arquivo = lista[i];
    const nomeArquivo = arquivo.caminho.split(/[\\/]/).pop();

    const bloco = document.createElement("article");
    bloco.className = "arquivo";

    const cabecalho = document.createElement("p");
    cabecalho.className = "arquivo__cabecalho";
    cabecalho.textContent = `Caminho do (${nomeArquivo}): ${arquivo.caminho}`;

    const conteudo = document.createElement("pre");
    conteudo.className = "arquivo__conteudo";
    conteudo.textContent = arquivo.conteudo;

    bloco.appendChild(cabecalho);
    bloco.appendChild(conteudo);
    listaArquivos.appendChild(bloco);
  }

  arquivosExibidos = fim;

  // Remove o botão antigo de "mostrar mais", se houver.
  const botaoAntigo = document.getElementById("botao-mostrar-mais");
  if (botaoAntigo) botaoAntigo.remove();

  if (arquivosExibidos < lista.length) {
    const botao = document.createElement("button");
    botao.id = "botao-mostrar-mais";
    botao.className = "botao-mostrar-mais";
    botao.type = "button";
    botao.textContent = `Mostrar mais (${lista.length - arquivosExibidos} restantes)`;
    botao.addEventListener("click", renderizarMaisArquivos);
    listaArquivos.appendChild(botao);
  }
}

// Renderiza a seção de imagens encontradas (miniaturas), com a mesma
// paginação em "páginas" usada para os arquivos de texto.
function renderizarSecaoImagens(dados) {
  const imagens = dados.imagens || [];
  listaImagens.innerHTML = "";
  imagensExibidas = 0;

  if (imagens.length === 0) {
    secaoImagens.hidden = true;
    metaTotalImagens.textContent = "0 imagens";
    return;
  }

  secaoImagens.hidden = false;
  metaTotalImagens.textContent = `${imagens.length} imagem(ns)`;
  renderizarMaisImagens();
}

function renderizarMaisImagens() {
  const dados = ultimoResultado;
  if (!dados) return;

  const lista = dados.imagens || [];
  const fim = Math.min(imagensExibidas + IMAGENS_POR_PAGINA, lista.length);

  for (let i = imagensExibidas; i < fim; i++) {
    const imagem = lista[i];

    const item = document.createElement("figure");
    item.className = "imagem-item";

    const miniatura = document.createElement("img");
    miniatura.className = "imagem-item__miniatura";
    miniatura.src = imagem.url;
    miniatura.alt = imagem.nome;
    miniatura.loading = "lazy";

    const legenda = document.createElement("figcaption");
    legenda.className = "imagem-item__legenda";
    legenda.title = imagem.caminho;
    legenda.textContent = `${imagem.nome} (${imagem.tamanhoLegivel})`;

    item.appendChild(miniatura);
    item.appendChild(legenda);
    listaImagens.appendChild(item);
  }

  imagensExibidas = fim;

  const botaoAntigo = document.getElementById("botao-mostrar-mais-imagens");
  if (botaoAntigo) botaoAntigo.remove();

  if (imagensExibidas < lista.length) {
    const botao = document.createElement("button");
    botao.id = "botao-mostrar-mais-imagens";
    botao.className = "botao-mostrar-mais";
    botao.type = "button";
    botao.textContent = `Mostrar mais imagens (${lista.length - imagensExibidas} restantes)`;
    botao.addEventListener("click", renderizarMaisImagens);
    listaImagens.appendChild(botao);
  }
}

btnSelecionarPasta.addEventListener("click", () => inputArquivos.click());
btnSelecionarDestino.addEventListener("click", async () => {
  esconderErro();

  if (!window.showDirectoryPicker) {
    destinoHandle = null;
    mostrarErro("Seu navegador nao permite escolher uma pasta de destino. O arquivo sera baixado normalmente.");
    return;
  }

  try {
    destinoHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    statusDestino.textContent = destinoHandle.name;
    document.getElementById("campo-destino").classList.add("selecionado");
  } catch (erro) {
    if (erro.name !== "AbortError") {
      mostrarErro(`Nao foi possivel escolher a pasta de destino: ${erro.message || erro}`);
    }
  }
});
inputArquivos.addEventListener("change", () => {
  const files = Array.from(inputArquivos.files || []);
  const campoPasta = document.getElementById("campo-pasta");
  if (files.length > 0) {
    statusPasta.textContent = `${obterNomePasta(files)} (${files.length} arquivo(s))`;
    campoPasta.classList.add("selecionado");
  } else {
    statusPasta.textContent = "Nenhuma pasta selecionada";
    campoPasta.classList.remove("selecionado");
  }
});
btnEscanear.addEventListener("click", escanear);
btnDrive.addEventListener("click", baixarNoDrive);
inputNomeDownload.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    escanear();
  }
});
