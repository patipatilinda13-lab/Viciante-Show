// ========== SISTEMA DE NOTIFICAÇÕES ==========
function mostrarToast(mensagem, duracao = 3000) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  
  toast.textContent = mensagem;
  toast.style.display = 'block';
  toast.style.animation = 'slideIn 0.3s ease-out';
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, duracao);
}


let salas = [
  {
    id: 1,
    nome: "Partida 10 reais",
    valor: 10,
    jogadores: [],
    // jogadores: [{ id: "uuid", nome: "Lucas", pagou: false, sessionId: "sess123" }]
    limite: 10,
    aberta: true,
    moderador: null
  },
  {
    id: 2,
    nome: "Partida 20 reais",
    valor: 20,
    jogadores: [],
    limite: 10,
    aberta: true,
    moderador: null
  }
];

const SENHA_ADMIN = "@@Lucas2014@@";
// ✅ localStorage agora contém APENAS dados de sessão
// Dados de contas/salas vêm SEMPRE do servidor
const CHAVE_ID_DISPOSITIVO = "vicianteshow_device_id";
const CHAVE_SESSAO_ATUAL = "vicianteshow_sessao_atual";
const CHAVE_USUARIO_LOGADO = "vicianteshow_usuario_logado";

// URL do servidor - API sempre no Render!
// Quando testar localmente, descomente a linha com localhost
const API_URL = 'https://viciante-show.onrender.com';
// const API_URL = 'http://localhost:3000'; // Descomentar apenas para testes locais

// Inicializar Socket.io
let socket = null;
function inicializarSocket() {
  // Verificar se Socket.io foi carregado
  if (typeof io === 'undefined') {
    console.error('❌ Socket.io não foi carregado ainda. Tentando novamente em 500ms');
    setTimeout(inicializarSocket, 500);
    return;
  }
  
  // ⚠️ Se socket já existe mas está desconectado, descartar e criar novo
  if (socket) {
    if (socket.connected) {
      console.log('✅ Socket já está conectado');
      return;
    } else {
      console.log('⚠️ Socket anterior desconectado, criando novo...');
      socket.removeAllListeners(); // ✅ Limpar listeners antigos
      socket.disconnect();
      socket = null;
    }
  }
  
  socket = io(API_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    forceNew: true // ✅ Força criação de novo socket
  });
  
  socket.on('connect', () => {
    console.log('🟢 Conectado ao servidor WebSocket');
    mostrarToast('✅ Conectado ao servidor');
    
    // ✅ Se estava no jogo quando desconectou, sincronizar estado
    if (telaJogo.style.display !== "none" && salaAtual) {
      console.log('🔄 Reconectado durante jogo - sincronizando estado da sala...');
      carregarSalas().then(() => {
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          ordem = salaAtual.ordem || [];
          turnoAtual = salaAtual.turnoAtual || 0;
          console.log(`✅ Estado sincronizado após reconexão - turno: ${turnoAtual}/${ordem.length}`);
          criarMaletas();
        }
      });
    } else if (telaSalas.style.display !== "none") {
      // Se estava na tela de salas, recarregar
      console.log('🔄 Reconectado - recarregando salas...');
      carregarSalas();
      renderizarSalas();
    }
  });
  
  socket.on('disconnect', (razao) => {
    console.log('🔴 Desconectado do servidor WebSocket:', razao);
    mostrarToast('❌ Desconectado do servidor - tentando reconectar...');
  });
  
  socket.on('reconnect_attempt', () => {
    console.log('🟡 Tentando reconectar...');
  });
  
  socket.on('error', (erro) => {
    console.error('❌ Erro WebSocket:', erro);
  });
  
  // Listeners para eventos em tempo real
  configurarListenersSocket();
}

let adminLogado = false;
let nomeJogadorAtual = null;
let idJogadorAtual = null;
let sessionIdAtual = null;
let usuarioLogadoAtual = null;
let ultimaAtividadeTimestamp = null;
let inicializandoSorteio = false; // 🛡️ Flag para proteger durante inicialização

// 🧹 LIMPEZA SEGURA - Remove apenas dados desnecessários
function limparCacheAntigo() {
  console.error(`🔴 [LIMPEZA] Removendo dados obsoletos de localStorage...`);
  try {
    // Remover dados desnecessários (contas/salas não devem estar no cache)
    const chavesARemover = [
      'vicianteshow_salas_storage',
      'vicianteshow_salas_antigo',
      'vicianteshow_contas_antigo',
      'vicianteshow_contas'
    ];
    
    chavesARemover.forEach(chave => {
      if (localStorage.getItem(chave)) {
        localStorage.removeItem(chave);
        console.error(`   ✅ Removido: ${chave}`);
      }
    });
    
    console.error(`✅ Cache obsoleto limpo! Mantém apenas: usuario_logado, sessao_atual, device_id`);
    return true;
  } catch (e) {
    console.error(`❌ Erro ao limpar cache:`, e);
    return false;
  }
}

// 🚨 Função de emergência - chamável via console se necessário
window.limparTudoboobs = function() {
  console.error(`🔴 LIMPEZA TOTAL ACIONADA`);
  if (confirm("⚠️ Isso vai limpar TUDO do localStorage! Tem certeza?")) {
    localStorage.clear();
    console.error(`✅ localStorage.clear() executado!`);
    console.error(`   Precisará recarregar a página...`);
    alert("✅ Cache totalmente limpo! Recarregando página...");
    setTimeout(() => location.reload(), 500);
  }
};

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

// ========== LISTENERS DO WEBSOCKET (TEMPO REAL) ==========
function configurarListenersSocket() {
  if (!socket) return;
  
  // Countdown de abertura de maletas começou
  socket.on('maletas:comecareCountdown', (dados) => {
    if (telaJogo.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
      console.log(`⏳ Recebendo sinal para iniciar countdown`);
      executarCountdownAbertura();
    }
  });
  
  // Maleta foi aberta por outro jogador
  socket.on('maleta:aberta', (dados) => {
    console.error(`🔴 [SOCKET maleta:aberta] Recebido`);
    console.error(`   Sala ID: ${dados.salaId}`);
    console.error(`   Maleta: #${dados.numeroMaleta}`);
    console.error(`   Jogador: ${dados.jogadorDaVez}`);
    console.error(`   salaAtualizada recebida: ${dados.salaAtualizada ? 'SIM' : 'NÃO'}`);
    
    if (telaJogo.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
      // ✅ OTIMIZADO: Usar dados enviados pelo servidor em vez de fazer fetch
      if (dados.salaAtualizada) {
        console.error(`✅ Usando salaAtualizada do servidor`);
        salaAtual = dados.salaAtualizada;
        maletas = salaAtual.maletas || [];
        turnoAtual = salaAtual.turnoAtual || 0;
        ordem = salaAtual.ordem || [];
      } else {
        // Fallback: carregar se não vieram dados
        console.error(`⚠️ Dados não vieram no socket, recarregando salas...`);
        carregarSalas().then(() => {
          const salaNova = salas.find(s => s.id === salaAtual.id);
          if (salaNova) {
            salaAtual = salaNova;
            maletas = salaAtual.maletas || [];
            turnoAtual = salaAtual.turnoAtual || 0;
            ordem = salaAtual.ordem || [];
          }
        });
        return;
      }
      
      console.error(`🔄 Estado sincronizado:`);
      console.error(`   turnoAtual: ${turnoAtual}/${ordem.length}`);
      console.error(`   Maletas escolhidas: ${maletas.filter(m => m.dono).length}`);
      console.error(`   Próximo jogador: ${ordem[turnoAtual] || 'NINGUÉM (todos escolheram)'}`);
      
      // Renderizar maletas com estado atualizado
      criarMaletas();
      mostrarToast(`${dados.jogadorDaVez} escolheu a maleta #${dados.numeroMaleta}!`);
      
      // Verificar se todos já escolheram
      if (turnoAtual >= ordem.length) {
        console.error(`✅ TODOS ESCOLHERAM! Iniciando countdown para abertura...`);
        mostrarToast(`✅ Todos escolheram! Abrindo maletas...`);
        // O countdown será iniciado automaticamente por iniciarCountdownAberturaMaletas
      } else {
        // Feedback visual para o próximo jogador
        const proximoJogador = ordem[turnoAtual];
        if (nomeJogadorAtual === proximoJogador) {
          mostrarToast(`🎯 É sua vez! Escolha uma maleta`, 3000);
        } else {
          mostrarToast(`⏳ Aguardando ${proximoJogador}...`, 2000);
        }
      }
    }
  });

  // Sorteio foi revelado
  socket.on('sorteio:revelado', (dados) => {
    if (telaJogo.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
      console.log(`🏆 Sorteio revelado! Vencedor: ${dados.vencedor}`);
      pararTimerEscolhaMaleta(); // Parar countdown
      sincronizarRevelacao(dados.vencedor);
    }
  });
  
  // Próxima rodada iniciada
  socket.on('sorteio:proxima', (dados) => {
    if (telaJogo.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
      console.log(`🔄 Próxima rodada iniciada`);
      carregarSalas().then(() => {
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          maletas = salaAtual.maletas || [];
          turnoAtual = salaAtual.turnoAtual || 0;
          ordem = salaAtual.ordem || [];
          
          resultado.classList.add("hidden");
          resultadoTexto.classList.remove("vitoria");
          criarMaletas();
          status.textContent = `Vez de ${ordem[turnoAtual]}`;
        }
      });
    }
  });
  
  // Jogador entrou na sala
  socket.on('sala:jogador-entrou', (dados) => {
    console.log(`👤 ${dados.jogadorNome} entrou`);
    carregarSalas().then(() => {
      // ✅ ATUALIZAR NA LIST TAMBÉM
      if (telaSalas.style.display !== "none") {
        renderizarSalas();
      }
      
      // Se está dentro da sala, atualizar gerenciamento
      if (telaSalaGerenciamento.style.display !== "none" && salaAtual) {
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          renderizarGerenciamento();
        }
      }
    });
  });
  
  // Jogador saiu da sala
  socket.on('sala:jogador-saiu', (dados) => {
    console.log(`👤 Jogador saiu`);
    carregarSalas().then(() => {
      // ✅ ATUALIZAR NA LIST TAMBÉM
      if (telaSalas.style.display !== "none") {
        renderizarSalas();
      }
      
      if (telaSalaGerenciamento.style.display !== "none" && salaAtual) {
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          renderizarGerenciamento();
        }
      }
    });
  });
  
  // ✅ NOVO: Participante adicionado
  socket.on('participante:adicionado', (dados) => {
    console.log('🎉 LISTENER RECEBEU participante:adicionado', dados);
    console.log(`✅ ${dados.jogadorNome} participou`);
    carregarSalas().then(() => {
      // Sincronizar TANTO na list QUANTO no gerenciamento
      if (telaSalas.style.display !== "none") {
        console.log('Atualizando salas na list view');
        renderizarSalas(); // Atualizar list também
      }
      
      if (telaSalaGerenciamento.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
        console.log('Atualizando salas no gerenciamento');
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          renderizarGerenciamento();
        }
      }
    });
  });
  
  // ✅ NOVO: Participante removido
  socket.on('participante:removido', (dados) => {
    console.log(`❌ ${dados.jogadorNome} saiu`);
    carregarSalas().then(() => {
      // Sincronizar TANTO na list QUANTO no gerenciamento
      if (telaSalas.style.display !== "none") {
        renderizarSalas(); // Atualizar list também
      }
      
      if (telaSalaGerenciamento.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          renderizarGerenciamento();
        }
      }
    });
  });
  
  // ✅ NOVO: Pagamento atualizado
  socket.on('jogador:pagamento-atualizado', (dados) => {
    console.log(`💳 Pagamento atualizado - ${dados.jogadorNome}: ${dados.pagou ? '✅ Pago' : '⏳ Pendente'}`);
    carregarSalas().then(() => {
      // Sincronizar em tempo real se está na tela de gerenciamento
      if (telaSalaGerenciamento.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          renderizarGerenciamento();
        }
      }
      // Se é um participante vendo a lista, também atualiza
      if (telaSalas.style.display !== "none") {
        renderizarSalas();
      }
    });
  });
  
  // ✅ NOVO: Jogador expulso
  socket.on('jogador:expulso', (dados) => {
    console.log(`🚫 Recebeu notificação de expulsão - ${dados.jogadorNome} da sala ${dados.salaId}`);
    
    // Se o jogador atual foi expulso
    if (dados.jogadorNome === nomeJogadorAtual) {
      mostrarToast("🚫 Você foi expulso da sala!");
      
      // Remover de qualquer tela e voltar para lista
      telaSalaGerenciamento.style.display = "none";
      telaJogo.style.display = "none";
      telaSalas.style.display = "block";
      
      // Recarregar salas para refletir remoção completa
      carregarSalas().then(() => {
        // Resetar salaAtual para garantir que não está mais participando
        salaAtual = null;
        renderizarSalas();
        console.log('✅ Participante removido completamente da sala');
      });
    } else {
      // Outro jogador foi expulso, atualizar lista
      carregarSalas().then(() => {
        // Se está vendo a sala no gerenciamento, atualizar
        if (telaSalaGerenciamento.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
          const salaNova = salas.find(s => s.id === salaAtual.id);
          if (salaNova) {
            salaAtual = salaNova;
            // Renderizar agora para mostrar expulsão
            renderizarGerenciamento();
            console.log(`✅ Admin vê ${dados.jogadorNome} removido`);
          }
        }
        // Se está na lista, atualizar
        if (telaSalas.style.display !== "none") {
          renderizarSalas();
        }
      });
    }
  });
  
  // ✅ NOVO: Sorteio iniciado (todos vão para tela de jogo)
  socket.on('sorteio:iniciado', (dados) => {
    console.error(`🔴 [SOCKET] 'sorteio:iniciado' recebido para sala ${dados.salaId}`);
    console.error(`   Ordem DO SERVIDOR: [${dados.ordem.join(', ')}]`);
    console.error(`   🛡️ inicializandoSorteio = ${inicializandoSorteio}`);
    
    // 🛡️ PROTEÇÃO: Se estamos inicializando, não limpe o estado ainda
    if (inicializandoSorteio) {
      console.error(`   🛡️ IGNORANDO reset porque estamos inicializando o sorteio`);
      return;
    }
    
    if (salaAtual && salaAtual.id === dados.salaId) {
      console.error(`🔴   salaAtual.turnoAtual ANTES de reset: ${salaAtual.turnoAtual}`);
      
      // ✅ RESETAR COMPLETAMENTE ESTADO ANTERIOR
      houveVencedor = false;
      resultado.classList.add("hidden");
      resultadoTexto.textContent = "";
      resultadoTexto.classList.remove("vitoria");
      pararTimerEscolhaMaleta();
      
      // ✅ LIMPAR TUDO
      maletas = [];
      turnoAtual = 0;
      maletasDiv.innerHTML = "";
      salaAtual = null; // ⚠️ Force reload de salaAtual
      
      const btnProximaRodada = document.getElementById("btnProximaRodada");
      const btnVoltar = document.getElementById("btnVoltar");
      if (btnProximaRodada) btnProximaRodada.classList.add("hidden");
      if (btnVoltar) btnVoltar.classList.add("hidden");
      console.log(`✅ Estado de resultado e maletas resetado`);
      
      carregarSalas().then(() => {
        const salaNova = salas.find(s => s.id === dados.salaId);
        if (salaNova) {
          console.error(`🔴   salaNova.turnoAtual IMEDIATAMENTE após carregarSalas(): ${salaNova.turnoAtual}`);
          console.error(`   salaNova.ordem: [${(salaNova.ordem || []).join(', ')}]`);
          console.error(`   salaNova.maletas: ${salaNova.maletas?.length || 0} maletas`);
          if (salaNova.maletas && salaNova.maletas.length > 0) {
            console.error(`   Detalhes das maletas:`);
            salaNova.maletas.forEach((m, i) => {
              console.error(`      Maleta ${i+1}: dono="${m.dono || 'null'}", premio=${m.premio}`);
            });
          }
          
          salaAtual = salaNova;
          // 🔴 CRÍTICO: Forçar reset de turnoAtual na salaAtual também!
          salaAtual.turnoAtual = 0;
          console.error(`🔴   RESET FORÇADO: salaAtual.turnoAtual = 0`);
          
          ordem = dados.ordem;
          turnoAtual = 0; // ✅ FORÇA reset de turno
          console.error(`🔴   LOCAL turnoAtual FORÇADO = ${turnoAtual}`);
          console.log(`✅ Ordem do sorteio: ${ordem.join(' → ')} [turno: ${turnoAtual}]`);
          console.log(`✅ RESET FORÇADO: salaAtual.turnoAtual = ${salaAtual.turnoAtual}`);
          
          // Ir para tela de jogo
          telaSalaGerenciamento.style.display = "none";
          telaSalas.style.display = "none";
          telaJogo.style.display = "block";
          
          // ✅ Mostrar aba "Torneio" do chat
          const btnAbaChatTorneio = document.getElementById("btnAbaChatTorneio");
          if (btnAbaChatTorneio) {
            btnAbaChatTorneio.style.display = "block";
          }
          
          criarMaletas();
          mostrarToast("🎮 Sorteio iniciado!");
          console.log('✅ Participante redirecionado para tela de jogo');
        }
      });
    }
  });

  // ✅ NOVO: Próxima rodada iniciada (sincronização global)
  socket.on('sorteio:proxima', (dados) => {
    console.log(`🔄 Próxima rodada na sala ${dados.salaId} - nova ordem: ${dados.ordem.join(', ')}`);
    
    if (salaAtual && salaAtual.id === dados.salaId) {
      // ✅ RESETAR COMPLETAMENTE ESTADO ANTERIOR
      houveVencedor = false;
      resultado.classList.add("hidden");
      resultadoTexto.textContent = "";
      resultadoTexto.classList.remove("vitoria");
      pararTimerEscolhaMaleta();
      
      // ✅ RESETAR MALETAS E TURNO
      maletas = [];
      turnoAtual = 0; // ⚠️ FORÇA reset de turno
      maletasDiv.innerHTML = "";
      
      const btnProximaRodada = document.getElementById("btnProximaRodada");
      if (btnProximaRodada) btnProximaRodada.classList.add("hidden");
      
      carregarSalas().then(() => {
        const salaNova = salas.find(s => s.id === dados.salaId);
        if (salaNova) {
          salaAtual = salaNova;
          ordem = dados.ordem;
          turnoAtual = salaAtual.turnoAtual || 0; // ✅ Sincronizar do servidor
          console.log(`✅ Nova ordem para próxima rodada: ${ordem.join(' → ')} [turno: ${turnoAtual}]`);
          
          criarMaletas();
          mostrarToast("🔄 Próxima rodada começou!");
          console.log('✅ Próxima rodada carregada');
        }
      });
    }
  });

  // ✅ NOVO: Torneio encerrado - voltar ao menu
  socket.on('torneio:encerrado', (dados) => {
    console.error(`🔴 [SOCKET torneio:encerrado] Sala ${dados.salaId}`);
    
    if (salaAtual && salaAtual.id === dados.salaId) {
      mostrarToast(`🏆 Torneio encerrado! Voltando ao menu...`);
      
      // Limpar estado local
      salaAtual = null;
      maletas = [];
      ordem = [];
      turnoAtual = 0;
      houveVencedor = false;
      
      // Voltar para tela de salas
      setTimeout(() => {
        telaJogo.style.display = "none";
        telaSalaGerenciamento.style.display = "none";
        telaSalas.style.display = "block";
        
        // Recarregar lista de salas
        carregarSalas().then(() => {
          renderizarSalas();
          console.log(`✅ Voltado para lista de salas`);
        });
      }, 2000);
    }
  });

  // ✅ NOVO: Receber mensagens de chat
  socket.on('chat:mensagem', (dados) => {
    console.log(`💬 Nova mensagem de ${dados.usuario} (${dados.tipo}):`, dados.mensagem);
    
    // Mostrar mensagem se:
    // 1. Chat está aberto E a aba ativa é a mesma, OU
    // 2. Chat está fechado (será adicionado ao contador de não lidas)
    if (drawerChatAberto && abaAtualChat === dados.tipo) {
      adicionarMensagem(dados.usuario, dados.mensagem);
    } else if (!drawerChatAberto) {
      // Só contar como não lida se a aba for a mesma
      if (abaAtualChat === dados.tipo) {
        adicionarMensagem(dados.usuario, dados.mensagem);
      }
    }
  });
}

