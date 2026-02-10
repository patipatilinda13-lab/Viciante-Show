# 🔍 AUDITORIA COMPLETA - VICIANTE SHOW
**Data**: 10/02/2026  
**Status**: ⚠️ FALHAS CRÍTICAS IDENTIFICADAS

---

## 📋 RESUMO EXECUTIVO

O jogo foi arquitetado para ser multiplayer com WebSocket (Socket.io), mas **as salas NÃO atualizam em tempo real** para os outros jogadores. O problema raiz é que:

1. ❌ **Salas não brodcasteiam atualizações via WebSocket**
2. ❌ **Socket não é inicializado para usuários persistidos (login automático)**
3. ❌ **Socket listeners apenas funcionam DENTRO de uma sala, não na lista**
4. ❌ **Participação não dispara eventos WebSocket para outros jogadores**

---

## 🎯 VISÃO GERAL FUNCIONAL: O QUE DEVERIA FUNCIONAR

### Fluxo Ideal (Como Deveria Ser):
```
1. AUTENTICAÇÃO
   ✅ Registrar conta
   ✅ Fazer login
   ✅ Manter sessão persistente
   ✅ Socket inicializar após login

2. SELEÇÃO DE SALAS
   ✅ Listar salas disponíveis
   ✅ Atualizar count de jogadores EM TEMPO REAL
   ✅ Mostrar indicador "Você está participando"
   ✅ Abrir/Fechar salas automaticamente quando lotam
   ✅ Admin criar salas novas que aparecem IMEDIATAMENTE

3. DENTRO DE UMA SALA (Gerenciamento)
   ✅ Ver lista de participantes atualizada
   ✅ Jogador novo entra e aparece para todos
   ✅ Jogador deixa a sala e disapparece para todos
   ✅ Marcar como "pagou" quando clica em Participar
   ✅ Admin ver checkboxes para participação de todos

4. SORTEIO (Jogo)
   ✅ Todos veem a mesma ordem de turno
   ✅ Maleta aberta por um player aparece para todos em TEMPO REAL
   ✅ Turno avança sincronizado
   ✅ Resultado revelado simultaneamente
   ✅ Próxima rodada começa com sync

5. ADMIN
   ✅ Entereder como espectador sem participar
   ✅ Editar sala (nome, valor, limite)
   ✅ Ligar/Desligar sala
   ✅ Expulsar jogadores
   ✅ Criar salas novas
   ✅ Acompanhar múltiplas salas
```

---

## 🐛 LISTA DE FALHAS IDENTIFICADAS

### 🔴 CRÍTICAS (Quebram o jogo)

#### **1. SALAS NÃO ATUALIZAM NA LISTA PRINCIPAL**
- **Comportamento Esperado**: Quando um jogador entra em uma sala, o count de jogadores atualiza para todos que estão vendo a lista  
- **Comportamento Real**: Count fica desatualizado até manual refresh ou troca de aba
- **Root Cause**: 
  - ❌ Nenhum evento WebSocket para "sala:atualizada"
  - ❌ Socket listeners `sala:jogador-entrou` / `sala:jogador-saiu` checam apenas `telaSalaGerenciamento.style.display !== "none"` (não atualizam a lista)
  - ❌ Só há atualização via `storage` event (mudança de localStorage em outra aba)
  - **Código Problemático** (script.js, linhas 163-180):
    ```javascript
    socket.on('sala:jogador-entrou', (dados) => {
      if (telaSalaGerenciamento.style.display !== "none" && salaAtual) {
        // Só funciona SE DENTRO da sala, não na lista!
      }
    });
    ```

#### **2. SOCKET NÃO INICIALIZA PARA USUÁRIOS PERSISTIDOS**
- **Comportamento Esperado**: Usuário com login persistido abre o app → Socket conecta automaticamente
- **Comportamento Real**: Socket fica null até usuário fazer logout e login novamente
- **Root Cause**:
  - ❌ `inicializar()` (linha 1819) chama `carregarSalas()` mas NÃO chama `inicializarSocket()`
  - ❌ `inicializarSocket()` só é chamado em `btnLogar.onclick` e `btnCadastrar.onclick`
  - **Código Problemático** (script.js, linhas 1819-1850):
    ```javascript
    function inicializar() {
      carregarSalas();
      const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO_LOGADO);
      if (usuarioSalvo) {
        // Usuário logado, mas SOCKET NÃO INICIALIZA! 😱
        usuarioLogadoAtual = usuario.login;
        // ... falta: inicializarSocket();
      }
    }
    ```

