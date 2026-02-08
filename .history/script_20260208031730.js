const salas = [
  {
    id: 1,
    nome: "Partida 10 reais",
    valor: 10,
    jogadores: [],
    pagamentos: {},
    limite: 4,
    aberta: true
  },
  {
    id: 2,
    nome: "Partida 20 reais",
    valor: 20,
    jogadores: [],
    pagamentos: {},
    limite: 4,
    aberta: true
  }
];

const SENHA_ADMIN = "@@Lucas2014@@";

let adminLogado = false;
let nomeJogadorAtual = null;

const listaSalas = document.getElementById("lista-salas");
const telaSalas = document.getElementById("tela-salas");
const telaJogo = document.getElementById("tela-jogo");
const telaSalaGerenciamento = document.getElementById("tela-sala-gerenciamento");
const nomeSalaGerenciamento = document.getElementById("nomeSalaGerenciamento");
const listaParticipantes = document.getElementById("listaParticipantes");
const iniciarSorteio = document.getElementById("iniciarSorteio");
const voltarGerenciamento = document.getElementById("voltarGerenciamento");

// Admin Secreto
const telaAdminSecreto = document.getElementById("tela-admin-secreto");
const telaPainelModeradorDireto = document.getElementById("tela-painel-moderador-direto");
const abrirAdminSecreto = document.getElementById("abrirAdminSecreto");
const entrarAdminBtn = document.getElementById("entrarAdminBtn");
const voltarAdminBtn = document.getElementById("voltarAdminBtn");
const senhaAdminInput = document.getElementById("senhaAdminInput");
const sairPainelSecretoBtn = document.getElementById("sairPainelSecretoBtn");
const listaSalasModera = document.getElementById("listaSalasModera");

// Form criar sala
const inputNomeSalaSecreto = document.getElementById("inputNomeSalaSecreto");
const inputValorSalaSecreto = document.getElementById("inputValorSalaSecreto");
const btnCriarSalaSecreto = document.getElementById("btnCriarSalaSecreto");

let salaAtual = null;
let jogadoresPagos = {};

let jogadoresDoSorteio = ["Jheckson", "Lucas", "Vitor", "Luana"];
let ordem = [];
let turnoAtual = 0;
let houveVencedor = false;

const listaOrdem = document.getElementById("listaOrdem");
const maletasDiv = document.getElementById("maletas");
const status = document.getElementById("status");
const abrirBtn = document.getElementById("abrirBtn");
const resultado = document.getElementById("resultado");
const resultadoTexto = document.getElementById("resultadoTexto");

const totalMaletas = 6;
let maletas = [];
let indicePremiada = null;

// renderizar salas
function renderizarSalas() {
  listaSalas.innerHTML = "";

  salas.forEach(sala => {
    const div = document.createElement("div");
    div.className = "sala";

    const status = sala.jogadores.length >= sala.limite
      ? "Fechada"
      : "Aberta";

    div.innerHTML = `
      <strong>${sala.nome}</strong><br>
      💰 Ingresso: R$${sala.valor}<br>
      👥 ${sala.jogadores.length} / ${sala.limite}<br>
      🔓 ${status}<br>
      <button ${status === "Fechada" ? "disabled" : ""}>
        Entrar
      </button>
    `;

    div.querySelector("button").onclick = () => entrarNaSala(sala.id);

    listaSalas.appendChild(div);
  });
}

// entrar na sala
function entrarNaSala(idSala) {
  const sala = salas.find(s => s.id === idSala);
  if (!sala) return;

  // Pedir nome do jogador
  const nome = prompt("Digite seu nome:");
  if (!nome || !nome.trim()) {
    return; // Cancelou
  }

  nomeJogadorAtual = nome.trim();

  if (!sala.jogadores.includes(nomeJogadorAtual)) {
    if (sala.jogadores.length < sala.limite) {
      sala.jogadores.push(nomeJogadorAtual);
    }
  }

  // Inicializa pagamentos se não existir
  if (!sala.pagamentos) {
    sala.pagamentos = {};
  }

  salaAtual = sala;

  telaSalas.style.display = "none";
  telaSalaGerenciamento.style.display = "block";
  renderizarGerenciamento();
}

