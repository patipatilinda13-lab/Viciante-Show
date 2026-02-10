# 🔧 PLANO DE CORREÇÃO - PRÓXIMAS AÇÕES

**Data**: 10/02/2026  
**Status**: 📋 Pronto para implementação

---

## 🎯 RESUMO DO PROBLEMA

Seu jogo tem uma **falha estrutural crítica**: o WebSocket (Socket.io) foi implementado para sincronização em tempo real, MAS:

1. ❌ **Socket não inicia para usuários persistidos** → Usuários com auto-login não têm WebSocket
2. ❌ **Socket listeners só funcionam DENTRO da sala** → Lista de salas não atualiza 
3. ❌ **Faltam eventos WebSocket** → Quando alguém entra, outro sai, admin edita: ninguém vê
4. ❌ **Funções de UI não existem** → Renderizar lista de participantes está vazio

**Resultado**: O jogo se comporta como se não tivesse multiplayer em tempo real.

---

## 🛠️ CORREÇÕES NECESSÁRIAS (ORDEM DE PRIORIDADE)

### 1️⃣ **CRÍTICA** - Socket inicializar para usuários persistidos
**Arquivo**: `script.js`, função `inicializar()` (linhas 1819-1850)

**Problema**: 
```javascript
function inicializar() {
  carregarSalas();
  const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO_LOGADO);
  if (usuarioSalvo) {
    // Socket NÃO inicia aqui!
  }
}
```

**Solução**:
```javascript
function inicializar() {
  carregarSalas();
  const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO_LOGADO);
  if (usuarioSalvo) {
    try {
      const usuario = JSON.parse(usuarioSalvo);
      usuarioLogadoAtual = usuario.login;
      idJogadorAtual = usuario.id;
      ultimaAtividadeTimestamp = usuario.timestamp;
      
      // ✅ ADICIONAR ISTO:
      inicializarSocket();  // <-- FALTA ISTO!
      
      telaAutenticacao.style.display = "none";
      telaSalas.style.display = "block";
      atualizarStatusAdmin();
      await carregarSalas();
      renderizarSalas();
    } catch (e) {
      console.error("Erro ao carregar usuário salvo:", e);
      localStorage.removeItem(CHAVE_USUARIO_LOGADO);
      mostrarTelaAutenticacao();
    }
  } else {
    mostrarTelaAutenticacao();
  }
  sincronizarAtualizacoes();
}
```

**Impacto**: Socket será inicializado imediatamente após usuário ser carregado.

---

### 2️⃣ **CRÍTICA** - Adicionar Socket listeners na lista de salas
**Arquivo**: `script.js`, função `configurarListenersSocket()` (linhas 105-191)

**Problema**: Listeners só disparam DENTRO da sala, precisam disparar NA LISTA também.

**Solução**: Modificar listeners para atender AMBAS as telas:
```javascript
function configurarListenersSocket() {
  if (!socket) return;
  
  // Maleta foi aberta por outro jogador
  socket.on('maleta:aberta', (dados) => { /* ... já funciona ... */ });
  
  // Jogador entrou na sala
  socket.on('sala:jogador-entrou', (dados) => {
    console.log(`👤 ${dados.jogadorNome} entrou`);
    
    // ✅ Sincronizar TANTO na list QUANTO no gerenciamento
    carregarSalas().then(() => {
      // Se está na list, renderizar
      if (telaSalas.style.display !== "none") {
        renderizarSalas(); // ← FALTA ISTO!
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
      // ✅ Renderizar list também
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
  
  // ... resto dos listeners ...
}
```

**Impacto**: List agora atualiza quando alguém entra/sai de qualquer sala.

---

### 3️⃣ **CRÍTICA** - Implementar funções de renderizar participantes
**Arquivo**: `script.js`

**Problema**: Funções chamadas não existem:
- `renderizarParticipantesComCheckbox()` (line 900)
- `renderizarParticipantesSimples()` (line 914)

**Solução**: Criar essas funções após `renderizarGerenciamento()`:

