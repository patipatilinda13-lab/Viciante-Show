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
const CHAVE_CONTAS = "vicianteshow_contas";
const CHAVE_USUARIO_LOGADO = "vicianteshow_usuario_logado";
const TIMEOUT_SESSAO = 5 * 60 * 1000; // 5 minutos em ms

let adminLogado = false;
let nomeJogadorAtual = null;
let idJogadorAtual = null;
let sessionIdAtual = null;
let usuarioLogadoAtual = null;
let ultimaAtividadeTimestamp = null;
let timeoutCheckInterval = null;

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

// ========== SISTEMA DE AUTENTICAÇÃO ==========
function obterContas() {
  const contas = localStorage.getItem(CHAVE_CONTAS);
  return contas ? JSON.parse(contas) : {};
}

function salvarContas(contas) {
  localStorage.setItem(CHAVE_CONTAS, JSON.stringify(contas));
}

function hashSenha(senha) {
  // Simples hash - em produção usar bcrypt ou similar
  let hash = 0;
  for (let i = 0; i < senha.length; i++) {
    const char = senha.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return "hash_" + Math.abs(hash).toString(36);
}

function registrarConta(login, senha) {
  if (login.length < 6) {
    alert("❌ Login deve ter no mínimo 6 caracteres!");
    return false;
  }
  
  if (senha.length < 1) {
    alert("❌ Digite uma senha!");
    return false;
  }

  const contas = obterContas();
  
  if (contas[login]) {
    alert("❌ Esse login já está registrado!");
    return false;
  }

  // Criar nova conta
  contas[login] = {
    id: "user_" + Math.random().toString(36).substr(2, 9),
    login: login,
    senha: hashSenha(senha),
    senhaPlana: senha, // Guardar a senha de verdade para mostrar ao admin
    dataCriacao: new Date().toISOString(),
    torneios: [] // Histórico de participação
  };

  salvarContas(contas);
  return true;
}

function logarConta(login, senha) {
  const contas = obterContas();
  const conta = contas[login];

  if (!conta || conta.senha !== hashSenha(senha)) {
    alert("❌ Login ou senha incorretos!");
    return false;
  }

  // Logar com sucesso
  usuarioLogadoAtual = login;
  idJogadorAtual = conta.id;
  ultimaAtividadeTimestamp = Date.now();
  
  localStorage.setItem(CHAVE_USUARIO_LOGADO, JSON.stringify({
    login: login,
    id: conta.id,
    timestamp: ultimaAtividadeTimestamp
  }));

  return true;
}

function verificarTimeoutSessao() {
  if (ultimaAtividadeTimestamp && (Date.now() - ultimaAtividadeTimestamp > TIMEOUT_SESSAO)) {
    deslogarUsuario();
  }
}

function deslogarUsuario() {
  usuarioLogadoAtual = null;
  idJogadorAtual = null;
  ultimaAtividadeTimestamp = null;
  localStorage.removeItem(CHAVE_USUARIO_LOGADO);
  localStorage.removeItem(CHAVE_SESSAO_ATUAL);
  
  alert("⏰ Sua sessão expirou. Faça login novamente.");
  location.reload();
}

function atualizarAtividade() {
  ultimaAtividadeTimestamp = Date.now();
}

function registrarResultadoTorneio(vencedor, sala) {
  // Registra a vitória/derrota de todos os jogadores da sala no histórico de torneios
  const contas = obterContas();
  
  sala.jogadores.forEach(jogador => {
    // Encontrar a conta associada a este jogador (por ID de dispositivo)
    let contaAssociada = null;
    
    for (let login in contas) {
      if (contas[login].id === jogador.id) {
        contaAssociada = login;
        break;
      }
    }
    
    if (contaAssociada) {
      const resultado = jogador.nome === vencedor ? "ganhou" : "perdeu";
      contas[contaAssociada].torneios.push({
        salaId: sala.id,
        salaNome: sala.nome,
        valor: sala.valor,
        resultado: resultado,
        data: new Date().toISOString()
      });
    }
  });
  
  salvarContas(contas);
}

// ========== FIM AUTENTICAÇÃO ==========

// Elementos de Autenticação
const telaAutenticacao = document.getElementById("tela-autenticacao");
const abaCadastro = document.getElementById("abaCadastro");
const abaLogin = document.getElementById("abaLogin");
const formularioCadastro = document.getElementById("formularioCadastro");
const formularioLogin = document.getElementById("formularioLogin");
const inputCadastroLogin = document.getElementById("inputCadastroLogin");
const inputCadastroSenha = document.getElementById("inputCadastroSenha");
const inputLoginUsername = document.getElementById("inputLoginUsername");
const inputLoginSenha = document.getElementById("inputLoginSenha");
const btnCadastrar = document.getElementById("btnCadastrar");
const btnLogar = document.getElementById("btnLogar");

// Telas Principais
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

// Painel de Contas
const telaContas = document.getElementById("tela-contas");
const listaContas = document.getElementById("listaContas");
const btnAbrirContas = document.getElementById("btnAbrirContas");
const voltarDoContas = document.getElementById("voltarDoContas");
const btnZerarContas = document.getElementById("btnZerarContas");

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

// ========== FUNÇÕES DE UI AUTENTICAÇÃO ==========
function mostrarFormularioCadastro() {
  formularioCadastro.style.display = "block";
  formularioLogin.style.display = "none";
  abaCadastro.classList.add("ativo");
  abaLogin.classList.remove("ativo");
}

function mostrarFormularioLogin() {
  formularioCadastro.style.display = "none";
  formularioLogin.style.display = "block";
  abaCadastro.classList.remove("ativo");
  abaLogin.classList.add("ativo");
}

function renderizarContas() {
  listaContas.innerHTML = "";
  const contas = obterContas();
  
  if (Object.keys(contas).length === 0) {
    listaContas.innerHTML = "<p style='text-align: center; color: #aaa;'>Nenhuma conta registrada</p>";
    return;
  }

  Object.values(contas).forEach(conta => {
    const div = document.createElement("div");
    div.style.cssText = "background: #2d3748; padding: 15px; margin-bottom: 10px; border-radius: 5px; border-left: 4px solid #4299e1;";
    
    // Histórico de torneios
    let historicoTexto = "Sem participações";
    if (conta.torneios && conta.torneios.length > 0) {
      const ganhos = conta.torneios.filter(t => t.resultado === "ganhou").length;
      const perdidos = conta.torneios.filter(t => t.resultado === "perdeu").length;
      historicoTexto = `${conta.torneios.length} torneios (${ganhos} ganhos, ${perdidos} perdidos)`;
      
      // Agrupar por tipo
      const porTipo = {};
      conta.torneios.forEach(t => {
        const chave = `${t.valor}`;
        if (!porTipo[chave]) porTipo[chave] = 0;
        porTipo[chave]++;
      });
      
      let detalhes = [];
      Object.entries(porTipo).forEach(([valor, qtd]) => {
        detalhes.push(`${qtd} de ${valor} reais`);
      });
      historicoTexto += ` - ${detalhes.join(", ")}`;
    }
    
    div.innerHTML = `
      <strong>ID:</strong> ${conta.id}<br>
      <strong>Login:</strong> ${conta.login}<br>
      <strong>Senha:</strong> ${conta.senhaPlana}<br>
      <strong>Participações:</strong> ${historicoTexto}<br>
      <small style="color: #aaa;">Criada em: ${new Date(conta.dataCriacao).toLocaleDateString('pt-BR')}</small>
    `;
    
    listaContas.appendChild(div);
  });
}

// ========== FIM UI AUTENTICAÇÃO ==========

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

  // Usar nome do usuário já autenticado
  if (!usuarioLogadoAtual) {
    alert("❌ Você precisa estar logado para entrar numa sala!");
    return;
  }

  nomeJogadorAtual = usuarioLogadoAtual;
  idJogadorAtual = obterOuGerarIdDispositivo();
  sessionIdAtual = gerarSessionId();

  // Se é admin, mostrar diálogo de participação
  if (adminLogado) {
    // Guardar a sala temporariamente para usar após a escolha do admin
    window.salaTemporaria = sala;
    document.getElementById("dialogoAdminParticipa").style.display = "flex";
  } else {
    // Jogador comum - entrar direto
    entrarComoJogador(sala);
  }
}