// ========== SISTEMA DE AUTENTICAÇÃO ==========
// 🛡️ PROTEÇÃO: Mantém apenas dados de sessão no localStorage
// Dados de contas (saldo, histórico) vêm SEMPRE do servidor via fetch

function obterUsuarioLogado() {
  const usuario = localStorage.getItem(CHAVE_USUARIO_LOGADO);
  return usuario ? JSON.parse(usuario) : null;
}

function deslogarUsuario() {
  localStorage.removeItem(CHAVE_USUARIO_LOGADO);
  localStorage.removeItem(CHAVE_SESSAO_ATUAL);
  // Manter device_id para reconhecimento em futuras sessões
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

async function registrarConta(login, senha) {
  if (login.length < 6) {
    mostrarToast("❌ Login deve ter mínimo 6 caracteres");
    return false;
  }
  
  if (senha.length < 1) {
    mostrarToast("❌ Digite uma senha");
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/api/contas/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha })
    });

    const resultado = await response.json();

    if (!response.ok) {
      mostrarToast(`❌ ${resultado.erro}`);
      return false;
    }

    // Logar automaticamente após registrar
    usuarioLogadoAtual = resultado.login;
    idJogadorAtual = resultado.id;
    nomeJogadorAtual = resultado.login;
    ultimaAtividadeTimestamp = Date.now();
    
    localStorage.setItem(CHAVE_USUARIO_LOGADO, JSON.stringify({
      login: resultado.login,
      id: resultado.id,
      timestamp: ultimaAtividadeTimestamp
    }));

    mostrarToast("✅ Conta criada com sucesso!");
    return true;
  } catch (e) {
    console.error("Erro ao registrar:", e);
    mostrarToast("❌ Erro de conexão ao registrar");
    return false;
  }
}

async function logarConta(login, senha) {
  try {
    const response = await fetch(`${API_URL}/api/contas/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha })
    });

    const resultado = await response.json();

    if (!response.ok) {
      mostrarToast(`❌ ${resultado.erro}`);
      return false;
    }

    // Logar com sucesso
    usuarioLogadoAtual = resultado.login;
    idJogadorAtual = resultado.id;
    nomeJogadorAtual = resultado.login;
    ultimaAtividadeTimestamp = Date.now();
    
    localStorage.setItem(CHAVE_USUARIO_LOGADO, JSON.stringify({
      login: resultado.login,
      id: resultado.id,
      timestamp: ultimaAtividadeTimestamp
    }));

    mostrarToast("✅ Login realizado!");
    return true;
  } catch (e) {
    console.error("Erro ao logar:", e);
    mostrarToast("❌ Erro de conexão ao logar");
    return false;
  }
}

// ✅ Gerenciar visibilidade dos botões flutuantes
function gerenciarVisibilidadeBotoes(logado) {
  const containerBotoes = document.getElementById("botoesInterface");
  if (!containerBotoes) {
    console.error("❌ Container botoesInterface não encontrado!");
    return;
  }
  
  console.log(`📍 gerenciarVisibilidadeBotoes(${logado}) - Container encontrado:`, containerBotoes);
  
  if (logado) {
    containerBotoes.style.display = "block";
    console.log("✅ Botões VISÍVEIS");
    carregarPerfil();
  } else {
    containerBotoes.style.display = "none";
    console.log("❌ Botões OCULTOS");
  }
}

function deslogarUsuario() {
  // Ocultar botões flutuantes
  gerenciarVisibilidadeBotoes(false);

  usuarioLogadoAtual = null;
  idJogadorAtual = null;
  nomeJogadorAtual = null;
  ultimaAtividadeTimestamp = null;
  adminLogado = false;
  localStorage.removeItem(CHAVE_USUARIO_LOGADO);
  localStorage.removeItem(CHAVE_SESSAO_ATUAL);
  localStorage.removeItem('vicianteshow_admin_logado');
  
  // Fechar drawers
  drawerPerfilAberto = false;
  drawerChatAberto = false;
  
  mostrarToast("⏰ Sua conta foi deletada ou sessão expirou");
  
  // Voltar para tela de autenticação
  telaSalas.style.display = "none";
  telaSalaGerenciamento.style.display = "none";
  telaJogo.style.display = "none";
  telaAutenticacao.style.display = "block";
  
  document.getElementById("drawerChat").style.display = "none";
  document.getElementById("drawerPerfil").style.display = "none";
  document.getElementById("btnAbrirChat").style.display = "none";
  document.getElementById("btnAbrirPerfil").style.display = "none";
  document.getElementById("drawerBackdrop").style.display = "none";
  
  salaAtual = null;
}

// Verificar periodicamente se a conta ainda existe
function atualizarAtividade() {
  ultimaAtividadeTimestamp = Date.now();
}

function registrarResultadoTorneio(vencedor, sala) {
  // ✅ MUDADO: Agora envia para o servidor em vez de salvar no localStorage
  console.error(`🔴 [REGISTRAR RESULTADO] Enviando para servidor:`);
  console.error(`   Vencedor: ${vencedor}`);
  console.error(`   Sala: ${sala.nome} (ID: ${sala.id})`);
  console.error(`   Jogadores: ${sala.jogadores.map(j => j.nome).join(', ')}`);
  
  // Preparar dados dos jogadores para envio
  const jogadoresParaEnvio = sala.jogadores.map(j => ({
    nome: j.nome,
    id: j.id
  }));
  
  fetch(`${API_URL}/api/salas/${sala.id}/sorteio/vencedor`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vencedor: vencedor,
      jogadores: jogadoresParaEnvio
    })
  })
  .then(res => res.json())
  .then(resultado => {
    if (resultado.sucesso) {
      console.error(`✅ Resultado registrado no servidor`);
    } else {
      console.error(`❌ Erro ao registrar resultado:`, resultado.erro);
    }
  })
  .catch(e => {
    console.error(`❌ Erro ao registrar resultado no servidor:`, e);
  });
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
const btnParticipar = document.getElementById("btnParticipar");
const btnSairTorneio = document.getElementById("btnSairTorneio");
const containerParticipacao = document.getElementById("containerParticipacao");
const containerBotaoParticipacao = document.getElementById("containerBotaoParticipacao");

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
let ultimaSalvagemTimestamp = 0; // Controla debouncing de requisições
const DEBOUNCE_TEMPO = 1000; // 1 segundo antes de salvar
let pollingSalasInterval = null; // Polling para sincronizar salas entre navegadores
let pollingGerenciamentoInterval = null; // Polling para atualizar sala enquanto está em gerenciamento
let pollingJogoInterval = null; // Polling para atualizar sorteio/maletas em tempo real
let contasDoServidor = {}; // Armazena contas carregadas do servidor
let timerEscolhaMaleta = null; // Timer para auto-escolha de maleta se jogador demorar
let timerCountdownInterval = null; // Intervalo para atualizar countdown na tela

let jogadoresDoSorteio = ["Jheckson", "Lucas", "Vitor", "Luana"];
let ordem = [];
let turnoAtual = 0;
let houveVencedor = false;

const TEMPO_MAXIMO_ESCOLHA = 25000; // 25 segundos para escolher maleta

const listaOrdem = document.getElementById("listaOrdem");
const maletasDiv = document.getElementById("maletas");
const status = document.getElementById("status");
const abrirBtn = document.getElementById("abrirBtn");
const resultado = document.getElementById("resultado");
const resultadoTexto = document.getElementById("resultadoTexto");

const totalMaletas = 6;
let maletas = [];
let indicePremiada = null;

// ========== SINCRONIZAÇÃO OTIMIZADA ==========
let timeoutSalvarPendente = null;

async function salvarSalasComDebounce() {
  // Cancela requisição anterior pendente
  if (timeoutSalvarPendente) {
    clearTimeout(timeoutSalvarPendente);
  }
  
  // Retorna uma promise que resolve DEPOIS do debounce
  return new Promise((resolve) => {
    timeoutSalvarPendente = setTimeout(async () => {
      try {
        await fetch(`${API_URL}/api/salas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(salas)
        });
        resolve(); // Resolve após salvar
      } catch (e) {
        console.error("❌ Erro ao salvar salas no servidor:", e);
        // ❌ NÃO usar localStorage para salas - jogo é 100% online!
        // Se falhar, é erro real que deve ser tratado
        resolve(); // Resolve mesmo com erro
      }
    }, 1000); // 1 segundo de debounce
  });
}

