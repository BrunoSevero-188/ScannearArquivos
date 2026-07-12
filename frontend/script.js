const inputPasta = document.getElementById("input-pasta");
const btnEscanear = document.getElementById("btn-escanear");
const mensagemErro = document.getElementById("mensagem-erro");
const areaResultado = document.getElementById("area-resultado");
const estadoVazio = document.getElementById("estado-vazio");

const metaPastaPai = document.getElementById("meta-pasta-pai");
const metaResumoTxt = document.getElementById("meta-resumo-txt");
const metaTotal = document.getElementById("meta-total");
const listaArquivos = document.getElementById("lista-arquivos");
const linkDownload = document.getElementById("link-download");

async function escanear() {
  const pasta = inputPasta.value.trim();

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
      body: JSON.stringify({ pasta }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarErro(dados.erro || "Não foi possível concluir o scan.");
      return;
    }

    renderizarResultado(dados);

  } catch (erro) {
    mostrarErro("Falha de conexão com o servidor. O backend.py está rodando?");
  } finally {
    finalizarEstadoCarregando();
  }
}

function iniciarEstadoCarregando() {
  btnEscanear.disabled = true;
  btnEscanear.classList.add("escaneando");
  btnEscanear.querySelector(".botao-scan__texto").textContent = "Escaneando...";
}

function finalizarEstadoCarregando() {
  btnEscanear.disabled = false;
  btnEscanear.classList.remove("escaneando");
  btnEscanear.querySelector(".botao-scan__texto").textContent = "Escanear";
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
  estadoVazio.hidden = true;
  areaResultado.hidden = false;

  metaPastaPai.textContent = dados.pasta_pai;
  metaResumoTxt.textContent = dados.resumo_txt_path;
  metaTotal.textContent = `${dados.total_arquivos} arquivo(s) de texto`;

  linkDownload.href = `/api/download?caminho=${encodeURIComponent(dados.resumo_txt_path)}`;

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
inputPasta.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    escanear();
  }
});