#### **3. PARTICIPAÇÃO NÃO SINCRONIZA COM OUTROS JOGADORES**
- **Comportamento Esperado**: Jogador clica "Participar" → Todos na sala veem logo
- **Comportamento Real**: Só funciona localmente, outros não veem
- **Root Cause**:
  - ❌ `btnParticipar.onclick` (linha 1598) salva sala mas não emite evento WebSocket
  - ❌ `socket.emit('sala:entrar', ...)` é chamado, mas não há listener correspondente no servidor para "sala:atualiza"
  - **Código Problemático** (script.js, linhas 1598-1620):
    ```javascript
    btnParticipar.onclick = async () => {
      salaAtual.jogadores.push({...}); // Adiciona localmente
      await salvarSalas(); // Salva no servidor
      // ❌ FALTA: socket.emit('participante:adicionado', {...});
      renderizarGerenciamento();
    };
    ```

#### **4. BROADCAST DE SALAS FALTANDO NO SERVIDOR**
- **Root Cause**:
  - ❌ server.js não tem rota WebSocket para "sala:atualizada" ou "sala:criada"
  - ❌ Quando admin cria sala ou modifica, não há `io.emit(...)` para broadecastar
  - **Código Ausente** (server.js):
    ```javascript
    // FALTA ISSO:
    socket.on('sala:criar', (dados) => {
      // ... salvar nova sala
      io.emit('sala:criada', novaSala); // Notificar todos!
    });
    ```

#### **5. MISMATCH ENTRE CLIENTE E SERVIDOR**
- **Problema**:
  - Cliente inicializa `salas` com hard-coded inicial (linhas 18-35)
  - Servidor tem dados em `data.json`
  - Quando servidor atualiza, cliente não reflete
- **Root Cause**:
  - ❌ Cliente não sincroniza rooms no app startup via HTTP
  - ❌ `carregarSalas()` (linha 486) faz fetch, mas em localStorage não há CHAVE_SALAS_STORAGE no início

---

### 🟡 ALTAS (Funcionalidades quebradas)

#### **6. RENDERIZAR GERENCIAMENTO INCOMPLETO**
- **Problema**: A função `renderizarGerenciamento()` referencia `listaParticipantes` (linha 380) mas nunca o popula
- **Root Cause**:
  - ❌ Funções `renderizarParticipantesComCheckbox()` e `renderizarParticipantesSimples()` chamadas (linha 900, 914) mas **não existem no código**
  - ❌ `listaParticipantes` é um elemento DOM que fica vazio
  - **Código Problemático** (script.js, linhas 916-917):
    ```javascript
    renderizarParticipantesComCheckbox(); // Função NÃO EXISTE
    renderizarParticipantesSimples();     // Função NÃO EXISTE
    ```

#### **7. ADMIN LOGADO NÃO PERSISTE**
- **Problema**: Admin faz login secreto, atualiza a página, perde status de admin
- **Root Cause**:
  - ❌ `adminLogado` é variável global sem localStorage
  - ❌ Nenhuma saved de status admin
  - **Código Problemático** (script.js, linhas 139):
    ```javascript
    let adminLogado = false; // Não persiste!
    ```

#### **8. SINCRONIZAÇÃO DE SORTEIO QUEBRADA**
- **Problema**: Quando maleta é aberta, outros jogadores na sala não veem
- **Root Cause**:
  - ❌ `escolherMaleta()` chama `socket.emit('maleta:aberta', ...)` (linha 1171) mas listener no servidor não validou turnos
  - ❌ Listener no cliente (maleta:aberta) recarrega salas mas pode ser delayed
  - ✅ Servidor validar turno está OK, mas falta broadcast imediato

---

### 🟠 MÉDIAS (Comportamentos estranhos)

#### **9. RACE CONDITION AO ENTRAR NA SALA**
- **Problema**: Quando clica "Entrar", a sala é salva antes do jogador ser adicionado
- **Root Cause**:
  - ❌ `finalizarEntradaNaSala()` (linha 822) chama `atualizarStatusSala()` ANTES do socket event
  - ❌ Não há garantia que o statusSala tem o jogador na lista
  - **Código Problemático** (script.js, linhas 815-820):
    ```javascript
    await finalizarEntradaNaSala(sala); // sala.jogadores ainda vazio!
      function finalizarEntradaNaSala(sala) {
        atualizarStatusSala(sala); // Valida com jogadores vazio
        await salvarSalas(); // Salva sem jogador
    ```

#### **10. SESSIONID PODE NÃO ESTAR PRONTO**
- **Problema**: `sessionIdAtual` gerado em `gerarSessionId()` mas pode não estar inicializado quando socket emite
- **Root Cause**:
  - ❌ Timing issue entre geração e uso
  - ℹ️ Baixo impacto mas frágil

#### **11. SOCKET DISCONNECT NÃO TEM FALLBACK**
- **Problema**: Se socket desconectar, não há retry ou fallback para HTTP polling
- **Root Cause**:
  - ❌ Sem tratamento de "socket:disconnect" para reload de dados
  - ✅ Mas há listener para disconnect (mostra toast)