async function salvarSalasImediato() {
  // Para saves imediatos (sem debounce)
  if (timeoutSalvarPendente) {
    clearTimeout(timeoutSalvarPendente);
  }
  
  try {
    await fetch(`${API_URL}/api/salas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salas)
    });
  } catch (e) {
    console.error("❌ Erro ao salvar salas no servidor:", e);
    // ❌ NÃO usar localStorage para salas - jogo é 100% online!
    throw e;  // Propagar erro para ser tratado
  }
}

async function salvarSalas() {
  // Usar debounce por padrão (evita múltiplas requisições rápidas)
  return salvarSalasComDebounce();
}

async function carregarSalas() {
  try {
    console.log(`🔄 Carregando salas do servidor...`);
    const response = await fetch(`${API_URL}/api/salas`);
    const salasDoServidor = await response.json();
    
    console.error(`🔴 Salas carregadas do servidor:`);
    console.error(`   Total: ${salasDoServidor.length} salas`);
    console.error(`   Nomes: ${salasDoServidor.map(s => s.nome).join(', ')}`);
    
    salas = salasDoServidor;
    
    salas = salasDoServidor;
    console.log(`✅ Salas carregadas com sucesso`);
  } catch (e) {
    console.error("❌ Erro ao carregar salas do servidor:", e);
    console.error(`� ERRO CRÍTICO: Falha de conexão com servidor!`);
    console.error(`   Não usando fallback localStorage (dados podem estar corrompidos)`);
    console.error(`   Tente recarregar a página ou verificar conexão com servidor`);
    salas = [];  // ✅ Array vazio, sem dados corrompidos do localStorage
  }
}

async function carregarContas() {
  try {
    const response = await fetch(`${API_URL}/api/contas?senha=${SENHA_ADMIN}`);
    const contasDoServidorTemp = await response.json();
    contasDoServidor = contasDoServidorTemp;
    return true;
  } catch (e) {
    console.error("Erro ao carregar contas:", e);
    contasDoServidor = {};
    return false;
  }
}

async function zerarContasServidor() {
  try {
    console.error(`🔴 [API] Deletando CONTAS do servidor...`);
    const response = await fetch(`${API_URL}/api/contas?senha=${SENHA_ADMIN}`, {
      method: 'DELETE'
    });
    const resultado = await response.json();
    if (resultado.sucesso) {
      console.error(`✅ Contas deletadas do servidor`);
      contasDoServidor = {};
      return true;
    }
    return false;
  } catch (e) {
    console.error("❌ Erro ao zerar contas:", e);
    return false;
  }
}

// 🧹 Função para LIMPAR SALAS (remover todos os jogadores)
async function limparSalasServidor() {
  try {
    console.error(`🔴 [API] Limpando SALAS do servidor (removendo jogadores antigos)...`);
    
    // Recarregar salas primeiro
    await carregarSalas();
    
    // Limpar jogadores de CADA sala
    for (let sala of salas) {
      sala.jogadores = [];  // Remover TODOS os jogadores
      sala.sorteioAtivo = false;
      sala.ordem = [];
      sala.maletas = [];
      sala.turnoAtual = 0;
      console.error(`   Sala ${sala.id} ("${sala.nome}"): Jogadores limpos`);
    }
    
    // Salvar salas limpas no servidor
    const response = await fetch(`${API_URL}/api/salas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salas)
    });
    
    const resultado = await response.json();
    if (resultado.sucesso || resultado.message) {
      console.error(`✅ Salas limpas e salvas no servidor`);
      return true;
    }
    return false;
  } catch (e) {
    console.error("❌ Erro ao limpar salas:", e);
    return false;
  }
}