```javascript
function renderizarParticipantesComCheckbox() {
  // Para ADMIN - mostra todos com checkboxes de pagamento
  listaParticipantes.innerHTML = "";
  
  salaAtual.jogadores.forEach(jogador => {
    const div = document.createElement("div");
    div.style.cssText = "display: flex; justify-content: space-between; padding: 8px; border: 1px solid #ddd; margin: 5px 0; border-radius: 5px;";
    
    const nome = document.createElement("span");
    nome.textContent = jogador.nome;
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = jogador.pagou;
    checkbox.onchange = async (e) => {
      jogador.pagou = e.target.checked;
      atualizarStatusSala(salaAtual);
      await salvarSalas();
      // Não precisa re-renderizar, apenas salva
    };
    
    div.appendChild(nome);
    div.appendChild(checkbox);
    listaParticipantes.appendChild(div);
  });
}

function renderizarParticipantesSimples() {
  // Para JOGADOR COMUM - mostra lista simples
  listaParticipantes.innerHTML = "";
  
  if (salaAtual.jogadores.length === 0) {
    listaParticipantes.innerHTML = "<p style='text-align: center; color: #aaa;'>Ninguém participando ainda</p>";
    return;
  }
  
  salaAtual.jogadores.forEach(jogador => {
    const div = document.createElement("div");
    div.style.cssText = "padding: 8px; background: #f5f5f5; margin: 5px 0; border-radius: 5px; display: flex; justify-content: space-between;";
    
    const nome = document.createElement("span");
    nome.textContent = jogador.nome;
    
    const status = document.createElement("span");
    status.textContent = jogador.pagou ? "✅ Pagou" : "⏳ Aguardando";
    status.style.color = jogador.pagou ? "#2ecc71" : "#f39c12";
    
    div.appendChild(nome);
    div.appendChild(status);
    listaParticipantes.appendChild(div);
  });
}
```

**Impacto**: Participantes serão visíveis na sala.

---

### 4️⃣ **ALTA** - Emitir Socket event ao participar/sair
**Arquivo**: `script.js`, funções `btnParticipar.onclick` e `btnSairTorneio.onclick` (linhas 1598-1633)

**Problema**: Quando jogador clica "Participar", não avisa aos outros via Socket.

**Solução**:
```javascript
btnParticipar.onclick = async () => {
  if (!salaAtual || !usuarioLogadoAtual || adminLogado) return;
  
  btnParticipar.disabled = true;
  const textAnterior = btnParticipar.textContent;
  btnParticipar.textContent = "⏳ Participando...";

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
  await salvarSalas();
  
  // ✅ ADICIONAR ISTO:
  if (socket && socket.connected) {
    socket.emit('participante:adicionado', {
      salaId: salaAtual.id,
      jogadorId: idJogadorAtual,
      jogadorNome: usuarioLogadoAtual
    });
  }
  
  renderizarGerenciamento();
  btnParticipar.disabled = false;
  btnParticipar.textContent = textAnterior;
};

btnSairTorneio.onclick = async () => {
  if (!salaAtual || !idJogadorAtual) return;
  
  btnSairTorneio.disabled = true;
  btnSairTorneio.textContent = "⏳ Saindo...";

  salaAtual.jogadores = salaAtual.jogadores.filter(j => j.id !== idJogadorAtual);

  atualizarStatusSala(salaAtual);
  await salvarSalas();
  
  // ✅ ADICIONAR ISTO:
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
```

**Impacto**: Participação sincroniza via Socket.

---

### 5️⃣ **ALTA** - Listeners para participante adicionado/removido
**Arquivo**: `script.js`, função `configurarListenersSocket()` 