---

### 💙 BAIXAS (Pequenos bugs)

#### **12. TIMEOUT SESSÃO NÃO PERSISTE ENTRE ABAS**
- Não é crítico, apenas ajuste UX

#### **13. ADMIN ESPECTADOR - LÓGICA COMPLEXA**
- A lógica de "admin como espectador" tem muitos checks condicionais
- Possível confusão entre moderador e espectador

---

## ✅ CHECKLIST: O QUE FUNCIONA CERTO

- ✅ **Autenticação**: Registro e login funcionam bem
- ✅ **Persistência de Login**: localStorage mantém user logado
- ✅ **Sorteio Server-Side**: Validação rigorosa de turno no servidor funciona
- ✅ **Maletas**: Criação e seleção trabalham no servidor
- ✅ **Resultado Revelaçã**: Cálculo de vencedor está correto
- ✅ **Admin Secreto**: Autenticação de admin funciona (enquanto na sessão)
- ✅ **CORS**: Socket.io CORS está configurado
- ✅ **Mobile Responsive**: CSS está bom
- ✅ **Toast Notifications**: Sistema de notificação funciona
- ✅ **Account Deletion**: Detecção de conta deletada (com timeout check) funciona

---

## ❌ CHECKLIST: O QUE NÃO FUNCIONA

### Players não veem:
- ❌ Outros players entrando na sala (list não atualiza)
- ❌ Novos rooms criados pelo admin
- ❌ Room status mudanças (aberta/fechada, nome, valor)
- ❌ Quando outro player participa (Participar not synced)
- ❌ Indicador de "participando" na list view

### Admin não consegue:
- ❌ Manter status admin após refresh
- ❌ Ver lista atualizada de participantes em tempo real
- ❌ Broadcast de mudanças (nome, valor, status)

### Sorteio:
- ❌ Sincronização delayed (depende de carregarSalas fetch)
- ❌ Sem tratamento de Socket desconexão

---

## 🔧 FIX PRIORITY ORDER

1. **P0** - Inicializar Socket para usuários persistidos
2. **P0** - Adicionar Socket listeners para atualizações de salas na list view
3. **P1** - Implementar funções `renderizarParticipantesComCheckbox/Simples`
4. **P1** - Emitir eventos WebSocket em: participar, criar sala, editar sala
5. **P1** - Adicionar handlers no servidor para "sala:atualizada" eventos
6. **P2** - Persistir adminLogado em localStorage
7. **P2** - Aprimorar sincronização de sorteio (menos carregarSalas calls)

---

## 📊 ARCHITECTURE ISSUES

```
PROBLEMA ESTRUTURAL (Diagram):

┌─────────────────────────────────────────────────────────┐
│ CLIENTE - Script.js                                     │
│                                                         │
│  ┌────────────┐  ┌──────────────────┐                  │
│  │ Tela-Salas │  │ Tela-Gerencia    │                  │
│  │ (List)     │  │ (Inside Room)    │                  │
│  └────────────┘  └──────────────────┘                  │
│       ✅                  ✅                            │
│    Updates via       Updates via                       │
│  localStorage     Socket Listeners                     │
│  event (outras       (maleta,                          │
│    abas)          sorteio)                             │
│                                                         │
│  ❌ Socket Listeners                                   │
│     SÓ funcionam                                       │
│     DENTRO da sala,                                    │
│     não na List!                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                         ↕ WebSocket ↕
              ❌ Faltam eventos para:
              - sala:criada
              - sala:atualizada
              - participante:adicionado
              - participante:removido
                         ↕
┌─────────────────────────────────────────────────────────┐
│ SERVIDOR - Server.js                                    │
│                                                         │
│ ✅ REST API endpoints (maleta, sorteio)               │
│ ❌ Socket.io eventos de sala (não existem)            │
│ ❌ Broadcast de atualizações (ausente)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🎬 VIDEO SCENARIO: Demonstrando o Problema

**Cenário Real**:
1. Lucas abre o jogo → vê 2 salas com 0 jogadores cada
2. Fernando abre o jogo → vê mesmos 2 salas
3. Lucas clica "Entrar" na Sala 1
4. **BUG**: Fernando ainda vê Sala 1 com 0 jogadores (deveria ser 1)
5. Fernando abre "Painel Moderador" (admin) → vê Lucas em Sala 1 (aqui funciona porque está no gerenciam)
6. Fernando volta para lista de salas → ainda vê 0 jogadores
7. Fernando fecha e abre o navegador → agora vê 1 jogador (falso o tempo)

**Por qué**? Socket listeners só disparam DENTRO de uma sala, não na list view.

---