async function apagarContaServidor(login) {
  try {
      // Exibir reconexão permanente
      const conexaoStatus = document.getElementById('conexaoStatus');
      if (conexaoStatus) conexaoStatus.style.display = 'block';
    const response = await fetch(`${API_URL}/api/contas/${login}?senha=${SENHA_ADMIN}`, {
      method: 'DELETE'
    });
    const resultado = await response.json();
    if (resultado.sucesso) {
      return true;
    }
    return false;
  } catch (e) {
    console.error("Erro ao apagar conta:", e);
    return false;
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
  // 📡 Sincronização é feita via Socket.io, não via localStorage (jogo é 100% online)
  console.log(`📡 Aguardando atualizações do servidor via Socket.io...`);
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
  const contas = contasDoServidor;
  
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
      <small style="color: #aaa;">Criada em: ${new Date(conta.dataCriacao).toLocaleDateString('pt-BR')}</small><br>
      <button class="btn-apagar-conta" data-login="${conta.login}" style="margin-top: 10px; padding: 8px 15px; background: #c53030; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🗑️ Apagar Conta</button>
    `;
    
    listaContas.appendChild(div);
    
    // Adicionar event listener ao botão de apagar
    const btnApagar = div.querySelector(".btn-apagar-conta");
    btnApagar.onclick = async () => {
      const login = btnApagar.getAttribute("data-login");
      if (confirm(`⚠️ Tem certeza que quer apagar a conta "${login}"? Isso não pode ser desfeito!`)) {
        const sucesso = await apagarContaServidor(login);
        if (sucesso) {
          alert(`✅ Conta "${login}" foi apagada!`);
          await carregarContasServidor();
          renderizarContas();
        } else {
          alert("❌ Erro ao apagar conta");
        }
      }
    };
  });
}

// ========== FIM UI AUTENTICAÇÃO ==========

// ========== FIM POLLING DE SALAS ENTRE NAVEGADORES ==========

function renderizarSalas() {
  listaSalas.innerHTML = "";

  salas.forEach(sala => {
    const div = document.createElement("div");
    div.className = "sala";

    const status = !sala.aberta ? "Fechada" : "Aberta";
    
    // Admin consegue entrar mesmo se sala estiver fechada/cheia
    const podeEntrar = adminLogado || sala.aberta;
    const botaoDisabled = podeEntrar ? "" : "disabled";

    // Verificar se o jogador está participando desta sala
    const estouParticipando = sala.jogadores.some(j => j.id === idJogadorAtual);

    // Criar título
    const titulo = document.createElement("strong");
    titulo.textContent = sala.nome;
    div.appendChild(titulo);

    // Criar quebra de linha
    div.appendChild(document.createElement("br"));

    // Criar informação de ingresso
    const infoIngresso = document.createElement("div");
    infoIngresso.textContent = `💰 Ingresso: R$${sala.valor}`;
    div.appendChild(infoIngresso);

    // Criar quebra de linha
    div.appendChild(document.createElement("br"));

    // Criar informação de jogadores
    const infoJogadores = document.createElement("div");
    infoJogadores.textContent = `👥 ${sala.jogadores.length} / ${sala.limite}`;
    div.appendChild(infoJogadores);

    // Criar quebra de linha
    div.appendChild(document.createElement("br"));

    // Criar status
    const infoStatus = document.createElement("div");
    infoStatus.textContent = `🔓 ${status}`;
    div.appendChild(infoStatus);

    // Adicionar indicador de participação se estiver participando
    if (estouParticipando) {
      const infoParticipacao = document.createElement("div");
      infoParticipacao.style.cssText = "color: #4CAF50; font-weight: bold; margin-top: 8px;";
      infoParticipacao.textContent = "✅ Você está participando";
      div.appendChild(infoParticipacao);
    }

    // Criar quebra de linha
    div.appendChild(document.createElement("br"));

    // Criar botão
    const btn = document.createElement("button");
    btn.textContent = "Entrar";
    if (botaoDisabled) btn.disabled = true;
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = "⏳ Entrando...";
      await entrarNaSala(sala.id);
      btn.disabled = false;
      btn.textContent = "Entrar";
    };
    div.appendChild(btn);

    listaSalas.appendChild(div);
  });
}

// entrar na sala
async function entrarNaSala(idSala) {
  const sala = salas.find(s => s.id === idSala);
  if (!sala) return;

  // Usar nome do usuário já autenticado
  if (!usuarioLogadoAtual) {
    mostrarToast("❌ Você precisa estar logado");
    return;
  }

  nomeJogadorAtual = usuarioLogadoAtual;
  // NÃO sobrescrever idJogadorAtual - ele já tem o ID correto do login
  // idJogadorAtual já contém o ID da conta/dispositivo persistente
  sessionIdAtual = gerarSessionId();

  // Se é admin, mostrar diálogo de participação
  if (adminLogado) {
    // Guardar a sala temporariamente para usar após a escolha do admin
    window.salaTemporaria = sala;
    document.getElementById("dialogoAdminParticipa").style.display = "flex";
  } else {
    // Jogador comum - entrar direto
    await entrarComoJogador(sala);
  }
}

async function entrarComoJogador(sala) {
  // NÃO adiciona automaticamente à lista de participantes
  // Apenas marca que está na sala com sessionId
  // O jogador só entra na lista quando clica em "Participar"
  
  // Continuar com entrada normal
  await finalizarEntradaNaSala(sala);
}

async function entrarComoModerador(sala) {
  // Admin entra apenas como moderador, sem contar como jogador
  sala.moderador = nomeJogadorAtual;
  
  // ✅ Remover admin da lista de jogadores se estiver lá
  sala.jogadores = sala.jogadores.filter(j => j.id !== idJogadorAtual);
  
  await finalizarEntradaNaSala(sala);
}

async function finalizarEntradaNaSala(sala) {
  console.error(`🔴 [ENTRAR_SALA] Entrando na sala ${sala.id} - recarregando salas do servidor...`);
  
  // 🔄 Recarregar salas do servidor para garantir dados FRESCOS
  await carregarSalas();
  
  // Obter a sala mais atualizada do servidor
  const salaNova = salas.find(s => s.id === sala.id);
  if (salaNova) {
    salaAtual = salaNova;
    console.error(`✅ Sala recarregada do servidor: ${salaNova.jogadores.map(j => j.nome).join(', ')}`);
  } else {
    salaAtual = sala;
    console.error(`⚠️ Sala não encontrada no servidor, usando dados locais`);
  }
  
  // ✅ VALIDAÇÃO CRÍTICA: salaAtual DEVE ter um id válido
  if (!salaAtual || !salaAtual.id) {
    console.error(`❌ ERRO CRÍTICO: salaAtual não tem ID após entrar-sala!`);
    console.error(`   salaAtual:`, salaAtual);
    alert("❌ ERRO: Sala sem ID. Tente entrar novamente.");
    return;
  }
  
  // Salvar sessão atual no localStorage
  const sessaoAtual = {
    salaId: salaAtual.id,
    salaNome: salaAtual.nome,
    jogadorId: idJogadorAtual,
    jogadorNome: nomeJogadorAtual,
    dataEntrada: new Date().toISOString()
  };
  localStorage.setItem(CHAVE_SESSAO_ATUAL, JSON.stringify(sessaoAtual));

  // Atualiza status da sala
  atualizarStatusSala(salaAtual);
  await salvarSalas();
  
  // Notificar outros jogadores que alguém entrou na sala
  if (socket && socket.connected) {
    socket.emit('sala:entrar', {
      salaId: salaAtual.id,
      jogadorId: idJogadorAtual,
      jogadorNome: nomeJogadorAtual
    });
  }

  telaSalas.style.display = "none";
  telaSalaGerenciamento.style.display = "block";
  renderizarGerenciamento();
}

renderizarSalas();

// ✅ NOVO: Renderizar participantes com checkboxes (para ADMIN)
function renderizarParticipantesComCheckbox() {
  listaParticipantes.innerHTML = "";
  
  if (salaAtual.jogadores.length === 0) {
    listaParticipantes.innerHTML = "<p style='text-align: center; color: #aaa;'>Nenhum participante ainda</p>";
    return;
  }
  
  salaAtual.jogadores.forEach(jogador => {
    const div = document.createElement("div");
    div.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid #ddd; margin: 5px 0; border-radius: 5px; background: #f9f9f9;";
    
    const nome = document.createElement("span");
    nome.textContent = jogador.nome;
    nome.style.fontWeight = "bold";
    
    const checkboxContainer = document.createElement("div");
    checkboxContainer.style.display = "flex";
    checkboxContainer.style.alignItems = "center";
    checkboxContainer.style.gap = "8px";
    
    const label = document.createElement("label");
    label.textContent = "Pagou";
    label.style.fontSize = "12px";
    label.style.color = "#666";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = jogador.pagou;
    checkbox.onchange = async (e) => {
      jogador.pagou = e.target.checked;
      atualizarStatusSala(salaAtual);
      await salvarSalas();
      
      // Sincronizar pagamento via Socket.io para todos os clientes
      if (socket && socket.connected) {
        socket.emit('jogador:pagamento-atualizado', {
          salaId: salaAtual.id,
          jogadorId: jogador.id,
          jogadorNome: jogador.nome,
          pagou: jogador.pagou
        });
        console.log(`📡 Pagamento de ${jogador.nome} sincronizado: ${jogador.pagou}`);
      }
    };
    
    checkboxContainer.appendChild(label);
    checkboxContainer.appendChild(checkbox);
    
    div.appendChild(nome);
    div.appendChild(checkboxContainer);
    listaParticipantes.appendChild(div);
  });
}

// ✅ NOVO: Renderizar participantes simples (para JOGADORES)
function renderizarParticipantesSimples() {
  listaParticipantes.innerHTML = "";
  
  if (salaAtual.jogadores.length === 0) {
    listaParticipantes.innerHTML = "<p style='text-align: center; color: #aaa;'>Ninguém participando ainda</p>";
    return;
  }
  
  salaAtual.jogadores.forEach(jogador => {
    const div = document.createElement("div");
    div.style.cssText = "padding: 8px; background: #f5f5f5; margin: 5px 0; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid " + (jogador.pagou ? "#2ecc71" : "#f39c12");
    
    const nome = document.createElement("span");
    nome.textContent = jogador.nome;
    nome.style.fontWeight = "bold";
    
    const status = document.createElement("span");
    status.textContent = jogador.pagou ? "✅ Pagou" : "⏳ Aguardando";
    status.style.color = jogador.pagou ? "#2ecc71" : "#f39c12";
    status.style.fontSize = "12px";
    status.style.fontWeight = "bold";
    
    div.appendChild(nome);
    div.appendChild(status);
    listaParticipantes.appendChild(div);
  });
}

// renderizar gerenciamento da sala
function renderizarGerenciamento() {
  nomeSalaGerenciamento.textContent = `${salaAtual.nome} - R$${salaAtual.valor}`;
  
  // Mostrar moderador se houver
  if (salaAtual.moderador) {
    moderadorNaSala.style.display = "block";
    
    // Verificar se admin é espectador
    const usuarioEhModerador = adminLogado && salaAtual.moderador === nomeJogadorAtual;
    const usuarioEhParticipante = salaAtual.jogadores.some(j => j.id === idJogadorAtual);
    const adminEhEspectador = usuarioEhModerador && !usuarioEhParticipante;
    
    // Atualizar texto do moderador
    const paragrafoModerador = moderadorNaSala.querySelector('p');
    if (adminEhEspectador) {
      paragrafoModerador.textContent = "👁️ Você está como Espectador";
    } else {
      paragrafoModerador.textContent = "⚙️ Moderador na Sala";
    }
  } else {
    moderadorNaSala.style.display = "none";
  }

  // Verificar se o jogador atual está participando
  const jogadorParticipando = salaAtual.jogadores.find(j => j.id === idJogadorAtual);

  if (adminLogado) {
    // Admin nunca participa, sempre vê checkboxes
    containerParticipacao.style.display = "none";
    containerBotaoParticipacao.style.display = "none";
    avisoPagamento.style.display = "block";
    iniciarSorteio.style.display = "block";
    renderizarParticipantesComCheckbox();
  } else {
    // Jogador normal
    if (jogadorParticipando) {
      // Já está participando - mostra status de pagamento
      const pagou = jogadorParticipando.pagou;
      const containerParticipacaoDiv = containerParticipacao;
      const paragrafo = containerParticipacaoDiv.querySelector('p');
      
      if (pagou) {
        // Se pagou, mostra confirmação
        containerParticipacaoDiv.style.background = "#2ecc71";
        paragrafo.textContent = "✅ Você está participando desse torneio!";
      } else {
        // Se ainda não pagou, mostra aviso
        containerParticipacaoDiv.style.background = "#f39c12";
        paragrafo.textContent = "💰 Pague o valor do ingresso para fechar sua participação";
      }
      
      containerParticipacao.style.display = "block";
      containerBotaoParticipacao.style.display = "none";
    } else {
      // Ainda não participou
      containerParticipacao.style.display = "none";
      containerBotaoParticipacao.style.display = "block";
    }
    avisoPagamento.style.display = "none";
    iniciarSorteio.style.display = "none";
    renderizarParticipantesSimples();
  }
}

function obterIdNumerico(id) {
  // Converte um ID em 4 dígitos numéricos (0000-9999)
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash; // Converter para inteiro de 32 bits
  }
  const numero = Math.abs(hash) % 10000; // Pega apenas 4 dígitos
  return String(numero).padStart(4, '0'); // Formata com 4 dígitos (ex: 0123)
}

function renderizarParticipantesSimples() {
  listaParticipantes.innerHTML = "";

  salaAtual.jogadores.forEach(jogador => {
    const div = document.createElement("div");
    div.className = "participante-item";

    const nome = document.createElement("span");
    nome.className = "participante-nome";
    const idAbreviado = obterIdNumerico(jogador.id);
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
    checkbox.onchange = async () => {
      jogador.pagou = checkbox.checked;
      await salvarSalas();
      atualizarBotaoSorteio();
      renderizarParticipantesComCheckbox();
      
      // Sincronizar pagamento via Socket.io para todos os clientes
      if (socket && socket.connected) {
        socket.emit('jogador:pagamento-atualizado', {
          salaId: salaAtual.id,
          jogadorId: jogador.id,
          jogadorNome: jogador.nome,
          pagou: jogador.pagou
        });
        console.log(`📡 Pagamento de ${jogador.nome} sincronizado: ${jogador.pagou}`);
      }
    };

    const info = document.createElement("div");
    info.className = "participante-info";

    const nome = document.createElement("span");
    nome.className = "participante-nome";
    const idAbreviado = obterIdNumerico(jogador.id);
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
  
  // Desabilitar somente se menos de 2 jogadores pagaram
  // Admin pode iniciar mesmo como espectador
  iniciarSorteio.disabled = !temMaisDeUm;
}
// ✅ LIMPEZA COMPLETA DE ESTADO DO JOGO ANTERIOR
function resetarEstadoDoJogo() {
  console.error(`🔴 [RESET] Função resetarEstadoDoJogo() foi CHAMADA`);
  console.error(`   ANTES: turnoAtual=${turnoAtual}, ordem.length=${ordem.length}`);
  
  // ✅ Resetar variáveis de ordem de jogo
  ordem = [];
  turnoAtual = 0;
  houveVencedor = false;
  
  // ✅ Resetar maletas e prêmios
  maletas = [];
  indicePremiada = null;
  
  // ✅ CRÍTICO: Resetar turnoAtual também em salaAtual se existir
  if (salaAtual) {
    salaAtual.turnoAtual = 0;
    console.error(`   ✅ salaAtual.turnoAtual = 0`);
  }
  
  console.error(`   DEPOIS: turnoAtual=${turnoAtual}, salaAtual.turnoAtual=${salaAtual ? salaAtual.turnoAtual : 'null'}`);
  
  // ✅ Limpar timers ativos
  if (timerCountdownInterval) {
    clearInterval(timerCountdownInterval);
    timerCountdownInterval = null;
  }
  
  if (timerEscolhaMaleta) {
    clearTimeout(timerEscolhaMaleta);
    timerEscolhaMaleta = null;
  }
  
  // ✅ Limpar UI completamente
  maletasDiv.innerHTML = "";
  listaOrdem.innerHTML = "";
  status.textContent = "";
  resultado.classList.add("hidden");
  resultadoTexto.textContent = "";
  resultadoTexto.classList.remove("vitoria");
  abrirBtn.style.display = "none";
  
  // ✅ Resetar dados visuais
  houveVencedor = false;
  
  console.log("✅ Estado do jogo completamente resetado");
}

function iniciarOSorteio() {
  // ✅ VALIDAÇÃO CRÍTICA: Garantir que salaAtual existe!
  if (!salaAtual || !salaAtual.id) {
    console.error(`❌ ERRO: salaAtual é null ou undefined!`);
    console.error(`   Isso significa a sala não foi carregada do servidor.`);
    console.error(`   Causas prováveis:`);
    console.error(`      1. Conexão com servidor caiu`);
    console.error(`      2. Admin entrou mas a sala não foi enviada pelo socket`);
    console.error(`      3. localStorage tem dados corrompidos (já removido nesta versão)`);
    alert("❌ ERRO: Sala não carregada. Recarregue a página e tente novamente.");
    return;  // ✅ PARA aqui em vez de quebrar!
  }
  
  console.error(`🔴 [INÍCIO] Admin clicou em "Iniciar Sorteio"`);
  console.error(`   salaAtual ANTES de refresh: id=${salaAtual.id}, jogadores=${salaAtual.jogadores.map(j => j.nome).join(', ')}`);
  
  // 🔄 Garantir que salaAtual é a versão MAIS FRESCA do servidor
  const salaNovaAtualizada = salas.find(s => s.id === salaAtual.id);
  if (salaNovaAtualizada) {
    salaAtual = salaNovaAtualizada;
    console.error(`   salaAtual DEPOIS de refresh: id=${salaAtual.id}, jogadores=${salaAtual.jogadores.map(j => j.nome).join(', ')}`);
  }
  
  const jogadoresParaSorteio = salaAtual.jogadores.filter(j => j.pagou).map(j => j.nome);
  
  if (jogadoresParaSorteio.length < 2) {
    alert("❌ Mínimo 2 jogadores com pagamento!");
    return;
  }

  console.error(`🔴 Jogadores para sorteio: [${jogadoresParaSorteio.join(', ')}]`);

  // Define os jogadores do sorteio (apenas os que pagaram)
  // Sortear a ordem AQUI no cliente, depois enviar para servidor
  ordem = [...jogadoresParaSorteio].sort(() => Math.random() - 0.5);

  console.error(`🔴 Ordem gerada: [${ordem.join(', ')}]`);

  telaSalaGerenciamento.style.display = "none";
  telaJogo.style.display = "block";

  // ✅ AGORA: Chamar iniciarSorteioNoServidor() com await para garantir conclusão
  iniciarSorteioNoServidor(ordem).then(() => {
    // ✅ APENAS DEPOIS que sorteio foi iniciado no servidor,
    // Sincronizar com Socket.io para todos os participantes
    console.error(`✅ iniciarSorteioNoServidor() completado, agora emitindo socket...`);
    console.error(`   salaAtual.id: ${salaAtual?.id}`);
    console.error(`   salaAtual.ordem: [${salaAtual?.ordem?.join(', ') || 'VAZIO'}]`);
    
    if (socket && socket.connected && salaAtual && salaAtual.id) {
      socket.emit('sorteio:iniciado', {
        salaId: salaAtual.id,
        ordem: salaAtual.ordem  // ✅ Usar ordem do servidor, não local
      });
      console.log('📺 Sorteio iniciado - notificando todos os clientes');
    } else {
      console.error(`⚠️ AVISO: Socket não conectado ou salaAtual perdido!`);
      console.error(`   socket.connected: ${socket?.connected}`);
      console.error(`   salaAtual: ${salaAtual ? 'SIM' : 'null'}`);
      console.error(`   salaAtual.id: ${salaAtual?.id}`);
    }
  }).catch((erro) => {
    console.error(`❌ Erro ao iniciar sorteio, não notificando clientes:`, erro);
  });
}

async function iniciarSorteioNoServidor(ordem) {
  try {
    // 🛡️ ATIVAR PROTEÇÃO CONTRA LISTENERS DURANTE INICIALIZAÇÃO
    inicializandoSorteio = true;
    console.error(`🛡️ 🛡️ 🛡️ PROTEÇÃO ATIVADA: inicializandoSorteio = true`);
    
    // ✅ VALIDAÇÃO: salaAtual DEVE existir nesse ponto
    if (!salaAtual || !salaAtual.id) {
      throw new Error("❌ CRÍTICO: salaAtual é null em iniciarSorteioNoServidor()");
    }
    
    // ✅ VALIDAÇÃO: ordem DEVE ter pelo menos 2 jogadores
    if (!ordem || ordem.length < 2) {
      throw new Error(`❌ CRÍTICO: ordem inválida! ordem=${JSON.stringify(ordem)}`);
    }
    
    const salaIdSeguro = salaAtual.id;  // ✅ Copiar ID para variável local para evitar race condition
    console.error(`🔴 [ENVIANDO] Ordem para servidor: [${ordem.join(', ')}]`);
    console.error(`🔴 [ENVIANDO] Para sala ID: ${salaIdSeguro}`);
    
    // ✅ PRIMEIRO: Enviar PUT para iniciar sorteio no servidor
    console.error(`🔴 [CRÍTICO] Enviando PUT para iniciar sorteio no servidor...`);
    const response = await fetch(`${API_URL}/api/salas/${salaIdSeguro}/sorteio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ordem: ordem,  // ✅ Usa o parâmetro ordem
        totalMaletas: totalMaletas
      })
    });
    
    const resultado = await response.json();
    
    if (!resultado.sucesso) {
      throw new Error(`Erro do servidor: ${resultado.erro || 'desconhecido'}`);
    }
    
    // 🔍 DEBUG CRÍTICO - SORTEIO INICIADO NO SERVIDOR
    console.error(`🔴 SORTEIO INICIADO NO SERVIDOR:`);
    console.error(`   Ordem: [${resultado.sala.ordem.join(', ')}]`);
    console.error(`   turnoAtual: ${resultado.sala.turnoAtual}`);
    console.error(`   Maletas: ${resultado.sala.maletas.length}`);
    
    // ✅ SEGUNDO: Recarregar salas para garantir sincronização
    console.error(`🔴 [CRÍTICO] Recarregando salas após PUT...`);
    await carregarSalas();
    
    // ✅ TERCEIRO: Validação pós-carregamento
    if (!salaAtual || !salaAtual.id) {
      throw new Error("❌ CRÍTICO: salaAtual virou null após carregarSalas()!");
    }
    
    // Pegar a sala MAIS FRESCA
    const salaFresca = salas.find(s => s.id === salaIdSeguro);
    if (salaFresca) {
      console.error(`🔴 Sala recarregada do servidor:`);
      console.error(`   turnoAtual: ${salaFresca.turnoAtual}`);
      console.error(`   ordem: [${(salaFresca.ordem || []).join(', ')}]`);
      console.error(`   maletas com dono: ${salaFresca.maletas.filter(m => m.dono).length}`);
    }
    
    // ✅ QUARTO: Resetar estado local e renderizar
    resetarEstadoDoJogo();
    
    // Atualizar salaAtual com o estado do servidor
    salaAtual = resultado.sala;
    criarMaletas();
    
    console.error(`✅ Sorteio iniciado com SUCESSO!`);
    
  } catch (e) {
    console.error("❌ Erro ao iniciar sorteio:", e);
    alert("❌ Erro ao iniciar sorteio: " + e.message);
  } finally {
    // 🛡️ DESATIVAR PROTEÇÃO SEMPRE, mesmo se houve erro
    inicializandoSorteio = false;
    console.error(`🛡️ 🛡️ 🛡️ PROTEÇÃO DESATIVADA: inicializandoSorteio = false`);
  }
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