renderizarSalas();

// renderizar gerenciamento da sala
function renderizarGerenciamento() {
  nomeSalaGerenciamento.textContent = `${salaAtual.nome} - R$${salaAtual.valor}`;
  renderizarParticipantesComCheckbox();
}

function renderizarParticipantesComCheckbox() {
  listaParticipantes.innerHTML = "";

  // Inicializa pagamentos da sala se não existir
  if (!salaAtual.pagamentos) {
    salaAtual.pagamentos = {};
  }

  salaAtual.jogadores.forEach(jogador => {
    const div = document.createElement("div");
    div.className = "participante-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = salaAtual.pagamentos[jogador] || false;
    checkbox.onchange = () => {
      salaAtual.pagamentos[jogador] = checkbox.checked;
      atualizarBotaoSorteio();
    };

    const info = document.createElement("div");
    info.className = "participante-info";

    const nome = document.createElement("span");
    nome.className = "participante-nome";
    nome.textContent = jogador;

    const valor = document.createElement("span");
    valor.className = "participante-valor";
    const statusPagamento = salaAtual.pagamentos[jogador] ? "✅ Pago" : "⏳ Pendente";
    valor.textContent = `${statusPagamento} - Ingresso: R$${salaAtual.valor}`;

    info.appendChild(nome);
    info.appendChild(valor);

    div.appendChild(checkbox);
    div.appendChild(info);

    div.onclick = () => checkbox.click();
    listaParticipantes.appendChild(div);
  });

  atualizarBotaoSorteio();
}

function autenticarAdminSala() {
  const senha = senhaAdminSala.value;
  
  if (senha === SENHA_ADMIN_SALA) {
    adminLogado = true;
    senhaAdminSala.value = "";
    renderizarGerenciamento();
  } else {
    alert("❌ Senha de admin incorreta!");
    senhaAdminSala.value = "";
  }
}

function atualizarBotaoSorteio() {
  const pagos = Object.values(salaAtual.pagamentos || {}).filter(p => p).length;
  const temMaisDeUm = pagos >= 2;
  iniciarSorteio.disabled = !temMaisDeUm;

}

function iniciarOSorteio() {
  const jogadoresParaSorteio = Object.keys(salaAtual.pagamentos || {}).filter(j => salaAtual.pagamentos[j]);
  
  if (jogadoresParaSorteio.length < 2) {
    alert("❌ Mínimo 2 jogadores com pagamento!");
    return;
  }

  // Define os jogadores do sorteio (apenas os que pagaram)
  jogadoresDoSorteio = jogadoresParaSorteio;

  telaSalaGerenciamento.style.display = "none";
  telaJogo.style.display = "block";

  sortearOrdem();
  criarMaletas();
}

