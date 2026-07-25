const inputPasta = document.getElementById("input-pasta");
const inputArquivos = document.getElementById("input-arquivos");
const inputNomeDownload = document.getElementById("input-nome-download");
const btnSelecionarPasta = document.getElementById("btn-selecionar-pasta");
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

const LIMITE_CARACTERES_POR_ARQUIVO = 20000;

let ultimoResultado = null;
let progressoIntervalo = null;
let progressoAtual = 0;

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

function obterCaminhoRelativo(arquivo) {
  return arquivo.webkitRelativePath || arquivo.name;
}

function obterNomePasta(files) {
  const primeiro = files[0];
  const caminho = primeiro ? obterCaminhoRelativo(primeiro) : "";
  return caminho.split("/")[0] || "Pasta selecionada";
}

async function lerConteudo(arquivo) {
  try {
    let conteudo = await arquivo.text();
    if (conteudo.length > LIMITE_CARACTERES_POR_ARQUIVO) {
      conteudo =
        conteudo.slice(0, LIMITE_CARACTERES_POR_ARQUIVO) +
        `\n\n[...conteudo truncado - arquivo tem ${conteudo.length} caracteres...]`;
    }
    return conteudo;
  } catch (erro) {
    return `[Nao foi possivel ler o arquivo: ${erro.message || erro}]`;
  }
}

function montarTextoResumo({ pastaPai, nomeArquivo, arquivos, contagemPorExtensao }) {
  const linhas = [];
  linhas.push(`Caminho da pasta "pai" que foi analisado: ${pastaPai}`);
  linhas.push(`Nome do arquivo de resumo: ${nomeArquivo}`);
  linhas.push("");
  linhas.push(`Quantidade de arquivos de texto encontrados: ${arquivos.length}`);
  linhas.push("Quebra por tipo (extensao):");

  const extensoes = Object.keys(contagemPorExtensao).sort();
  if (extensoes.length === 0) {
    linhas.push("- Nenhuma extensao encontrada");
  } else {
    for (const extensao of extensoes) {
      linhas.push(`- ${extensao}: ${contagemPorExtensao[extensao]}`);
    }
  }

  linhas.push("");

  for (const item of arquivos) {
    const nome = item.caminho.split("/").pop();
    linhas.push(`Caminho do (${nome}):`);
    linhas.push(item.conteudo);
    linhas.push("");
  }

  linhas.push("Analise concluida");
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
    const arquivosTexto = files
      .filter((arquivo) => ehArquivoDeTexto(arquivo) && arquivo.name !== nomeArquivo)
      .sort((a, b) => obterCaminhoRelativo(a).localeCompare(obterCaminhoRelativo(b)));

    const arquivos = [];
    const contagemPorExtensao = {};

    for (const arquivo of arquivosTexto) {
      const extensao = obterExtensao(arquivo.name) || "(sem extensao)";
      contagemPorExtensao[extensao] = (contagemPorExtensao[extensao] || 0) + 1;
      arquivos.push({
        caminho: obterCaminhoRelativo(arquivo),
        conteudo: await lerConteudo(arquivo),
      });
    }

    const textoResumo = montarTextoResumo({
      pastaPai,
      nomeArquivo,
      arquivos,
      contagemPorExtensao,
    });

    const resultado = {
      pasta_pai: pastaPai,
      total_arquivos: arquivos.length,
      contagem_por_extensao: contagemPorExtensao,
      arquivos,
      nome_arquivo: nomeArquivo,
      texto_resumo: textoResumo,
      salvo_em: null,
    };

    renderizarResultado(resultado);
    baixarPeloNavegador(textoResumo, nomeArquivo);
  } catch (erro) {
    mostrarErro(`Nao foi possivel concluir o scan: ${erro.message || erro}`);
  } finally {
    finalizarEstadoCarregando();
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
  atualizarProgresso(0);

  clearInterval(progressoIntervalo);
  progressoIntervalo = setInterval(() => {
    const passo = progressoAtual < 60 ? 4 : progressoAtual < 80 ? 1.5 : 0.5;
    progressoAtual = Math.min(progressoAtual + passo, 92);
    atualizarProgresso(progressoAtual);
  }, 120);
}

function finalizarEstadoCarregando() {
  clearInterval(progressoIntervalo);
  atualizarProgresso(100);

  setTimeout(() => {
    btnEscanear.disabled = false;
    btnEscanear.classList.remove("escaneando");
    botaoScanProgresso.style.width = "0%";
    botaoScanTexto.textContent = "Escanear";
  }, 400);
}

function atualizarProgresso(valor) {
  botaoScanProgresso.style.width = `${valor}%`;
  botaoScanTexto.textContent = `Escaneando... ${Math.round(valor)}%`;
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
  metaResumoTxt.textContent = `Baixado pelo navegador como "${dados.nome_arquivo}"`;
  metaTotal.textContent = `${dados.total_arquivos} arquivo(s) de texto`;

  const contagem = dados.contagem_por_extensao || {};
  const tipos = Object.keys(contagem)
    .sort((a, b) => contagem[b] - contagem[a])
    .map((ext) => `${ext}: ${contagem[ext]}`)
    .join(" | ");
  metaTipos.textContent = tipos ? `Tipos: ${tipos}` : "Tipos: -";

  listaArquivos.innerHTML = "";

  if (dados.arquivos.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "arquivo__conteudo";
    vazio.textContent = "Nenhum arquivo de texto encontrado nessa pasta.";
    listaArquivos.appendChild(vazio);
  }

  for (const arquivo of dados.arquivos) {
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

  areaResultado.classList.remove("varrendo");
  void areaResultado.offsetWidth;
  areaResultado.classList.add("varrendo");
}

btnSelecionarPasta.addEventListener("click", () => inputArquivos.click());
inputArquivos.addEventListener("change", () => {
  const files = Array.from(inputArquivos.files || []);
  inputPasta.value =
    files.length > 0 ? `${obterNomePasta(files)} (${files.length} arquivo(s))` : "Nenhuma pasta selecionada";
});
btnEscanear.addEventListener("click", escanear);
btnDrive.addEventListener("click", baixarNoDrive);
inputNomeDownload.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    escanear();
  }
});