// cria maletas (baseado no estado do servidor)
function criarMaletas() {
  console.error(`🔴 [CRIAR_MALETAS] Função chamada`);
  console.error(`   nomeJogadorAtual: ${nomeJogadorAtual}`);
  console.error(`   ordem (global): [${ordem.join(', ')}]`);
  console.error(`   turnoAtual: ${turnoAtual}`);
  console.error(`   salaAtual.ordem: [${salaAtual?.ordem?.join(', ') || 'undefined'}]`);
  console.error(`   salaAtual.turnoAtual: ${salaAtual?.turnoAtual}`);
  
  if (!status) {
    console.error(`❌ ERRO: Elemento 'status' (id='status') não encontrado no HTML!`);
  }
  
  // ✅ Resetar estado visual do resultado anterior
  houveVencedor = false;
  resultado.classList.add("hidden");
  resultadoTexto.textContent = "";
  resultadoTexto.classList.remove("vitoria");
  
  maletasDiv.innerHTML = "";
  
  // ✅ Carregar maletas DO SERVIDOR (com estado de escolhas já feitas)
  if (salaAtual.maletas && salaAtual.maletas.length > 0) {
    maletas = [...salaAtual.maletas]; // Usar estado do servidor
    console.error(`🔴 Maletas carregadas do servidor:`);
    salaAtual.maletas.forEach((m, i) => {
      console.error(`   Maleta ${i+1}: dono="${m.dono}", premio=${m.premio}`);
    });
  } else {
    // Fallback: criar zeradas se servidor não tem
    maletas = [];
    for (let i = 0; i < totalMaletas; i++) {
      maletas.push({
        numero: i + 1,
        dono: null,
        premio: false
      });
    }
    console.error(`⚠️ Maletas criadas zeradas (servidor não tinha estado)`);
  }
  
  // Se servidor tem ordem definida, usar isso
  if (salaAtual.ordem && salaAtual.ordem.length > 0) {
    ordem = salaAtual.ordem;
  }
  
  // ✅ SEMPRE carregar turnoAtual do servidor (evita sincronização errada)
  turnoAtual = salaAtual.turnoAtual || 0;
  
  // � FAILSAFE: Se turnoAtual >= ordem.length, forçar reset!
  // Isso não deveria acontecer, mas se acontecer é porque tem lixo de jogo anterior
  if (turnoAtual >= ordem.length && ordem.length > 0) {
    console.error(`🔴 BUG DETECTADO: turnoAtual (${turnoAtual}) >= ordem.length (${ordem.length})`);
    console.error(`   Forçando reset de turnoAtual para 0`);
    turnoAtual = 0;
    salaAtual.turnoAtual = 0;
  }
  
  // �🔍 DEBUG CRÍTICO
  console.error(`🔴 DEBUG CRÍTICO EM criarMaletas():`);
  console.error(`   turnoAtual = ${turnoAtual}`);
  console.error(`   ordem.length = ${ordem.length}`);
  console.error(`   ordem = [${ordem.join(', ')}]`);
  console.error(`   turnoAtual >= ordem.length? ${turnoAtual >= ordem.length}`);
  console.error(`   Deveria iniciar countdown? ${turnoAtual >= ordem.length}`);
  
  // NUNCA mostrar botão de abrir maleta - será automático
  abrirBtn.style.display = "none";
  
  // ⚠️ VALIDAÇÃO CRÍTICA: Se turnoAtual=0 mas maletas têm donos, FORCE CLEAN!
  if (turnoAtual === 0 && maletas.some(m => m.dono)) {
    console.error(`❌ AVISO CRÍTICO: turnoAtual=0 MAS maletas têm donos!`);
    console.error(`   Isso sinaliza dados CORROMPIDOS do servidor!`);
    console.error(`   Limpando todos os donos antigos...`);
    maletas = maletas.map(m => ({...m, dono: null}));
    console.error(`   Maletas LIMPAS ✅`);
  }

  // ✅ FILTRAR MALETAS: Se não há vencedor, mostrar apenas as que não foram escolhidas
  const maletasAMostrar = maletas.filter(maleta => {
    // Se houver vencedor (rodada terminou), mostrar todas com seus donos
    if (houveVencedor || salaAtual.revelado) {
      return true;
    }
    // Caso contrário, mostrar APENAS as que não foram escolhidas (dono === null)
    return maleta.dono === null;
  });
  
  console.error(`   Renderizando ${maletasAMostrar.length}/${maletas.length} maletas`);
  if (houveVencedor || salaAtual.revelado) {
    console.error(`   (Modo Revelação: mostrando TODAS as maletas com seus donos)`);
  } else {
    console.error(`   (Modo Jogo: escondendo maletas já escolhidas)`);
  }

  // Renderizar maletas com feedback visual claro
  maletasAMostrar.forEach((maleta, i) => {
    // Encontrar índice original para o evento de clique
    const indiceOriginal = maletas.indexOf(maleta);
    
    const div = document.createElement("div");
    div.className = "maleta";
    div.id = `maleta-${indiceOriginal}`;
    
    // Se a maleta já foi escolhida, mostrar o dono
    if (maleta.dono) {
      div.classList.add("escolhida");
      div.innerHTML = `<strong>${maleta.dono}</strong><br><small>Maleta ${maleta.numero}</small>`;
      div.style.cursor = "not-allowed";
      div.style.opacity = "0.7";
      div.style.backgroundColor = "#f0f0f0";
      // NÃO adicionar onclick se já foi escolhida
    } else {
      // Maleta disponível - clickável
      div.textContent = `Maleta ${maleta.numero}`;
      div.style.cursor = "pointer";
      div.style.opacity = "1";
      // Adicionar onclick com índice original
      div.onclick = () => escolherMaleta(indiceOriginal);
    }

    maletasDiv.appendChild(div);
  });

  // Renderizar ordem
  listaOrdem.innerHTML = "";
  ordem.forEach((nome, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}º - ${nome}`;
    listaOrdem.appendChild(li);
  });

  // Atualizar status com feedback claro
  console.error(`🔴 [VERIFICAÇÃO CRÍTICA] Se turnoAtual (${turnoAtual}) >= ordem.length (${ordem.length})? ${turnoAtual >= ordem.length}`);
  
  if (turnoAtual >= ordem.length) {
    // Todos escolheram - iniciar countdown automático
    console.error(`🔴 ⚠️ CRÍTICO: Iniciando countdown porque turnoAtual >= ordem.length`);
    console.error(`   turnoAtual=${turnoAtual}, ordem.length=${ordem.length}`);
    console.error(`   Maletas com dono: ${maletas.filter(m => m.dono).map(m => m.dono).join(', ')}`);
    status.textContent = "⏳ Abrindo maletas em...";
    status.style.color = "#ff9800";
    status.style.fontSize = "18px";
    pararTimerEscolhaMaleta(); // Parar timer se estava ativo
    iniciarCountdownAberturaMaletas();
  } else {
    const jogadorDaVez = ordem[turnoAtual];
    console.error(`🔴 [DEBUG MATCH] Comparação de jogadores:`);
    console.error(`   nomeJogadorAtual: "${nomeJogadorAtual}" (tipo: ${typeof nomeJogadorAtual}, length: ${nomeJogadorAtual ? nomeJogadorAtual.length : 'null'})`);
    console.error(`   ordem[${turnoAtual}]: "${jogadorDaVez}" (tipo: ${typeof jogadorDaVez}, length: ${jogadorDaVez ? jogadorDaVez.length : 'null'})`);
    console.error(`   ordem completa: [${ordem.join(', ')}]`);
    console.error(`   Match exato? ${nomeJogadorAtual === jogadorDaVez}`);
    console.error(`   Trim match? ${nomeJogadorAtual?.trim() === jogadorDaVez?.trim()}`);
    console.error(`   LowerCase match? ${nomeJogadorAtual?.toLowerCase() === jogadorDaVez?.toLowerCase()}`);
    
    let jogadorMatch = nomeJogadorAtual === jogadorDaVez;
    
    if (!jogadorMatch && nomeJogadorAtual && jogadorDaVez) {
      // Tentar match com trim e lowercase como fallback
      jogadorMatch = nomeJogadorAtual.toLowerCase().trim() === jogadorDaVez.toLowerCase().trim();
      if (jogadorMatch) {
        console.error(`   ✅ Match encontrado com trim/lowercase!`);
      }
    }
    
    if (jogadorMatch) {
      // É a vez do jogador atual - feedback bem visível
      status.innerHTML = `<span style="font-size: 24px; color: #4CAF50; font-weight: bold;">🎯 É SUA VEZ!</span><br><span style="font-size: 14px;">Escolha uma maleta</span>`;
      status.style.padding = "15px";
      status.style.backgroundColor = "#e8f5e9";
      status.style.borderRadius = "8px";
      status.style.border = "2px solid #4CAF50";
      console.error(`✅ Mostrando "É SUA VEZ" para ${nomeJogadorAtual}`);
    } else {
      // Aguardando outro jogador
      if (!jogadorDaVez) {
        console.error(`❌ ERRO: jogadorDaVez é undefined! ordem está vazia?`);
        status.innerHTML = `<span style="font-size: 16px; color: #f44336;">❌ ERRO: Ordem vazia ou inválida</span>`;
      } else {
        status.innerHTML = `<span style="font-size: 16px;">⏳ Aguardando <strong>${jogadorDaVez}</strong>...</span>`;
      }
      status.style.color = "#2196F3";
      status.style.backgroundColor = "transparent";
      status.style.border = "none";
      status.style.padding = "10px";
      console.error(`⏳ Mostrando "Aguardando ${jogadorDaVez}" para ${nomeJogadorAtual}`);
    }
    // Iniciar timer de 25 segundos para auto-escolher se jogador demorar
    iniciarTimerEscolhaMaleta();
  }
}

// Iniciar countdown de abertura de maletas quando todos escolhem
function iniciarCountdownAberturaMaletas() {
  console.error(`🔴 [COUNTDOWN] iniciarCountdownAberturaMaletas() CHAMADA!`);
  console.error(`   turnoAtual=${turnoAtual}, ordem.length=${ordem.length}`);
  console.error(`   turnoAtual >= ordem.length = ${turnoAtual >= ordem.length}`);
  console.error(`   Maletas com dono: ${maletas.filter(m => m.dono).length}/${maletas.length}`);
  
  // Apenas o servidor/primeiro a perceber dispara
  if (socket && socket.connected) {
    socket.emit('maletas:comecareCountdown', {
      salaId: salaAtual.id
    });
    console.error(`   ✅ Socket emit 'maletas:comecareCountdown' enviado`);
  }
}

// Executar countdown localmente (5, 4, 3, 2, 1)
function executarCountdownAbertura() {
  let contador = 5;
  
  const intervalo = setInterval(() => {
    if (contador > 0) {
      status.textContent = `⏳ Abrindo maletas em ${contador}...`;
      contador--;
    } else {
      clearInterval(intervalo);
      console.log('🎬 Abrindo maletas após countdown!');
      abrirTodasAsMaletas();
    }
  }, 1000);
}

// Abrir todas as maletas automaticamente e sincronizadamente
async function abrirTodasAsMaletas() {
  try {
    const response = await fetch(`${API_URL}/api/salas/${salaAtual.id}/sorteio/revelar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const resultado = await response.json();
    
    if (resultado.sucesso) {
      console.log('✅ Maletas reveladas no servidor, vencedor:', resultado.vencedor);
      
      // Emitir evento para sincronizar com TODOS os clientes
      if (socket && socket.connected) {
        socket.emit('sorteio:revelado', {
          salaId: salaAtual.id,
          vencedor: resultado.vencedor,
          maletas: resultado.maletas
        });
        console.log('📡 Evento sorteio:revelado emitido');
      }
      
      // Também sincronizar localmente
      carregarSalas().then(() => {
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          sincronizarRevelacao(salaNova.vencedor);
        }
      });
    }
  } catch (e) {
    console.error('❌ Erro ao revelar maletas:', e);
  }
}

// Iniciar timer de 10 segundos para auto-escolher maleta
function iniciarTimerEscolhaMaleta() {
  // Parar timer anterior se existir
  pararTimerEscolhaMaleta();
  
  const tempoEmSegundos = TEMPO_MAXIMO_ESCOLHA / 1000;
  const jogadorDaVez = ordem[turnoAtual];
  console.log(`⏲️ [iniciarTimer] ESTADO: ordem=${JSON.stringify(ordem)} | turnoAtual=${turnoAtual} | jogadorDaVez="${jogadorDaVez}" | nomeJogadorAtual="${nomeJogadorAtual}"`);
  console.log(`⏲️ Iniciando timer de ${tempoEmSegundos}s para ordem[${turnoAtual}] = "${jogadorDaVez}" (eu sou "${nomeJogadorAtual}") | Total na ordem: ${ordem.length} jogadores`);
  
  // Mostra contador decrescente (25, 24, 23... 1, 0)
  let tempoRestante = tempoEmSegundos;
  
  // Atualizar a cada segundo
  timerCountdownInterval = setInterval(() => {
    tempoRestante--;
    
    if (nomeJogadorAtual === jogadorDaVez) {
      // É a vez do jogador atual - mostrar com destaque
      if (tempoRestante > 0) {
        status.innerHTML = `<span style="font-size: 24px; color: #4CAF50; font-weight: bold;">🎯 É SUA VEZ!</span><br><span style="font-size: 16px; color: #ff9800;">⏱️ ${tempoRestante}s para escolher</span>`;
      } else {
        status.innerHTML = `<span style="font-size: 18px; color: #f44336; font-weight: bold;">⏱️ Tempo esgotado!</span>`;
      }
    } else {
      // Aguardando outro jogador
      if (tempoRestante > 0) {
        status.innerHTML = `<span style="font-size: 16px;">⏳ Aguardando <strong>${jogadorDaVez}</strong><br><small>(${tempoRestante}s restantes)</small></span>`;
      } else {
        status.innerHTML = `<span style="font-size: 16px;">⏳ Tempo esgotado para ${jogadorDaVez}...</span>`;
      }
    }
  }, 1000);
  
  // Após 25s, auto-escolher
  timerEscolhaMaleta = setTimeout(() => {
    console.log(`⚠️ Tempo esgotado! Auto-escolhendo maleta aleatória para ${jogadorDaVez}`);
    clearInterval(timerCountdownInterval);
    timerCountdownInterval = null;
    autoEscolherMaletaAleatoria();
  }, TEMPO_MAXIMO_ESCOLHA);
}

// Parar timer se jogador escolher antes do tempo esgotar
function pararTimerEscolhaMaleta() {
  if (timerEscolhaMaleta) {
    clearTimeout(timerEscolhaMaleta);
    timerEscolhaMaleta = null;
  }
  if (timerCountdownInterval) {
    clearInterval(timerCountdownInterval);
    timerCountdownInterval = null;
  }
}

