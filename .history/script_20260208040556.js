let salas = [
  {
    id: 1,
    nome: "Partida 10 reais",
    valor: 10,
    jogadores: [],
    // jogadores: [{ id: "uuid", nome: "Lucas", pagou: false, sessionId: "sess123" }]
    limite: 4,
    aberta: true,
    moderador: null
  },
  {
    id: 2,
    nome: "Partida 20 reais",
    valor: 20,
    jogadores: [],
    limite: 4,
    aberta: true,
    moderador: null
  }
];

const SENHA_ADMIN = "@@Lucas2014@@";
const CHAVE_SALAS_STORAGE = "vicianteshow_salas";
const CHAVE_ID_DISPOSITIVO = "vicianteshow_device_id";
const CHAVE_SESSAO_ATUAL = "vicianteshow_sessao_atual";

let adminLogado = false;
let nomeJogadorAtual = null;
let idJogadorAtual = null;
let sessionIdAtual = null;

// Gerar ou carregar ID único do dispositivo
function obterOuGerarIdDispositivo() {
  let id = localStorage.getItem(CHAVE_ID_DISPOSITIVO);
  if (!id) {
    id = "user_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
    localStorage.setItem(CHAVE_ID_DISPOSITIVO, id);
  }
  return id;
}

function gerarSessionId() {
  return "sess_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
}

const listaSalas = document.getElementById("lista-salas");
const telaSalas = document.getElementById("tela-salas");
const telaJogo = document.getElementById("tela-jogo");
const telaSalaGerenciamento = document.getElementById("tela-sala-gerenciamento");
const nomeSalaGerenciamento = document.getElementById("nomeSalaGerenciamento");
const listaParticipantes = document.getElementById("listaParticipantes");
const iniciarSorteio = document.getElementById("iniciarSorteio");
const voltarGerenciamento = document.getElementById("voltarGerenciamento");
const statusAdminTela = document.getElementById("statusAdminTela");
const avisoPagamento = document.getElementById("avisoPagamento");
const moderadorNaSala = document.getElementById("moderadorNaSala");

// Admin Secreto
const telaAdminSecreto = document.getElementById("tela-admin-secreto");
const telaPainelModeradorDireto = document.getElementById("tela-painel-moderador-direto");
const abrirAdminSecreto = document.getElementById("abrirAdminSecreto");
const abrirPainelBtn = document.getElementById("abrirPainelBtn");
const sairAdminBtn = document.getElementById("sairAdminBtn");
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

// ========== SINCRONIZAÇÃO ONLINE ==========
function salvarSalas() {
  localStorage.setItem(CHAVE_SALAS_STORAGE, JSON.stringify(salas));
}

function carregarSalas() {
  const salasSalvas = localStorage.getItem(CHAVE_SALAS_STORAGE);
  if (salasSalvas) {
    salas = JSON.parse(salasSalvas);
    
    // Converter formato antigo de jogadores para novo formato
    salas.forEach(sala => {
      if (sala.jogadores && sala.jogadores.length > 0) {
        if (typeof sala.jogadores[0] === 'string') {
          // Formato antigo: array de strings
          const nomes = sala.jogadores;
          sala.jogadores = nomes.map(nome => ({
            id: "old_" + nome.toLowerCase().replace(/\s+/g, '_'),
            nome: nome,
            pagou: sala.pagamentos && sala.pagamentos[nome] ? true : false,
            sessionId: null
          }));
          delete sala.pagamentos; // Remove campo antigo
        }
      }
    });
  }
}

function atualizarStatusSala(sala) {
  // Fechar automaticamente se lotou
  if (sala.jogadores.length >= sala.limite && sala.aberta) {
    sala.aberta = false;
  }
  // Abrir automaticamente se saiu alguém
  else if (sala.jogadores.length < sala.limite && !sala.aberta) {
    sala.aberta = true;
  }
}

