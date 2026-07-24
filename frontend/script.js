const inputPasta = document.getElementById("input-pasta");
const inputDestinoDownload = document.getElementById("input-destino-download");
const inputNomeDownload = document.getElementById("input-nome-download");
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

let ultimoResultado = null;
let progressoIntervalo = null;
let progressoAtual = 0;

async function escanear() {
  const pasta = inputPasta.value.trim();
  const destino = inputDestinoDownload.value.trim();
  const filename = inputNomeDownload.value.trim();
  esconderErro();

  if (!pasta) {
    mostrarErro("Informe o caminho de uma pasta antes de escanear.");
    return;
  }

  iniciarEstadoCarregando();

  try {
    const resposta = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pasta, destino, filename }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarErro(dados.erro || "Não foi possível concluir o scan.");
      return;
    }

    renderizarResultado(dados);

    // Se nenhum destino foi informado, baixa o resumo pelo navegador.
    // Se um destino foi informado, o backend já salvou o arquivo lá.
    if (!dados.salvo_em) {
      baixarPeloNavegador(dados.texto_resumo, dados.nome_arquivo);
    }
  } catch (erro) {
    mostrarErro("Falha de conexão com o servidor. O backend.py está rodando?");
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

// --- "Baixar no Drive" ---
// Sem OAuth configurado, o navegador não consegue subir o arquivo direto
// na conta do usuário. Então: baixa o resumo normalmente e abre o Google
// Drive numa nova aba pra ele soltar o arquivo lá (drag-and-drop).
function baixarNoDrive() {
  if (!ultimoResultado) return;
  baixarPeloNavegador(ultimoResultado.texto_resumo, ultimoResultado.nome_arquivo);
  window.open("https://drive.google.com/drive/my-drive", "_blank", "noopener");
}

// --- animação de porcentagem no botão ---
function iniciarEstadoCarregando() {
  btnEscanear.disabled = true;
  btnEscanear.classList.add("escaneando");
  progressoAtual = 0;
  atualizarProgresso(0);

  clearInterval(progressoIntervalo);
  progressoIntervalo = setInterval(() => {
    // sobe rápido no início e desacelera perto de 92% —
    // o backend não informa progresso real, então isso é uma estimativa visual
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

  // dispara a animação da linha de varredura a cada novo resultado
  areaResultado.classList.remove("varrendo");
  void areaResultado.offsetWidth; // força reflow pra reiniciar a animação
  areaResultado.classList.add("varrendo");
}

btnEscanear.addEventListener("click", escanear);
btnDrive.addEventListener("click", baixarNoDrive);
inputPasta.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    escanear();
  }
});