// Auto-escolher uma maleta aleatória (chamado automaticamente após 10s)
async function autoEscolherMaletaAleatoria() {
  // Encontrar maletas ainda não escolhidas
  const maletasDisponiveis = maletas
    .map((m, i) => m.dono === null ? i : null)
    .filter(i => i !== null);
  
  if (maletasDisponiveis.length === 0) {
    console.log("❌ Nenhuma maleta disponível");
    return;
  }
  
  // Escolher uma aleatória
  const indexAleatorio = maletasDisponiveis[Math.floor(Math.random() * maletasDisponiveis.length)];
  
  console.log(`🎲 Escolhendo maleta ${indexAleatorio + 1} automaticamente`);
  
  // Chamar função de escolher maleta (sem validação de turno)
  try {
    const response = await fetch(`${API_URL}/api/salas/${salaAtual.id}/maleta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        numeroMaleta: indexAleatorio + 1,
        jogador: ordem[turnoAtual]
      })
    });
    
    const resultado = await response.json();
    
    if (resultado.sucesso) {
      console.log(`✅ Maleta ${indexAleatorio + 1} escolhida automaticamente para ${ordem[turnoAtual]}`);
      
      // Atualizar estado local
      salaAtual = resultado.sala;
      maletas = salaAtual.maletas;
      turnoAtual = salaAtual.turnoAtual;
      ordem = salaAtual.ordem;  // ✅ Atualizar ordem também!
      
      // Renderizar atualizado
      criarMaletas();
      
      // Emitir evento para outros jogadores
      if (socket && socket.connected) {
        socket.emit('maleta:aberta', {
          salaId: salaAtual.id,
          numeroMaleta: indexAleatorio + 1,
          jogadorDaVez: ordem[turnoAtual - 1]
        });
      }
      
      mostrarToast(`🎲 ${ordem[turnoAtual - 1]} escolheu a Maleta ${indexAleatorio + 1} (auto)`, 2000);
    } else {
      console.error("Erro ao escolher maleta automaticamente:", resultado.erro);
    }
  } catch (e) {
    console.error("Erro na auto-escolha:", e);
  }
}

// escolher maleta (sincronizar com servidor)
async function escolherMaleta(index) {
  // Verificar se o usuário é um admin espectador (moderador mas não participante)
  const usuarioEhModerador = adminLogado && salaAtual.moderador === nomeJogadorAtual;
  const usuarioEhParticipante = salaAtual.jogadores.some(j => j.id === idJogadorAtual);
  
  if (usuarioEhModerador && !usuarioEhParticipante) {
    // Admin como espectador não pode abrir maletas
    return;
  }
  
  // Verificações locais rápidas
  if (maletas[index].dono !== null) {
    console.log("Maleta já foi escolhida");
    return;
  }
  
  if (turnoAtual >= ordem.length) {
    console.log("Sorteio já terminou");
    return;
  }

  // VALIDAÇÃO CLIENT-SIDE: Verificar se é a vez do jogador (feedback imediato)
  const jogadorDaVez = ordem[turnoAtual];
  if (nomeJogadorAtual !== jogadorDaVez) {
    console.log(`Não é sua vez! Aguarde ${jogadorDaVez}`);
    status.textContent = `Aguardando ${jogadorDaVez}...`;
    return;
  }

  // ✅ Parar timer - jogador foi rápido o bastante!
  pararTimerEscolhaMaleta();

  // Enviar para servidor
  try {
    console.error(`🔴 [ESCOLHER MALETA] Cliente enviando:`);
    console.error(`   Sala ID: ${salaAtual.id}`);
    console.error(`   Maleta: ${index + 1}`);
    console.error(`   Jogador: ${nomeJogadorAtual}`);
    console.error(`   Estado local - turnoAtual: ${turnoAtual}, ordem: [${ordem.join(', ')}]`);
    
    const response = await fetch(`${API_URL}/api/salas/${salaAtual.id}/maleta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        numeroMaleta: index + 1, // Maletas são numeradas de 1 a N
        jogador: nomeJogadorAtual // Enviar nome para validação server-side rigorosa
      })
    });
    
    const resultado = await response.json();
    
    if (resultado.sucesso) {
      console.log(`✅ Maleta ${index + 1} aberta com sucesso no servidor`);
      
      // 🔍 DEBUG - Log do servidor response
      console.error(`🔴 RESPOSTA DO SERVIDOR após escolher maleta:`);
      console.error(`   servidor turnoAtual: ${resultado.sala.turnoAtual}`);
      console.error(`   servidor ordem.length: ${resultado.sala.ordem.length}`);
      console.error(`   Maletas escolhidas: ${resultado.sala.maletas.map(m => m.dono || 'vazia').join(', ')}`);
      
      // Atualizar estado local com resposta do servidor
      console.error(`🔴 ANTES: ordem=${JSON.stringify(ordem)} | turnoAtual=${turnoAtual}`);
      
      salaAtual = resultado.sala;
      maletas = salaAtual.maletas;
      turnoAtual = salaAtual.turnoAtual;
      ordem = salaAtual.ordem;  // ✅ CRÍTICO: Atualizar a ordem também!
      
      console.error(`🔴 DEPOIS: ordem=${JSON.stringify(ordem)} | turnoAtual=${turnoAtual}`);
      console.error(`   Servidor retornou turnoAtual=${resultado.sala.turnoAtual} de um total de ${resultado.sala.ordem.length} jogadores`);
      
      // Renderizar TODA a UI atualizada (garante sincronização visual)
      criarMaletas();
      console.log(`🎨 UI renderizada após abertura de maleta`);
      
      // Emitir evento WebSocket para TODOS os outros jogadores
      if (socket && socket.connected) {
        socket.emit('maleta:aberta', {
          salaId: salaAtual.id,
          numeroMaleta: index + 1,
          jogadorDaVez: nomeJogadorAtual
        });
        console.log(`📡 Evento 'maleta:aberta' emitido para outros jogadores`);
      }
      
      // Feedback visual imediato
      mostrarToast(`✅ Você escolheu a Maleta ${index + 1}!`, 2000);
      
    } else {
      console.error("❌ Erro ao abrir maleta:", resultado.erro);
      console.error(`   Resposta do servidor:`, resultado);
      console.error(`   Estado local no momento do erro - turnoAtual: ${turnoAtual}, ordem: [${ordem.join(', ')}]`);
      mostrarToast(`❌ ${resultado.erro}`, 3000);
    }
  } catch (e) {
    console.error("❌ Erro ao abrir maleta:", e);
    console.error(`   Stack:`, e.stack);
  }
}

// Sincronizar revelação de maletas - mostra animação e resultado
function sincronizarRevelacao(vencedor) {
  console.log(`🎬 Sincronizando revelação com vencedor: ${vencedor}`);
  
  // Animar suspense com tremor
  let suspenseTimeout = setTimeout(() => {
    Array.from(maletasDiv.children).forEach(div => {
      div.classList.add("tremendo");
    });
  }, 100);
  
  setTimeout(() => {
    clearTimeout(suspenseTimeout);
    
    // Mostrar prêmios (💰) e perdas (❌)
    maletas.forEach((m, i) => {
      const div = maletasDiv.children[i];
      div.classList.remove("tremendo");
      
      if (m.premio) {
        if (!div.textContent.includes("💰")) {
          div.textContent += " 💰";
        }
      } else {
        if (!div.textContent.includes("❌")) {
          div.textContent += " ❌";
        }
      }
    });
    
    // Mostrar resultado
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
        mostrarToast(`🏆 ${vencedor} venceu o sorteio!`, 5000);
        
        // ✅ FINALIZAR TORNEIO APÓS MOSTRAR RESULTADO
        setTimeout(() => {
          finalizarTorneioEFechar(vencedor);
        }, 3000);
      } else {
        houveVencedor = false;
        resultadoTexto.textContent = "😅 Ninguém venceu dessa vez!";
        btnProximaRodada.classList.remove("hidden");
        btnVoltar.classList.add("hidden");
        mostrarToast(`😅 Ninguém venceu!`, 3000);
      }
    }, 500);
    
  }, 1200);
}

// ✅ NOVO: Finalizar torneio completamente
async function finalizarTorneioEFechar(vencedor) {
  console.error(`🔴 [FINALIZAR TORNEIO] Vencedor: ${vencedor}`);
  
  if (!salaAtual || !salaAtual.id) {
    console.error(`❌ ERRO: salaAtual não existe`);
    return;
  }
  
  try {
    // ✅ PASSO 1: Chamar endpoint para limpar sorteio no servidor
    console.error(`   PASSO 1: Chamando DELETE /api/salas/${salaAtual.id}/sorteio/terminar`);
    const response = await fetch(`${API_URL}/api/salas/${salaAtual.id}/sorteio/terminar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      console.error(`   ✅ Servidor limpou o sorteio`);
    } else {
      console.error(`   ⚠️ Servidor retornou status ${response.status}`);
    }
    
    // ✅ PASSO 2: Remover todos os jogadores da sala via DELETE
    console.error(`   PASSO 2: Removendo jogadores da sala`);
    if (salaAtual.jogadores && salaAtual.jogadores.length > 0) {
      salaAtual.jogadores = [];
      const responseJogadores = await fetch(`${API_URL}/api/salas/${salaAtual.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salaAtual)
      });
      console.error(`   ✅ Jogadores removidos (status: ${responseJogadores.status})`);
    }
    
    // ✅ PASSO 3: Emitir socket para todos voltarem ao menu
    console.error(`   PASSO 3: Emitindo torneio:encerrado via socket`);
    if (socket && socket.connected) {
      socket.emit('torneio:encerrado', {
        salaId: salaAtual.id,
        vencedor: vencedor
      });
      console.error(`   ✅ Socket emitido`);
    }
    
    // ✅ PASSO 4: Limpar estado local e voltar após 3 segundos
    console.error(`   PASSO 4: Voltando ao menu em 3 segundos...`);
    setTimeout(() => {
      salaAtual = null;
      maletas = [];
      ordem = [];
      turnoAtual = 0;
      houveVencedor = false;
      
      telaJogo.style.display = "none";
      telaSalaGerenciamento.style.display = "none";
      telaSalas.style.display = "block";
      
      // Recarregar lista de salas
      carregarSalas().then(() => {
        renderizarSalas();
        console.log(`✅ Voltado para lista de salas`);
      });
    }, 3000);
    
  } catch (e) {
    console.error(`❌ ERRO ao finalizar torneio:`, e);
    // Mesmo com erro, tentar voltar
    setTimeout(() => {
      voltar();
    }, 2000);
  }
}

// Remover todos os jogadores da sala quando torneio termina
async function removerTodosDaTorneio() {
  if (!salaAtual || salaAtual.jogadores.length === 0) {
    console.log("⚠️ Nenhum jogador para remover");
    voltar();
    return;
  }
  
  console.log(`🚫 Removendo ${salaAtual.jogadores.length} jogadores do torneio...`);
  
  try {
    // Fazer uma cópia dos nomes dos jogadores antes de limpar
    const jogadoresARemover = [...salaAtual.jogadores];
    
    // Remover todos do array
    salaAtual.jogadores = [];
    atualizarStatusSala(salaAtual);
    await salvarSalasImediato();
    
    // Emitir evento para cada jogador ser notificado
    jogadoresARemover.forEach(jogador => {
      if (socket && socket.connected) {
        socket.emit('jogador:expulso', {
          salaId: salaAtual.id,
          jogadorNome: jogador.nome,
          jogadorId: jogador.id
        });
        console.log(`📡 Notificação de remoção enviada para ${jogador.nome}`);
      }
    });
    
    // Aguardar um pouco antes de voltar
    setTimeout(() => {
      console.log(`✅ Todos removidos! Voltando para salas...`);
      voltar();
    }, 1000);
    
  } catch (e) {
    console.error("❌ Erro ao remover jogadores:", e);
    voltar();
  }
}