// sorteia ordem
function sortearOrdem() {
  ordem = [...jogadoresDoSorteio].sort(() => Math.random() - 0.5);
  listaOrdem.innerHTML = "";
  ordem.forEach((nome, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}º - ${nome}`;
    listaOrdem.appendChild(li);
  });
}

// cria maletas
function criarMaletas() {
  maletasDiv.innerHTML = "";
  maletas = [];
  turnoAtual = 0;
  abrirBtn.disabled = true;

  indicePremiada = Math.floor(Math.random() * totalMaletas);

  for (let i = 0; i < totalMaletas; i++) {
    const div = document.createElement("div");
    div.className = "maleta";
    div.textContent = `Maleta ${i + 1}`;
    div.onclick = () => escolherMaleta(i, div);

    maletas.push({
      dono: null,
      premio: i === indicePremiada
    });

    maletasDiv.appendChild(div);
  }

  status.textContent = `Vez de ${ordem[0]}`;
}

// escolher maleta
function escolherMaleta(index, div) {
  if (maletas[index].dono !== null) return;
  if (turnoAtual >= ordem.length) return;

  const jogador = ordem[turnoAtual];
  maletas[index].dono = jogador;

  div.classList.add("escolhida");
  div.textContent = jogador;

  setTimeout(() => {
    div.classList.remove("escolhida");
  }, 400);

  turnoAtual++;

  if (turnoAtual >= ordem.length) {
    status.textContent = "Todos escolheram!";
    abrirBtn.disabled = false;
  } else {
    status.textContent = `Vez de ${ordem[turnoAtual]}`;
  }
}

// abrir maletas
abrirBtn.onclick = () => {
  let vencedor = null;

  // suspense
  Array.from(maletasDiv.children).forEach(div => {
    div.classList.add("tremendo");
  });

  setTimeout(() => {
    maletas.forEach((m, i) => {
      const div = maletasDiv.children[i];
      div.classList.remove("tremendo");

      if (m.premio) {
        div.textContent += " 💰";
        if (m.dono) vencedor = m.dono;
      } else {
        div.textContent += " ❌";
      }
    });

    setTimeout(() => {
      resultado.classList.remove("hidden");

      const btnProximaRodada = document.getElementById("btnProximaRodada");
      const btnVoltar = document.getElementById("btnVoltar");

      if (vencedor) {
        houveVencedor = true;
        resultadoTexto.textContent = `🎆 ${vencedor} VENCEU! 🎆`;
        resultadoTexto.classList.add("vitoria");
        btnProximaRodada.classList.add("hidden");
        btnVoltar.classList.remove("hidden");
      } else {
        houveVencedor = false;
        resultadoTexto.textContent = "😅 Ninguém venceu dessa vez!";
        btnProximaRodada.classList.remove("hidden");
        btnVoltar.classList.add("hidden");
      }
    }, 500);

  }, 1200);
};

// próxima rodada
function proximaRodada() {
  resultado.classList.add("hidden");
  resultadoTexto.classList.remove("vitoria");
  turnoAtual = 0;
  criarMaletas();
}

// reset
function resetar() {
  resultado.classList.add("hidden");
  resultadoTexto.classList.remove("vitoria");
  telaJogo.style.display = "none";
  telaSalas.style.display = "block";
  salaAtual = null;
  houveVencedor = false;
  adminLogado = false;
  senhaAdminSala.value = "";
  renderizarSalas();
}

// PAINEL MODERADOR
function autenticarModerador() {
  const senha = senhaModeradorInput.value;
  
  if (senha === SENHA_MODERADOR) {
    senhaModeradorInput.value = "";
    telaLoginModerador.style.display = "none";
    telaPainelModerador.style.display = "block";
    renderizarPainelModerador();
  } else {
    alert("❌ Código incorreto!");
    senhaModeradorInput.value = "";
  }
}

function renderizarPainelModerador() {
  listaSalasModeracao.innerHTML = "";

  salas.forEach(sala => {
    const div = document.createElement("div");
    div.className = "sala-moderacao";

    const header = document.createElement("div");
    header.className = "sala-moderacao-header";
    header.innerHTML = `
      <span>${sala.nome} - R$${sala.valor}</span>
      <span>${sala.aberta ? "🟢 Aberta" : "🔴 Fechada"}</span>
    `;

    const opcoes = document.createElement("div");
    opcoes.className = "sala-moderacao-opcoes";

    // Botão editar nome
    const btnEditarNome = document.createElement("button");
    btnEditarNome.className = "btn-editar";
    btnEditarNome.textContent = "✏️ Nome";
    btnEditarNome.onclick = () => editarNomeSala(sala.id);

    // Botão editar valor
    const btnEditarValor = document.createElement("button");
    btnEditarValor.className = "btn-editar";
    btnEditarValor.textContent = "💰 Valor";
    btnEditarValor.onclick = () => editarValorSala(sala.id);

    // Botão toggle aberta/fechada
    const btnToggle = document.createElement("button");
    btnToggle.className = "btn-editar";
    btnToggle.textContent = sala.aberta ? "🔒 Fechar" : "🔓 Abrir";
    btnToggle.onclick = () => toggleSalaStatus(sala.id);

    // Botão expulsar
    const btnExpulsar = document.createElement("button");
    btnExpulsar.className = "btn-expulsar";
    btnExpulsar.textContent = "👤 Expulsar";
    btnExpulsar.onclick = () => expulsarJogador(sala.id);

    opcoes.appendChild(btnEditarNome);
    opcoes.appendChild(btnEditarValor);
    opcoes.appendChild(btnToggle);
    opcoes.appendChild(btnExpulsar);

    div.appendChild(header);
    div.appendChild(opcoes);

    listaSalasModeracao.appendChild(div);
  });
}

function editarNomeSala(idSala) {
  const sala = salas.find(s => s.id === idSala);
  const novoNome = prompt("Novo nome da sala:", sala.nome);
  
  if (novoNome && novoNome.trim()) {
    sala.nome = novoNome;
    renderizarPainelModerador();
    renderizarSalas();
  }
}

function editarValorSala(idSala) {
  const sala = salas.find(s => s.id === idSala);
  const novoValor = prompt("Novo valor do ingresso:", sala.valor);
  
  if (novoValor && !isNaN(novoValor) && novoValor > 0) {
    sala.valor = parseInt(novoValor);
    renderizarPainelModerador();
    renderizarSalas();
  }
}

function toggleSalaStatus(idSala) {
  const sala = salas.find(s => s.id === idSala);
  sala.aberta = !sala.aberta;
  renderizarPainelModerador();
  renderizarSalas();
}

function expulsarJogador(idSala) {
  const sala = salas.find(s => s.id === idSala);
  
  if (sala.jogadores.length === 0) {
    alert("❌ Nenhum jogador na sala!");
    return;
  }

  const nomes = sala.jogadores.join(", ");
  const jogador = prompt(`Qual jogador expulsar?\n\nJogadores: ${nomes}`);
  
  if (jogador) {
    const index = sala.jogadores.indexOf(jogador);
    if (index !== -1) {
      sala.jogadores.splice(index, 1);
      alert(`✅ ${jogador} foi expulso!`);
      renderizarPainelModerador();
      renderizarSalas();
    } else {
      alert("❌ Jogador não encontrado!");
    }
  }
}

// criar sala
function criarNovaSala() {
  const nome = inputNomeSala.value.trim();
  const valor = parseInt(inputValorSala.value);

  if (!nome) {
    alert("❌ Digite o nome da sala!");
    return;
  }

  if (!valor || valor <= 0) {
    alert("❌ Digite um valor válido!");
    return;
  }

  // Encontra o maior ID e adiciona 1
  const maxId = Math.max(...salas.map(s => s.id), 0);
  const novoId = maxId + 1;

  const novaSala = {
    id: novoId,
    nome: nome,
    valor: valor,
    jogadores: [],
    limite: 4,
    aberta: true
  };

  salas.push(novaSala);
  alert(`✅ Sala "${nome}" criada com sucesso!`);
  
  // Limpa inputs
  inputNomeSala.value = "";
  inputValorSala.value = "";

  // Atualiza renderizações
  renderizarPainelModerador();
  renderizarSalas();
}

// event listeners
voltarGerenciamento.onclick = () => {
  telaSalaGerenciamento.style.display = "none";
  telaSalas.style.display = "block";
  salaAtual = null;
  adminLogado = false;
  senhaAdminSala.value = "";
};

entrarAdminSala.onclick = autenticarAdminSala;

senhaAdminSala.onkeypress = (e) => {
  if (e.key === "Enter") autenticarAdminSala();
};

iniciarSorteio.onclick = iniciarOSorteio;

// Event listeners Painel Moderador
acessoPainelBtn.onclick = () => {
  telaSalas.style.display = "none";
  telaLoginModerador.style.display = "block";
};

entrarPainelBtn.onclick = () => {
  senhaModeradorInput.onkeypress = (e) => {
    if (e.key === "Enter") autenticarModerador();
  };
  autenticarModerador();
};

senhaModeradorInput.onkeypress = (e) => {
  if (e.key === "Enter") autenticarModerador();
};

voltarLoginBtn.onclick = () => {
  senhaModeradorInput.value = "";
  telaLoginModerador.style.display = "none";
  telaSalas.style.display = "block";
};

sairPainelBtn.onclick = () => {
  telaPainelModerador.style.display = "none";
  telaSalas.style.display = "block";
};

btnCriarSala.onclick = criarNovaSala;

inputNomeSala.onkeypress = (e) => {
  if (e.key === "Enter") criarNovaSala();
};

inputValorSala.onkeypress = (e) => {
  if (e.key === "Enter") criarNovaSala();
};

// init
renderizarSalas();