function sincronizarAtualizacoes() {
  window.addEventListener("storage", (e) => {
    if (e.key === CHAVE_SALAS_STORAGE) {
      carregarSalas();
      renderizarSalas();
      if (salaAtual) {
        // Se o usuário está dentro de uma sala, atualiza
        const salaAtualizada = salas.find(s => s.id === salaAtual.id);
        if (salaAtualizada) {
          salaAtual = salaAtualizada;
          renderizarGerenciamento();
        }
      }
    }
  });
  
  // Polling para atualizar a cada 1 segundo (caso não tenha storage event)
  setInterval(() => {
    carregarSalas();
    renderizarSalas();
    if (salaAtual) {
      const salaAtualizada = salas.find(s => s.id === salaAtual.id);
      if (salaAtualizada) {
        salaAtual = salaAtualizada;
        renderizarGerenciamento();
      }
    }
  }, 1000);
}

// ========== FIM SINCRONIZAÇÃO ONLINE ==========


function renderizarSalas() {
  listaSalas.innerHTML = "";

  salas.forEach(sala => {
    const div = document.createElement("div");
    div.className = "sala";

    const status = !sala.aberta ? "Fechada" : "Aberta";
    
    // Admin consegue entrar mesmo se sala estiver fechada/cheia
    const podeEntrar = adminLogado || sala.aberta;
    const botaoDisabled = podeEntrar ? "" : "disabled";

    div.innerHTML = `
      <strong>${sala.nome}</strong><br>
      💰 Ingresso: R$${sala.valor}<br>
      👥 ${sala.jogadores.length} / ${sala.limite}<br>
      🔓 ${status}<br>
      <button ${botaoDisabled}>
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
  idJogadorAtual = obterOuGerarIdDispositivo();
  sessionIdAtual = gerarSessionId();

  // Se é admin, entra como moderador
  if (adminLogado) {
    sala.moderador = nomeJogadorAtual;
  } else {
    // Verificar se este ID já está na sala
    let jogadorExistente = sala.jogadores.find(j => j.id === idJogadorAtual);
    
    if (jogadorExistente) {
      // Já existe, só ativa a sessão
      jogadorExistente.sessionId = sessionIdAtual;
      jogadorExistente.nome = nomeJogadorAtual; // Permite mudar nome
    } else {
      // Novo jogador
      if (sala.jogadores.length < sala.limite) {
        sala.jogadores.push({
          id: idJogadorAtual,
          nome: nomeJogadorAtual,
          pagou: false,
          sessionId: sessionIdAtual
        });
      } else {
        alert("❌ Sala lotada!");
        return;
      }
    }
  }

  // Salvar sessão atual no localStorage
  const sessaoAtual = {
    salaId: sala.id,
    salaNome: sala.nome,
    jogadorId: idJogadorAtual,
    jogadorNome: nomeJogadorAtual,
    dataEntrada: new Date().toISOString()
  };
  localStorage.setItem(CHAVE_SESSAO_ATUAL, JSON.stringify(sessaoAtual));

  // Atualiza status da sala
  atualizarStatusSala(sala);
  salvarSalas();

  salaAtual = sala;

  telaSalas.style.display = "none";
  telaSalaGerenciamento.style.display = "block";
  renderizarGerenciamento();
}

renderizarSalas();

// renderizar gerenciamento da sala
function renderizarGerenciamento() {
  nomeSalaGerenciamento.textContent = `${salaAtual.nome} - R$${salaAtual.valor}`;
  
  // Mostrar moderador se houver
  if (salaAtual.moderador) {
    moderadorNaSala.style.display = "block";
  } else {
    moderadorNaSala.style.display = "none";
  }
  
  if (adminLogado) {
    // Admin vê checkboxes e aviso de pagamento
    avisoPagamento.style.display = "block";
    iniciarSorteio.style.display = "block";
    renderizarParticipantesComCheckbox();
  } else {
    // Jogador normal só vê a lista sem checkboxes
    avisoPagamento.style.display = "none";
    iniciarSorteio.style.display = "none";
    renderizarParticipantesSimples();
  }
}

function renderizarParticipantesSimples() {
  listaParticipantes.innerHTML = "";

  salaAtual.jogadores.forEach(jogador => {
    const div = document.createElement("div");
    div.className = "participante-item";

    const nome = document.createElement("span");
    nome.className = "participante-nome";
    nome.textContent = `${jogador.nome} ${jogador.sessionId ? '🟢' : '⚫'}`;

    const valor = document.createElement("span");
    valor.className = "participante-valor";
    const statusPagamento = jogador.pagou ? "✅ Pago" : "⏳ Pendente";
    valor.textContent = `${statusPagamento} - Ingresso: R$${salaAtual.valor}`;

    div.appendChild(nome);
    div.appendChild(valor);

    listaParticipantes.appendChild(div);
  });
}

function renderizarParticipantesComCheckbox() {
  listaParticipantes.innerHTML = "";

  salaAtual.jogadores.forEach(jogador => {
    const div = document.createElement("div");
    div.className = "participante-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = jogador.pagou || false;
    checkbox.onchange = () => {
      jogador.pagou = checkbox.checked;
      salvarSalas();
      atualizarBotaoSorteio();
      renderizarParticipantesComCheckbox();
    };

    const info = document.createElement("div");
    info.className = "participante-info";

    const nome = document.createElement("span");
    nome.className = "participante-nome";
    nome.textContent = `${jogador.nome} ${jogador.sessionId ? '🟢' : '⚫'}`;

    const valor = document.createElement("span");
    valor.className = "participante-valor";
    const statusPagamento = jogador.pagou ? "✅ Pago" : "⏳ Pendente";
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

function atualizarBotaoSorteio() {
  const pagos = salaAtual.jogadores.filter(j => j.pagou).length;
  const temMaisDeUm = pagos >= 2;
  iniciarSorteio.disabled = !temMaisDeUm;
}

function iniciarOSorteio() {
  const jogadoresParaSorteio = salaAtual.jogadores.filter(j => j.pagou).map(j => j.nome);
  
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
  nomeJogadorAtual = null;
  atualizarStatusAdmin();
  renderizarSalas();
}

// ADMIN SECRETO
function autenticarAdmin() {
  const senha = senhaAdminInput.value;
  
  if (senha === SENHA_ADMIN) {
    senhaAdminInput.value = "";
    adminLogado = true;
    telaAdminSecreto.style.display = "none";
    telaSalas.style.display = "block";
    atualizarStatusAdmin();
  } else {
    alert("❌ Código incorreto!");
    senhaAdminInput.value = "";
  }
}

function atualizarStatusAdmin() {
  if (adminLogado) {
    statusAdminTela.style.display = "block";
    abrirPainelBtn.style.display = "block";
    sairAdminBtn.style.display = "block";
    abrirAdminSecreto.style.display = "none";
  } else {
    statusAdminTela.style.display = "none";
    abrirPainelBtn.style.display = "none";
    sairAdminBtn.style.display = "none";
    abrirAdminSecreto.style.display = "block";
  }
}

function renderizarPainelModerador() {
  listaSalasModera.innerHTML = "";

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

    // Botão editar limite
    const btnEditarLimite = document.createElement("button");
    btnEditarLimite.className = "btn-editar";
    btnEditarLimite.textContent = `👥 Limite: ${sala.limite}`;
    btnEditarLimite.onclick = () => editarLimiteSala(sala.id);

    opcoes.appendChild(btnEditarNome);
    opcoes.appendChild(btnEditarValor);
    opcoes.appendChild(btnToggle);
    opcoes.appendChild(btnExpulsar);
    opcoes.appendChild(btnEditarLimite);

    div.appendChild(header);
    div.appendChild(opcoes);

    listaSalasModera.appendChild(div);
  });
}

function editarNomeSala(idSala) {
  const sala = salas.find(s => s.id === idSala);
  const novoNome = prompt("Novo nome da sala:", sala.nome);
  
  if (novoNome && novoNome.trim()) {
    sala.nome = novoNome;
    salvarSalas();
    renderizarPainelModerador();
    renderizarSalas();
  }
}

function editarValorSala(idSala) {
  const sala = salas.find(s => s.id === idSala);
  const novoValor = prompt("Novo valor do ingresso:", sala.valor);
  
  if (novoValor && !isNaN(novoValor) && novoValor > 0) {
    sala.valor = parseInt(novoValor);
    salvarSalas();
    renderizarPainelModerador();
    renderizarSalas();
  }
}

function editarLimiteSala(idSala) {
  const sala = salas.find(s => s.id === idSala);
  const novoLimite = prompt("Novo limite de jogadores:", sala.limite);
  
  if (novoLimite && !isNaN(novoLimite) && novoLimite > 0) {
    sala.limite = parseInt(novoLimite);
    salvarSalas();
    renderizarPainelModerador();
    renderizarSalas();
  }
}

function toggleSalaStatus(idSala) {
  const sala = salas.find(s => s.id === idSala);
  sala.aberta = !sala.aberta;
  salvarSalas();
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
      atualizarStatusSala(sala);
      salvarSalas();
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
  const nome = inputNomeSalaSecreto.value.trim();
  const valor = parseInt(inputValorSalaSecreto.value);

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
    pagamentos: {},
    limite: 4,
    aberta: true,
    moderador: null
  };

  salas.push(novaSala);
  salvarSalas();
  alert(`✅ Sala "${nome}" criada com sucesso!`);
  
  // Limpa inputs
  inputNomeSalaSecreto.value = "";
  inputValorSalaSecreto.value = "";

  // Atualiza renderizações
  renderizarPainelModerador();
  renderizarSalas();
}

// event listeners
voltarGerenciamento.onclick = () => {
  // Remove o jogador da sala quando volta
  if (salaAtual && nomeJogadorAtual) {
    if (adminLogado) {
      // Admin sai como moderador
      salaAtual.moderador = null;
    } else {
      // Jogador normal sai da lista
      const index = salaAtual.jogadores.indexOf(nomeJogadorAtual);
      if (index !== -1) {
        salaAtual.jogadores.splice(index, 1);
      }
    }
    // Atualiza status (abre se tinha fechado)
    atualizarStatusSala(salaAtual);
    salvarSalas();
  }

  telaSalaGerenciamento.style.display = "none";
  telaSalas.style.display = "block";
  salaAtual = null;
  nomeJogadorAtual = null;
};

iniciarSorteio.onclick = iniciarOSorteio;

// Event listeners Admin Secreto
abrirAdminSecreto.onclick = () => {
  telaSalas.style.display = "none";
  telaAdminSecreto.style.display = "block";
};

entrarAdminBtn.onclick = autenticarAdmin;

senhaAdminInput.onkeypress = (e) => {
  if (e.key === "Enter") autenticarAdmin();
};

voltarAdminBtn.onclick = () => {
  senhaAdminInput.value = "";
  telaAdminSecreto.style.display = "none";
  telaSalas.style.display = "block";
};

abrirPainelBtn.onclick = () => {
  telaSalas.style.display = "none";
  telaPainelModeradorDireto.style.display = "block";
  renderizarPainelModerador();
};

sairAdminBtn.onclick = () => {
  adminLogado = false;
  atualizarStatusAdmin();
  renderizarSalas();
};

sairPainelSecretoBtn.onclick = () => {
  telaPainelModeradorDireto.style.display = "none";
  telaSalas.style.display = "block";
  atualizarStatusAdmin();
};

btnCriarSalaSecreto.onclick = criarNovaSala;

inputNomeSalaSecreto.onkeypress = (e) => {
  if (e.key === "Enter") criarNovaSala();
};

inputValorSalaSecreto.onkeypress = (e) => {
  if (e.key === "Enter") criarNovaSala();
};

// init
carregarSalas();
sincronizarAtualizacoes();
atualizarStatusAdmin();
renderizarSalas();