// abrir maletas
abrirBtn.onclick = async () => {
  abrirBtn.disabled = true; // Desabilitar enquanto processa
  
  try {
    // Chamar servidor para revelar
    const response = await fetch(`${API_URL}/api/salas/${salaAtual.id}/sorteio/revelar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const respostaServidor = await response.json();
    
    if (respostaServidor.sucesso) {
      // Atualizar estado local
      salaAtual = respostaServidor.sala;
      maletas = salaAtual.maletas;
      
      let vencedor = respostaServidor.vencedor;
      
      // Chamar função de sincronização (agora reutilizável)
      sincronizarRevelacao(vencedor);
    }
  } catch (e) {
    console.error("Erro ao revelar sorteio:", e);
    alert("❌ Erro ao revelar resultado");
  } finally {
    abrirBtn.disabled = false;
  }
};

// próxima rodada
async function proximaRodada() {
  resultado.classList.add("hidden");
  resultadoTexto.classList.remove("vitoria");
  
  try {
    // Voltar para gerenciamento para escolher jogadores novamente
    // Se quiser próxima rodada automática com mesmos jogadores:
    const jogadoresParaSorteio = salaAtual.jogadores.filter(j => j.pagou).map(j => j.nome);
    
    if (jogadoresParaSorteio.length < 2) {
      alert("❌ Mínimo 2 jogadores com pagamento!");
      return;
    }
    
    // Sortear nova ordem
    const novaOrdem = [...jogadoresParaSorteio].sort(() => Math.random() - 0.5);
    
    // Chamar servidor para iniciar próxima rodada
    const response = await fetch(`${API_URL}/api/salas/${salaAtual.id}/sorteio/proxima`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ordem: novaOrdem,
        totalMaletas: totalMaletas
      })
    });
    
    const respostaServidor = await response.json();
    
    if (respostaServidor.sucesso) {
      // Atualizar estado
      salaAtual = respostaServidor.sala;
      ordem = salaAtual.ordem;
      turnoAtual = salaAtual.turnoAtual;
      maletas = salaAtual.maletas;
      
      // Emitir evento WebSocket para outros jogadores
      if (socket && socket.connected) {
        socket.emit('sorteio:proxima', {
          salaId: salaAtual.id,
          ordem: ordem,
          maletas: maletas
        });
      }
      
      // Renderizar maletas
      criarMaletas();
    } else {
      alert("❌ Erro ao iniciar próxima rodada");
    }
  } catch (e) {
    console.error("Erro ao iniciar próxima rodada:", e);
    alert("❌ Erro ao iniciar próxima rodada");
  }
}

// reset
function resetar() {
  resultado.classList.add("hidden");
  resultadoTexto.classList.remove("vitoria");
  
  // Limpar timer se existir
  const timerElement = document.getElementById("timerCleanup");
  if (timerElement) {
    timerElement.remove();
  }
  
  // Fechar drawers ao retornar às salas
  if (drawerPerfilAberto) fecharDrawerPerfil();
  if (drawerChatAberto) fecharDrawerChat();
  
  // Terminar sorteio no servidor ANTES de limpar
  if (salaAtual && salaAtual.id) {
    fetch(`${API_URL}/api/salas/${salaAtual.id}/sorteio/terminar`, {
      method: 'PUT'
    }).catch(e => console.error("Erro ao terminar sorteio:", e));
  }
  
  telaJogo.style.display = "none";
  telaSalas.style.display = "block";
  salaAtual = null;
  houveVencedor = false;
  nomeJogadorAtual = null;
  idJogadorAtual = null; // Limpar ID do jogador também
  atualizarStatusAdmin();
  renderizarSalas();

}

// ADMIN SECRETO
function autenticarAdmin() {
  const senha = senhaAdminInput.value;
  
  if (senha === SENHA_ADMIN) {
    senhaAdminInput.value = "";
    adminLogado = true;
    // ✅ PERSISTIR ADMIN STATUS
    localStorage.setItem('vicianteshow_admin_logado', 'true');
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
      
      // REMOVER do array
      sala.jogadores.splice(index, 1);
      
      // ATUALIZAR status e SALVAR
      atualizarStatusSala(sala);
      salvarSalasImediato();
      
      alert(`✅ ${nomeEscolhido} foi expulso!`);
      
      // EMITIR evento de expulsão para o jogador ser notificado e vai para tela de salas
      if (socket && socket.connected) {
        socket.emit('jogador:expulso', {
          salaId: idSala,
          jogadorNome: nomeEscolhido,
          jogadorId: jogador.id
        });
        console.log(`🚫 ${nomeEscolhido} expulso - emitindo jogador:expulso`);
      }
      
      renderizarPainelModerador();
      renderizarSalas();
    } else {
      alert("❌ Jogador não encontrado!");
    }
  }
}

// Função genérica para remover jogador da sala E do torneio
function removerJogadorDaTorneio(salaId, jogadorId, jogadorNome) {
  const sala = salas.find(s => s.id === salaId);
  if (!sala) return;
  
  // Remove o jogador da lista de participantes da sala
  sala.jogadores = sala.jogadores.filter(j => j.id !== jogadorId);
  
  // Atualizar status da sala (abrir/fechar conforme necessário)
  atualizarStatusSala(sala);
  
  // Salvar imediatamente
  salvarSalasImediato();
  
  // Emitir evento para todas as telas se sincronizarem
  if (socket && socket.connected) {
    socket.emit('participante:removido', {
      salaId: salaId,
      jogadorId: jogadorId,
      jogadorNome: jogadorNome
    });
    console.log(`🚫 ${jogadorNome} removido do torneio via participante:removido`);
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
voltarGerenciamento.onclick = async () => {
  voltarGerenciamento.disabled = true;
  voltarGerenciamento.textContent = "⏳ Voltando...";
  
  // ✅ LIMPAR ESTADO DO JOGO QUANDO VOLTA
  resetarEstadoDoJogo();
  
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
    await salvarSalas(); // ← Aguarda conclusão de salvar
  }

  // Limpa sessão atual
  localStorage.removeItem(CHAVE_SESSAO_ATUAL);

  telaSalaGerenciamento.style.display = "none";
  telaSalas.style.display = "block";
  
  // Recarrega as salas para sincronizar com o servidor
  await carregarSalas();
  renderizarSalas();
  
  salaAtual = null;
  nomeJogadorAtual = null;
  // NÃO zera idJogadorAtual - mantém o ID do dispositivo para reconhecimento nas salas
  sessionIdAtual = null;
  
  voltarGerenciamento.disabled = false;
  voltarGerenciamento.textContent = "← Voltar";
};

// Event listeners para o sistema de participação
btnParticipar.onclick = async () => {
  // ✅ Admin NÃO pode participar como jogador
  if (!salaAtual || !usuarioLogadoAtual || adminLogado) {
    if (adminLogado) {
      mostrarToast("❌ Admin não pode participar como jogador");
    }
    return;
  }
  
  btnParticipar.disabled = true;
  const textAnterior = btnParticipar.textContent;
  btnParticipar.textContent = "⏳ Participando...";

  // Adiciona o jogador à lista
  const jogadorExistente = salaAtual.jogadores.find(j => j.id === idJogadorAtual);
  if (!jogadorExistente) {
    salaAtual.jogadores.push({
      id: idJogadorAtual,
      nome: usuarioLogadoAtual,
      pagou: false,
      sessionId: sessionIdAtual
    });
  }

  atualizarStatusSala(salaAtual);
  
  // ✅ ETAPA 2: Usar IMEDIATO em vez de debounce para ações críticas
  await salvarSalasImediato();
  
  // ✅ EMITIR EVENTO VIA SOCKET
  console.log('✅ Jogador adicionado ao torneio:', usuarioLogadoAtual);
  
  if (socket && socket.connected) {
    socket.emit('participante:adicionado', {
      salaId: salaAtual.id,
      jogadorId: idJogadorAtual,
      jogadorNome: usuarioLogadoAtual
    });
  }
  
  renderizarGerenciamento();
  mostrarToast(`✅ Você entrou no torneio!`);
  
  btnParticipar.disabled = false;
  btnParticipar.textContent = textAnterior;
};


btnSairTorneio.onclick = async () => {
  if (!salaAtual || !idJogadorAtual) return;
  
  btnSairTorneio.disabled = true;
  btnSairTorneio.textContent = "⏳ Saindo...";

  // Remove o jogador da lista de participantes
  salaAtual.jogadores = salaAtual.jogadores.filter(j => j.id !== idJogadorAtual);

  atualizarStatusSala(salaAtual);
  
  // ✅ ETAPA 2: Usar IMEDIATO em vez de debounce para ações críticas
  await salvarSalasImediato();
  
  // ✅ EMITIR EVENTO VIA SOCKET (participante:removido para simples sincronização)
  if (socket && socket.connected) {
    socket.emit('participante:removido', {
      salaId: salaAtual.id,
      jogadorId: idJogadorAtual,
      jogadorNome: usuarioLogadoAtual
    });
  }
  
  renderizarGerenciamento();
  
  btnSairTorneio.disabled = false;
  btnSairTorneio.textContent = "🚪 Sair do Torneio";
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

// ========== EVENT LISTENERS AUTENTICAÇÃO ===========
abaCadastro.onclick = mostrarFormularioCadastro;
abaLogin.onclick = mostrarFormularioLogin;

btnCadastrar.onclick = async () => {
  console.log("🔐 [CADASTRO] Iniciando cadastro...");
  const login = inputCadastroLogin.value.trim();
  const senha = inputCadastroSenha.value;
  
  if (!login || !senha) {
    mostrarToast("❌ Preencha todos os campos");
    return;
  }
  
  btnCadastrar.disabled = true;
  btnCadastrar.textContent = "⏳ Registrando...";
  
  try {
    if (await registrarConta(login, senha)) {
      inputCadastroLogin.value = "";
      inputCadastroSenha.value = "";
      
      // Inicializar WebSocket
      try {
        inicializarSocket();
        console.log('✅ Socket inicializado após cadastro');
      } catch (e) {
        console.error('❌ Erro ao inicializar socket:', e);
      }
      
      // Ir para tela de salas
      telaAutenticacao.style.display = "none";
      telaSalas.style.display = "block";
      document.getElementById("drawerChat").style.display = "none";
      console.log("✅ [CADASTRO] Cadastro bem-sucedido! Chamando gerenciarVisibilidadeBotoes(true)");
      gerenciarVisibilidadeBotoes(true); // ✅ Mostrar botões quando logado
      atualizarStatusAdmin();
      await carregarSalas();
      renderizarSalas();
      carregarPerfil(); // ✅ Carregar HUD de perfil
    }
  } catch (e) {
    console.error('❌ Erro ao registrar:', e);
    mostrarToast('❌ Erro ao registrar. Veja o console para detalhes.');
  } finally {
    btnCadastrar.disabled = false;
    btnCadastrar.textContent = "Registrar";
  }
};

btnLogar.onclick = async () => {
  console.log("🔐 [LOGIN] Iniciando login...");
  const login = inputLoginUsername.value.trim();
  const senha = inputLoginSenha.value;
  
  if (!login || !senha) {
    mostrarToast("❌ Preencha todos os campos");
    return;
  }
  
  btnLogar.disabled = true;
  btnLogar.textContent = "⏳ Entrando...";
  
  try {
    if (await logarConta(login, senha)) {
      inputLoginUsername.value = "";
      inputLoginSenha.value = "";
      
      // Inicializar WebSocket
      try {
        inicializarSocket();
        console.log('✅ Socket inicializado após login');
      } catch (e) {
        console.error('❌ Erro ao inicializar socket:', e);
      }
      
      // Ir para tela de salas
      telaAutenticacao.style.display = "none";
      telaSalas.style.display = "block";
      document.getElementById("drawerChat").style.display = "none";
      console.log("✅ [LOGIN] Login bem-sucedido! Chamando gerenciarVisibilidadeBotoes(true)");
      gerenciarVisibilidadeBotoes(true); // ✅ Mostrar botões quando logado
      atualizarStatusAdmin();
      await carregarSalas();
      renderizarSalas();
      carregarPerfil(); // ✅ Carregar HUD de perfil
    }
  } catch (e) {
    console.error('❌ Erro ao logar:', e);
    mostrarToast('❌ Erro ao logar. Veja o console para detalhes.');
  } finally {
    btnLogar.disabled = false;
    btnLogar.textContent = "Logar";
  }
};

inputCadastroSenha.onkeypress = (e) => { if (e.key === "Enter") btnCadastrar.click(); };
inputLoginSenha.onkeypress = (e) => { if (e.key === "Enter") btnLogar.click(); };

// ========== EVENT LISTENERS PAINEL DE CONTAS ==========
btnAbrirContas.onclick = async () => {
  telaPainelModeradorDireto.style.display = "none";
  telaContas.style.display = "block";
  await carregarContas();
  renderizarContas();
};

voltarDoContas.onclick = () => {
  telaContas.style.display = "none";
  telaPainelModeradorDireto.style.display = "block";
};

btnZerarContas.onclick = async () => {
  if (confirm("⚠️ Tem certeza que quer APAGAR TODAS as contas E dados de teste? Isso não pode ser desfeito!")) {
    console.error(`🔴 Admin clicou em ZERAR CONTAS - limpando tudo...`);
    
    // 🧹 Limpar cache antigo PRIMEIRO
    limparCacheAntigo();
    
    // Aguardar 500ms para garantir limpeza
    await new Promise(r => setTimeout(r, 500));
    
    // 🔴 Limpar SALAS no servidor (remover jogadores antigos)
    const sucessoSalas = await limparSalasServidor();
    
    // Aguardar um pouco
    await new Promise(r => setTimeout(r, 300));
    
    // 🔴 Zerar CONTAS no servidor
    const sucessoContas = await zerarContasServidor();
    
    if (sucessoSalas && sucessoContas) {
      console.error(`✅ TUDO LIMPO: Cache, Salas e Contas!`);
      alert("✅ Cache antigo removido!\n✅ Salas limpas de jogadores antigos!\n✅ Todas as contas foram apagadas!\n\nRecarregue a página para começar fresco.");
      
      // Recarregar página após 2 segundos
      setTimeout(() => {
        location.reload();
      }, 2000);
    } else {
      alert("⚠️ Houve um erro ao limpar. Status:\n- Salas: " + (sucessoSalas ? "✅" : "❌") + "\n- Contas: " + (sucessoContas ? "✅" : "❌"));
    }
  }
};

// ========== DIÁLOGO ADMIN PARTICIPAÇÃO ==========
const dialogoAdminParticipa = document.getElementById("dialogoAdminParticipa");
const btnAdminSim = document.getElementById("btnAdminSim");
const btnAdminNao = document.getElementById("btnAdminNao");

btnAdminSim.onclick = async () => {
  dialogoAdminParticipa.style.display = "none";
  const sala = window.salaTemporaria;
  window.salaTemporaria = null;
  await entrarComoJogador(sala); // ✅ Aguardar promise
};

btnAdminNao.onclick = async () => {
  dialogoAdminParticipa.style.display = "none";
  const sala = window.salaTemporaria;
  window.salaTemporaria = null;
  await entrarComoModerador(sala); // ✅ Aguardar promise
};

// ========== BOTÃO DESLOGAR ==========
const btnDeslogar = document.getElementById("btnDeslogar");
btnDeslogar.onclick = () => {
  if (confirm("Tem certeza que quer deslogar?")) {
    deslogarUsuario();
  }
};

// ========== MONITORAR ATIVIDADE DO USUÁRIO ==========
// Atualizar atividade em qualquer clique
document.addEventListener("click", atualizarAtividade);
document.addEventListener("keypress", atualizarAtividade);

// ========== INICIALIZAÇÃO ==========
function inicializar() {
  console.log("🚀 Inicializando aplicação...");
  carregarSalas();
  
  const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO_LOGADO);
  if (usuarioSalvo) {
    console.log("📍 Usuário salvo encontrado, entrando automaticamente...");
    try {
      const usuario = JSON.parse(usuarioSalvo);
      usuarioLogadoAtual = usuario.login;
      idJogadorAtual = usuario.id;
      
      inicializarSocket();
      
      // ✅ ESSA LINHA É A CHAVE: ativa os botões se o cara já estiver logado
      console.log("✅ Ativando botões para usuário salvo");
      gerenciarVisibilidadeBotoes(true); 

      telaAutenticacao.style.display = "none";
      telaSalas.style.display = "block";
      atualizarStatusAdmin();
      renderizarSalas();
      carregarPerfil(); 
    } catch (e) {
      console.error("❌ Erro ao restaurar sessão:", e);
      localStorage.removeItem(CHAVE_USUARIO_LOGADO);
      mostrarTelaAutenticacao();
    }
  } else {
    console.log("📍 Nenhum usuário salvo, mostrando tela de autenticação");
    mostrarTelaAutenticacao();
  }
  
  sincronizarAtualizacoes();
}

function mostrarTelaAutenticacao() {
  console.warn("⚠️ VOLTANDO PARA TELA DE AUTENTICAÇÃO - Botões serão ocultados");
  telaAutenticacao.style.display = "flex";
  telaSalas.style.display = "none";
  // Ocultar drawers quando não logado
  document.getElementById("drawerChat").style.display = "none";
  document.getElementById("drawerPerfil").style.display = "none";
  document.getElementById("drawerBackdrop").style.display = "none";
  gerenciarVisibilidadeBotoes(false); // ✅ Ocultar botões via função centralizada
  mostrarFormularioCadastro();
}

inicializar();

// ========== SISTEMA DE PERFIL DO JOGADOR ==========
let perfilUsuario = {
  foto: "f1",
  pensamentoDoDia: "",
  torneiosVencidos: 0
};

function carregarPerfil() {
  if (!usuarioLogadoAtual) return;
  
  // Carregar foto e pensamento do localStorage (local)
  const perfilLocal = localStorage.getItem(`perfil_${usuarioLogadoAtual}`);
  if (perfilLocal) {
    perfilUsuario = JSON.parse(perfilLocal);
  }
  
  // Carregar dados do servidor (torneios vencidos)
  fetch(`${API_URL}/api/perfil/${usuarioLogadoAtual}`)
    .then(r => r.json())
    .then(dados => {
      if (dados.foto) perfilUsuario.foto = dados.foto;
      if (dados.pensamentoDoDia) perfilUsuario.pensamentoDoDia = dados.pensamentoDoDia;
      if (dados.torneiosVencidos !== undefined) perfilUsuario.torneiosVencidos = dados.torneiosVencidos;
      
      exibirHudPerfil();
      console.log('✅ Perfil carregado:', perfilUsuario);
    })
    .catch(e => console.error('❌ Erro ao carregar perfil:', e));
}

function exibirHudPerfil() {
  // Atualizar foto
  const fotoPerfil = document.getElementById("fotoPerfil");
  if (fotoPerfil) {
    fotoPerfil.src = "perfil/" + perfilUsuario.foto + ".png";
    fotoPerfil.onclick = carregarGridFotos; // Clicar na foto = abrir seletor de fotos
  }
  
  // Atualizar nome
  const nomePerfil = document.getElementById("nomePerfil");
  if (nomePerfil) {
    nomePerfil.textContent = usuarioLogadoAtual;
  }
  
  // Atualizar pensamento
  const pensamentoPerfil = document.getElementById("pensamentoPerfil");
  if (pensamentoPerfil) {
    pensamentoPerfil.textContent = perfilUsuario.pensamentoDoDia || '"Clique para adicionar..."';
  }
  
  // Atualizar torneios vencidos
  const torneiosVencidos = document.getElementById("torneiosVencidos");
  if (torneiosVencidos) {
    torneiosVencidos.textContent = perfilUsuario.torneiosVencidos || 0;
  }
  
  console.log('✅ Perfil exibido no drawer');
}

// ========== SISTEMA DE DRAWERS (GAVETAS) ==========

let drawerPerfilAberto = false;
let drawerChatAberto = false;
let abaAtualChat = "global";
let mensagensNaoLidas = 0;

// ===== DRAWER DE PERFIL =====
function abrirDrawerPerfil() {
  drawerPerfilAberto = true;
  
  // Abrir drawer
  const drawer = document.getElementById("drawerPerfil");
  const backdrop = document.getElementById("drawerBackdrop");
  
  if (drawer) {
    drawer.style.display = "flex";
    drawer.classList.remove("fechar");
  }
  if (backdrop) {
    backdrop.style.display = "block";
  }
  // NÃO chamar carregarGridFotos aqui - só quando clicar na foto!
}

function fecharDrawerPerfil() {
  drawerPerfilAberto = false;
  
  const drawer = document.getElementById("drawerPerfil");
  const backdrop = document.getElementById("drawerBackdrop");
  
  if (drawer) {
    drawer.classList.add("fechar");
    setTimeout(() => {
      drawer.style.display = "none";
      drawer.classList.remove("fechar");
    }, 300);
  }
  
  if (backdrop && !drawerChatAberto) {
    backdrop.style.display = "none";
  }
}

function carregarGridFotos() {
  // Criar modal de fotos dentro do drawer
  let existente = document.getElementById("modalFotosDrawer");
  if (existente) {
    existente.style.display = "flex";
    return;
  }
  
  const modalDiv = document.createElement("div");
  modalDiv.id = "modalFotosDrawer";
  modalDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.8);
    z-index: 2000;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  `;
  
  const container = document.createElement("div");
  container.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    border: 2px solid #00d4ff;
    border-radius: 12px;
    padding: 20px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  const titulo = document.createElement("h2");
  titulo.textContent = "Escolha sua Foto de Perfil";
  titulo.style.cssText = "color: #00d4ff; text-align: center; margin-top: 0;";
  container.appendChild(titulo);
  
  const grid = document.createElement("div");
  grid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; margin-bottom: 20px;";
  
  for (let i = 1; i <= 15; i++) {
    const nomeArquivo = `f${i}`;
    const div = document.createElement("div");
    div.onclick = () => selecionarFoto(nomeArquivo);
    div.style.cssText = `
      cursor: pointer;
      border: 3px solid ${perfilUsuario.foto === nomeArquivo ? "#00ff00" : "rgba(0, 212, 255, 0.3)"};
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.2s;
      padding: 4px;
      background: rgba(0, 212, 255, 0.05);
    `;
    
    div.onmouseover = () => {
      div.style.transform = "scale(1.1)";
      div.style.boxShadow = "0 0 15px rgba(0, 212, 255, 0.5)";
    };
    
    div.onmouseout = () => {
      div.style.transform = "scale(1)";
      div.style.boxShadow = "none";
    };
    
    const img = document.createElement("img");
    img.src = "perfil/" + nomeArquivo + ".png";
    img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
    
    if (perfilUsuario.foto === nomeArquivo) {
      const checkmark = document.createElement("div");
      checkmark.innerHTML = "✓";
      checkmark.style.cssText = `
        position: absolute;
        top: -10px;
        right: -10px;
        background: #00ff00;
        color: #000;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
      `;
      div.style.position = "relative";
    }
    
    div.appendChild(img);
    grid.appendChild(div);
  }
  
  container.appendChild(grid);
  
  const btnFechar = document.createElement("button");
  btnFechar.textContent = "✕ Fechar";
  btnFechar.style.cssText = `
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #f44336, #d32f2f);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    font-size: 14px;
    transition: all 0.3s;
  `;
  btnFechar.onmouseover = () => {
    btnFechar.style.transform = "translateY(-2px)";
    btnFechar.style.boxShadow = "0 6px 12px rgba(244, 67, 54, 0.4)";
  };
  btnFechar.onmouseout = () => {
    btnFechar.style.transform = "translateY(0)";
    btnFechar.style.boxShadow = "none";
  };
  btnFechar.onclick = () => {
    modalDiv.style.display = "none";
  };
  
  container.appendChild(btnFechar);
  modalDiv.appendChild(container);
  document.body.appendChild(modalDiv);
}

async function selecionarFoto(nomeArquivo) {
  try {
    const resposta = await fetch(`${API_URL}/api/perfil/${usuarioLogadoAtual}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foto: nomeArquivo })
    });
    
    if (resposta.ok) {
      perfilUsuario.foto = nomeArquivo;
      localStorage.setItem(`perfil_${usuarioLogadoAtual}`, JSON.stringify(perfilUsuario));
      
      const fotoPerfil = document.getElementById("fotoPerfil");
      if (fotoPerfil) fotoPerfil.src = "perfil/" + nomeArquivo + ".png";
      
      mostrarToast("✅ Foto atualizada!");
      
      // Sincronizar com socket
      if (socket && socket.connected) {
        socket.emit('perfil:atualizar', {
          usuario: usuarioLogadoAtual,
          foto: nomeArquivo,
          pensamentoDoDia: perfilUsuario.pensamentoDoDia
        });
      }
      
      // Recarregar grid para atualizar checkmark
      const modal = document.getElementById("modalFotosDrawer");
      if (modal) modal.remove();
      carregarGridFotos();
    }
  } catch (e) {
    console.error('❌ Erro ao atualizar foto:', e);
    mostrarToast('❌ Erro ao atualizar foto');
  }
}

// ===== DRAWER DE CHAT =====
function abrirDrawerChat() {
  drawerChatAberto = true;
  mensagensNaoLidas = 0;
  
  const drawer = document.getElementById("drawerChat");
  const backdrop = document.getElementById("drawerBackdrop");
  const badge = document.getElementById("badgeMensagensNaoLidas");
  
  if (drawer) {
    drawer.style.display = "flex";
    drawer.classList.remove("fechar");
  }
  if (backdrop) {
    backdrop.style.display = "block";
  }
  if (badge) {
    badge.style.display = "none";
  }
}

function fecharDrawerChat() {
  drawerChatAberto = false;
  
  const drawer = document.getElementById("drawerChat");
  const backdrop = document.getElementById("drawerBackdrop");
  
  if (drawer) {
    drawer.classList.add("fechar");
    setTimeout(() => {
      drawer.style.display = "none";
      drawer.classList.remove("fechar");
    }, 300);
  }
  
  if (backdrop && !drawerPerfilAberto) {
    backdrop.style.display = "none";
  }
}

function enviarMensagem() {
  const input = document.getElementById("inputMensagem");
  if (!input || !input.value.trim()) return;
  
  const mensagem = input.value.trim();
  input.value = "";
  
  if (socket && socket.connected) {
    socket.emit('chat:enviar', {
      usuario: usuarioLogadoAtual,
      mensagem: mensagem,
      tipo: abaAtualChat,
      salaId: salaAtual?.id || null
    });
  }
}

function adicionarMensagem(usuario, mensagem) {
  const container = document.getElementById("mensagensChat");
  if (!container) return;
  
  // Se não tem mensagens, limpa o "sem mensagens ainda"
  if (container.innerHTML.includes("Sem mensagens ainda")) {
    container.innerHTML = "";
  }
  
  const msgDiv = document.createElement("div");
  msgDiv.className = "mensagem-item";
  msgDiv.innerHTML = `<strong>${usuario}:</strong> <span>${mensagem}</span>`;
  
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  
  // Incrementar badge se chat fechado
  if (!drawerChatAberto) {
    mensagensNaoLidas++;
    atualizarBadgeMensagens();
  }
}

function atualizarBadgeMensagens() {
  const badge = document.getElementById("badgeMensagensNaoLidas");
  if (badge) {
    if (mensagensNaoLidas > 0) {
      badge.textContent = mensagensNaoLidas;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }
}

// ========== EVENT LISTENERS PARA DRAWERS ==========
document.addEventListener('DOMContentLoaded', () => {
  // Botões flutuantes
  const btnAbrirPerfil = document.getElementById("btnAbrirPerfil");
  const btnAbrirChat = document.getElementById("btnAbrirChat");
  const backdrop = document.getElementById("drawerBackdrop");
  
  if (btnAbrirPerfil) {
    btnAbrirPerfil.onclick = abrirDrawerPerfil;
  }
  
  if (btnAbrirChat) {
    btnAbrirChat.onclick = abrirDrawerChat;
  }
  
  if (backdrop) {
    backdrop.onclick = () => {
      if (drawerPerfilAberto) fecharDrawerPerfil();
      if (drawerChatAberto) fecharDrawerChat();
    };
  }
  
  // Botão enviar mensagem
  const inputMensagem = document.getElementById("inputMensagem");
  const btnEnviarMensagem = document.getElementById("btnEnviarMensagem");
  
  if (btnEnviarMensagem) {
    btnEnviarMensagem.onclick = enviarMensagem;
  }
  
  if (inputMensagem) {
    inputMensagem.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        enviarMensagem();
      }
    });
  }
  
  // Botões das abas do chat
  const btnAbaChatGlobal = document.getElementById("btnAbaChatGlobal");
  const btnAbaChatTorneio = document.getElementById("btnAbaChatTorneio");
  
  if (btnAbaChatGlobal) {
    btnAbaChatGlobal.onclick = () => {
      abaAtualChat = "global";
      btnAbaChatGlobal.classList.add("tab-ativo");
      if (btnAbaChatTorneio) btnAbaChatTorneio.classList.remove("tab-ativo");
      document.getElementById("mensagensChat").innerHTML = "<p style='color: #888; text-align: center; margin-top: 20px;'>💬 Chat Global - Mensagens para todos os jogadores</p>";
    };
  }
  
  if (btnAbaChatTorneio) {
    btnAbaChatTorneio.onclick = () => {
      abaAtualChat = "torneio";
      btnAbaChatTorneio.classList.add("tab-ativo");
      if (btnAbaChatGlobal) btnAbaChatGlobal.classList.remove("tab-ativo");
      document.getElementById("mensagensChat").innerHTML = "<p style='color: #888; text-align: center; margin-top: 20px;'>🎮 Chat do Torneio - Apenas jogadores desta sala</p>";
    };
  }
  
  // Adicionar listener para pensamento do dia
  const pensamentoPerfil = document.getElementById("pensamentoPerfil");
  const inputPensamento = document.getElementById("inputPensamento");
  const btnEditarPensamento = document.getElementById("btnEditarPensamento");
  
  if (pensamentoPerfil) {
    pensamentoPerfil.onclick = () => {
      pensamentoPerfil.style.display = "none";
      inputPensamento.style.display = "block";
      btnEditarPensamento.style.display = "block";
      inputPensamento.value = perfilUsuario.pensamentoDoDia;
      inputPensamento.focus();
    };
  }
  
  if (btnEditarPensamento) {
    btnEditarPensamento.onclick = async () => {
      const novo = inputPensamento.value.trim();
      
      try {
        const resposta = await fetch(`${API_URL}/api/perfil/${usuarioLogadoAtual}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pensamentoDoDia: novo })
        });
        
        if (resposta.ok) {
          perfilUsuario.pensamentoDoDia = novo;
          localStorage.setItem(`perfil_${usuarioLogadoAtual}`, JSON.stringify(perfilUsuario));
          pensamentoPerfil.textContent = novo || '"Sem pensamento..."';
          mostrarToast("✅ Pensamento atualizado!");
        }
      } catch (e) {
        console.error('❌ Erro:', e);
        mostrarToast('❌ Erro ao atualizar');
      }
      
      pensamentoPerfil.style.display = "block";
      inputPensamento.style.display = "none";
      btnEditarPensamento.style.display = "none";
    };
  }
  
  if (inputPensamento) {
    inputPensamento.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        btnEditarPensamento.click();
      }
    });
  }
});

