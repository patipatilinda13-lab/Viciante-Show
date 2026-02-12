# 🔴 TESTE: Tournament Restart Bug - Instruções

## 🎯 Objetivo
Capturar os **LOGS EXATOS** da seqüência de eventos para diagnosticar por que o countdown de abertura de maletas está sendo disparado IMEDIATAMENTE, sem dar tempo para os jogadores escolherem.

---

## 📋 Passo a Passo

### 1️⃣ **Abrir DevTools**
- Pressione **F12** (ou Ctrl+Shift+I)
- Vá para a aba **Console**
- **IMPORTANTE:** Deixe o DevTools aberto DURANTE TODO O TESTE
- Se possível, maximize o console para ver melhor os logs

### 2️⃣ **Criar um Torneio**
- Faça login como ADMIN
- Crie uma sala
- Adicione 3-4 jogadores com pagamento confirm ado
- Clique em **"Iniciar Sorteio"**
- 📸 **RESERVE PRINTS DOS LOGS VERMELHOS 🔴 QUE APARECEREM**

### 3️⃣ **Observa r o Fluxo (PRIMEIRA VEZ)**
Você deve ver estes logs **VERMELHOS** aparecendo na ordem:

#### ✅ Log 1: Admin clica em "Iniciar Sorteio"
```
🔴 [INÍCIO] Admin clicou em "Iniciar Sorteio"
🔴 Jogadores para sorteio: [Jogador1, Jogador2, Jogador3]
🔴 Ordem gerada: [Jogador1, Jogador2, Jogador3]
```

#### ✅ Log 2: Função de Reset é chamada
```
🔴 [RESET] Função resetarEstadoDoJogo() foi CHAMADA
   ANTES: turnoAtual=0, ordem.length=0
   ✅ salaAtual.turnoAtual = 0
   DEPOIS: turnoAtual=0, salaAtual.turnoAtual=0
```

#### ✅ Log 3: API retorna dados
```
🔴 SORTEIO INICIADO NO SERVIDOR:
   API retornou turnoAtual: 0
   Ordem: [Jogador1, Jogador2, Jogador3]
   ordem.length: 3
   Maletas: 1:vazia, 2:vazia, 3:vazia(...) [todas zeradas]
   VAI CHAMAR criarMaletas() COM turnoAtual=0
```

#### ✅ Log 4: criarMaletas verifica turnoAtual
```
🔴 DEBUG CRÍTICO EM criarMaletas():
   turnoAtual = 0
   ordem.length = 3
   ordem = [Jogador1, Jogador2, Jogador3]
   turnoAtual >= ordem.length? false
   Deveria iniciar countdown? false

🔴 [VERIFICAÇÃO CRÍTICA] Se turnoAtual (0) >= ordem.length (3)? false
```

#### ✅ Log 5: Jogadores podem escolher maletas
- Não deve aparecer nenhum log de countdown ainda
- Interface deve mostrar "🎯 É SUA VEZ!" ou "⏳ Aguardando..."
- **ISSO É SUCESSO!**

---

### 4️⃣ **Deixar o Torneio Terminar**
- Selecione as maletas (todos os jogadores)
- Quando todos selecionarem, você DEVE ver:
```
🔴 ⚠️ CRÍTICO: Iniciando countdown porque turnoAtual >= ordem.length
   turnoAtual=3, ordem.length=3
```
- Depois o countdown vai aparecer: "⏳ Abrindo maletas em 5 4 3 2 1..."
- Maletas se abrem, vencedor é anunciado

---

### 5️⃣ **AGORA O TESTE CRÍTICO: Próxima Rodada/Restart**
- Clique em **"Próxima Rodada"** OU **"Voltar e Iniciar Novo"**
- **OBSERVAÇÃO MÁXIMA!** Veja todos os logs que aparecem
- Se o BUG acontecer, você verá:

#### ❌ Comportamento RUIM:
```
🔴 [SOCKET] 'sorteio:iniciado' recebido para sala X
   Ordem DO SERVIDOR: [Jogador1, Jogador2, Jogador3]
   salaAtual.turnoAtual ANTES de reset: 3  ← ⚠️ PROBLEMA!
   ...
   salaNova.turnoAtual IMEDIATAMENTE após carregarSalas(): 3  ← ⚠️ PROBLEMA!
   ...
   RESET FORÇADO: salaAtual.turnoAtual = 0

🔴 DEBUG CRÍTICO EM criarMaletas():
   turnoAtual = 0
   ordem.length = 3
   ordem = [Jogador1, Jogador2, Jogador3]
   turnoAtual >= ordem.length? false

🔴 [COUNTDOWN] iniciarCountdownAberturaMaletas() CHAMADA!
   turnoAtual=0, ordem.length=3
   turnoAtual >= ordem.length = false  ← ❌ POR QUE ESTÁ SENDO CHAMADA?
```

---

### 6️⃣ **REPORTAR PARA MIM**
**COPIE E COLE TODOS OS LOGS VERMELHOS 🔴 DESTE PONTO CRÍTICO:**
- Especialmente do 2º torneio (restart)
- Foco: Qual é o valor de `turnoAtual` quando `sorteio:iniciado` é recebido?
- Foco: Qual é o valor em cada etapa de reset?

**DIGA-ME:**
1. ✅ Qual era `turnoAtual` ANTES de reset?
2. ✅ Qual era `turnoAtual` DEPOIS de reset?
3. ✅ O countdown foi disparado mesmo com turnoAtual < ordem.length?
4. ✅ Se houve erro, QUAL foi? (copie o stack trace)

---

## 🔴 Valores Esperados (Se tudo funcionar)

### Primeira Rodada:
```
turnoAtual: 0 → 1 → 2 → 3 (quando todos escolherem)
```

### Reinício (Segunda Rodada):
```
Antes de reset: turnoAtual = 3 (do jogo anterior)
Após reset: turnoAtual = 0 (resetado)
Após socket reload: turnoAtual = 0 (sempre deve ser 0)
Em criarMaletas: turnoAtual = 0 (pronto para começar)
```

---

## 💡 Se Acontecer o BUG:

A sequência será:
1. Socket `sorteio:iniciado` traz `turnoAtual = 3` (stale)
2. Ele reseta para 0
3. MAS `criarMaletas()` recebe `turnoAtual` = 3 DE ALGUM LUGAR
4. Condição `turnoAtual >= ordem.length` vira TRUE
5. Countdown dispara IMEDIATAMENTE

**Mensagem procurará por:** Qual é a ORIGEM desse `turnoAtual = 3` em `criarMaletas()`?

---

## 🚨 PRÓXIMAS AÇÕES BASEADAS NO RESULTADO

- **Se falso = `false` no log:** SUCESSO! Bug foi resolvido!
- **Se verdadeiro = `true` no log:** O failsafe vai auto-corrigir, ma precisamos entender por quê

**MANDE OS LOGS PARA ANÁLISE!** 🎯