**Adicionar NOVOS listeners**:
```javascript
function configurarListenersSocket() {
  if (!socket) return;
  
  // ... listeners existentes ...
  
  // ✅ ADICIONAR ISTO:
  
  // Participante foi adicionado
  socket.on('participante:adicionado', (dados) => {
    if (telaSalaGerenciamento.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
      console.log(`✅ ${dados.jogadorNome} participou`);
      carregarSalas().then(() => {
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          renderizarGerenciamento();
        }
      });
    }
  });
  
  // Participante foi removido
  socket.on('participante:removido', (dados) => {
    if (telaSalaGerenciamento.style.display !== "none" && salaAtual && salaAtual.id === dados.salaId) {
      console.log(`❌ ${dados.jogadorNome} saiu`);
      carregarSalas().then(() => {
        const salaNova = salas.find(s => s.id === salaAtual.id);
        if (salaNova) {
          salaAtual = salaNova;
          renderizarGerenciamento();
        }
      });
    }
  });
}
```

---

### 6️⃣ **ALTO** - Persisti status admin
**Arquivo**: `script.js`, função `autenticarAdmin()` (linhas 1384-1393)

**Problema**: Admin perde status ao refresh.

**Solução**:
```javascript
function autenticarAdmin() {
  const senha = senhaAdminInput.value;
  
  if (senha === SENHA_ADMIN) {
    senhaAdminInput.value = "";
    adminLogado = true;
    
    // ✅ ADICIONAR ISTO:
    localStorage.setItem('vicianteshow_admin_logado', 'true');
    
    telaAdminSecreto.style.display = "none";
    telaSalas.style.display = "block";
    atualizarStatusAdmin();
  } else {
    alert("❌ Código incorreto!");
    senhaAdminInput.value = "";
  }
}

// ✅ MODIFICAR inicializar():
function inicializar() {
  carregarSalas();
  
  // Verificar se admin estava logado
  const adminSalvo = localStorage.getItem('vicianteshow_admin_logado');
  if (adminSalvo === 'true') {
    adminLogado = true;
  }
  
  const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO_LOGADO);
  if (usuarioSalvo) {
    // ... resto do código ...
  } else {
    mostrarTelaAutenticacao();
  }
  sincronizarAtualizacoes();
}

// ✅ Adicionar ao deslogarUsuario():
function deslogarUsuario() {
  usuarioLogadoAtual = null;
  idJogadorAtual = null;
  nomeJogadorAtual = null;
  ultimaAtividadeTimestamp = null;
  adminLogado = false; // Limpar admin
  localStorage.removeItem(CHAVE_USUARIO_LOGADO);
  localStorage.removeItem(CHAVE_SESSAO_ATUAL);
  localStorage.removeItem('vicianteshow_admin_logado'); // ← ADICIONAR
  // ... resto do código ...
}
```

---

### 7️⃣ **OPCIONAL** - Adicionar handlers no servidor
**Arquivo**: `server.js` (adicionar antes do `servidor.listen()`)

Para melhor experiências, o servidor pode broadcastar atualizações de sala quando admin as modifica:

```javascript
// ✅ Adicionar NOVOS Socket handlers (após os existentes):

socket.on('participante:adicionado', (dados) => {
  io.to(`sala_${dados.salaId}`).emit('participante:adicionado', dados);
});

socket.on('participante:removido', (dados) => {
  io.to(`sala_${dados.salaId}`).emit('participante:removido', dados);
});
```

(Isto é nice-to-have, não crítico)

---

## 📋 ORDEM RECOMENDADA (Do mais simples ao mais complexo)

1. ✅ **Socket inicializar** (1 min) - Adicionar 1 linha em `inicializar()`
2. ✅ **Persistir admin** (2 min) - 3 locais no código
3. ✅ **Renderizar participantes** (5 min) - 2 funções novas  
4. ✅ **Socket event participar/sair** (5 min) - 2 emit() calls
5. ✅ **Socket listeners na list** (10 min) - Modificar configurarListenersSocket  
6. ✅ **Socket listeners participante** (5 min) - 2 novos listeners
7. ✅ **Server handlers** (3 min) - Opcional, melhor UX

**Total estimado**: ~30 minutos

---

## ✨ DEPOIS DO FIX

Seu jogo terá:
- ✅ Socket conectado para todos os usuários
- ✅ Salas atualizando em tempo real na lista
- ✅ Participantes visíveis e sincronizando
- ✅ Admin mantendo status após refresh
- ✅ Verdadeiro multiplayer real-time (50-100ms latency)

---