function entrarComoJogador(sala) {
  // Verificar se este ID já está na sala
  let jogadorExistente = sala.jogadores.find(j => j.id === idJogadorAtual);
  
  if (jogadorExistente) {
    // Já existe, só ativa a sessão
    jogadorExistente.sessionId = sessionIdAtual;
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

  // Continuar com entrada normal
  finalizarEntradaNaSala(sala);
}

function entrarComoModerador(sala) {
  // Admin entra apenas como moderador, sem contar como jogador
  sala.moderador = nomeJogadorAtual;
  finalizarEntradaNaSala(sala);
}

function finalizarEntradaNaSala(sala) {
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
    const idAbreviado = jogador.id.substring(0, 8);
    nome.textContent = `${jogador.nome} #${idAbreviado} ${jogador.sessionId ? '🟢' : '⚫'}`;

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
    const idAbreviado = jogador.id.substring(0, 8);
    nome.textContent = `${jogador.nome} #${idAbreviado} ${jogador.sessionId ? '🟢' : '⚫'}`;

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
        registrarResultadoTorneio(vencedor, salaAtual);
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

  const nomes = sala.jogadores.map(j => j.nome).join(", ");
  const nomeEscolhido = prompt(`Qual jogador expulsar?\n\nJogadores: ${nomes}`);
  
  if (nomeEscolhido) {
    const index = sala.jogadores.findIndex(j => j.nome === nomeEscolhido);
    if (index !== -1) {
      const jogador = sala.jogadores[index];
      sala.jogadores.splice(index, 1);
      atualizarStatusSala(sala);
      salvarSalas();
      alert(`✅ ${nomeEscolhido} foi expulso!`);
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
  if (salaAtual && idJogadorAtual) {
    if (adminLogado) {
      // Admin sai como moderador
      salaAtual.moderador = null;
    } else {
      // Jogador normal sai da lista MAS continua registrado
      // Remove apenas o sessionId (fica offline, mas continua na sala)
      const jogador = salaAtual.jogadores.find(j => j.id === idJogadorAtual);
      if (jogador) {
        jogador.sessionId = null; // Marca como offline
      }
    }
    // Atualiza status (abre se tinha fechado)
    atualizarStatusSala(salaAtual);
    salvarSalas();
  }

  // Limpa sessão atual
  localStorage.removeItem(CHAVE_SESSAO_ATUAL);

  telaSalaGerenciamento.style.display = "none";
  telaSalas.style.display = "block";
  salaAtual = null;
  nomeJogadorAtual = null;
  idJogadorAtual = null;
  sessionIdAtual = null;
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

// Detectar se jogador estava em uma sala
function verificarSessaoPersistida() {
  const sessaoSalva = localStorage.getItem(CHAVE_SESSAO_ATUAL);
  if (sessaoSalva) {
    try {
      const sessao = JSON.parse(sessaoSalva);
      const salaAnterior = salas.find(s => s.id === sessao.salaId);
      
      if (salaAnterior) {
        // Mostrar aviso
        const mensagem = `Você estava participando do torneio: "${sessao.salaNome}"\n\nDeseja voltar à sala?`;
        if (confirm(mensagem)) {
          // Reentrar na sala
          nomeJogadorAtual = sessao.jogadorNome;
          idJogadorAtual = sessao.jogadorId;
          sessionIdAtual = gerarSessionId();
          
          // Reativar sessionId do jogador
          const jogador = salaAnterior.jogadores.find(j => j.id === idJogadorAtual);
          if (jogador) {
            jogador.sessionId = sessionIdAtual;
            salvarSalas();
          }
          
          salaAtual = salaAnterior;
          telaSalas.style.display = "none";
          telaSalaGerenciamento.style.display = "block";
          renderizarGerenciamento();
        } else {
          // Usuário recusou, limpar sessão
          localStorage.removeItem(CHAVE_SESSAO_ATUAL);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar sessão persistida:", e);
      localStorage.removeItem(CHAVE_SESSAO_ATUAL);
    }
  }
}

// ========== EVENT LISTENERS AUTENTICAÇÃO ==========
abaCadastro.onclick = mostrarFormularioCadastro;
abaLogin.onclick = mostrarFormularioLogin;

btnCadastrar.onclick = () => {
  const login = inputCadastroLogin.value.trim();
  const senha = inputCadastroSenha.value;
  
  if (registrarConta(login, senha)) {
    alert(`✅ Conta "${login}" criada com sucesso!`);
    inputCadastroLogin.value = "";
    inputCadastroSenha.value = "";
    
    // Fazer login automaticamente
    usuarioLogadoAtual = login;
    const contas = obterContas();
    idJogadorAtual = contas[login].id;
    ultimaAtividadeTimestamp = Date.now();
    localStorage.setItem(CHAVE_USUARIO_LOGADO, JSON.stringify({
      login: login,
      id: contas[login].id,
      timestamp: ultimaAtividadeTimestamp
    }));
    
    // Ir para tela de salas
    telaAutenticacao.style.display = "none";
    telaSalas.style.display = "block";
    atualizarStatusAdmin();
    renderizarSalas();
  }
};

btnLogar.onclick = () => {
  const login = inputLoginUsername.value.trim();
  const senha = inputLoginSenha.value;
  
  if (logarConta(login, senha)) {
    inputLoginUsername.value = "";
    inputLoginSenha.value = "";
    
    // Ir para tela de salas
    telaAutenticacao.style.display = "none";
    telaSalas.style.display = "block";
    atualizarStatusAdmin();
    renderizarSalas();
  }
};

inputCadastroSenha.onkeypress = (e) => { if (e.key === "Enter") btnCadastrar.click(); };
inputLoginSenha.onkeypress = (e) => { if (e.key === "Enter") btnLogar.click(); };

// ========== EVENT LISTENERS PAINEL DE CONTAS ==========
btnAbrirContas.onclick = () => {
  telaPainelModeradorDireto.style.display = "none";
  telaContas.style.display = "block";
  renderizarContas();
};

voltarDoContas.onclick = () => {
  telaContas.style.display = "none";
  telaPainelModeradorDireto.style.display = "block";
};

btnZerarContas.onclick = () => {
  if (confirm("⚠️ Tem certeza que quer APAGAR TODAS as contas? Isso não pode ser desfeito!")) {
    localStorage.setItem(CHAVE_CONTAS, JSON.stringify({}));
    alert("✅ Todas as contas foram apagadas!");
    renderizarContas();
  }
};

// ========== MONITORAR TIMEOUT ==========
setInterval(verificarTimeoutSessao, 30000); // Checar a cada 30 segundos

// Atualizar atividade em qualquer clique
document.addEventListener("click", atualizarAtividade);
document.addEventListener("keypress", atualizarAtividade);

// ========== INICIALIZAÇÃO ==========
function inicializar() {
  carregarSalas();
  sincronizarAtualizacoes();
  
  // Verificar se já tem usuário logado
  const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO_LOGADO);
  if (usuarioSalvo) {
    try {
      const usuario = JSON.parse(usuarioSalvo);
      usuarioLogadoAtual = usuario.login;
      idJogadorAtual = usuario.id;
      ultimaAtividadeTimestamp = usuario.timestamp;
      
      // Ir direto para tela de salas
      telaAutenticacao.style.display = "none";
      telaSalas.style.display = "block";
      atualizarStatusAdmin();
      renderizarSalas();
      verificarSessaoPersistida();
    } catch (e) {
      console.error("Erro ao carregar usuário salvo:", e);
      localStorage.removeItem(CHAVE_USUARIO_LOGADO);
      mostrarTelaAutenticacao();
    }
  } else {
    mostrarTelaAutenticacao();
  }
}

function mostrarTelaAutenticacao() {
  telaAutenticacao.style.display = "flex";
  telaSalas.style.display = "none";
  mostrarFormularioCadastro();
}

inicializar();

