const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const servidor = http.createServer(app);
const io = socketIo(servidor, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Remover static - agora é apenas API!
// app.use(express.static(path.join(__dirname)));

// Arquivo de dados
const DATA_FILE = path.join(__dirname, 'data.json');

// Dados padrão (salas iniciais)
const DADOS_PADRAO = {
  salas: [
    {
      id: 1,
      nome: "Partida 10 reais",
      valor: 10,
      jogadores: [],
      limite: 10,
      aberta: true,
      moderador: null,
      sorteioAtivo: false,  // ✅ ADICIONADO
      ordem: [],            // ✅ ADICIONADO
      turnoAtual: 0,        // ✅ ADICIONADO
      maletas: [],          // ✅ ADICIONADO
      revelado: false,      // ✅ ADICIONADO
      vencedor: null        // ✅ ADICIONADO
    },
    {
      id: 2,
      nome: "Partida 20 reais",
      valor: 20,
      jogadores: [],
      limite: 10,
      aberta: true,
      moderador: null,
      sorteioAtivo: false,  // ✅ ADICIONADO
      ordem: [],            // ✅ ADICIONADO
      turnoAtual: 0,        // ✅ ADICIONADO
      maletas: [],          // ✅ ADICIONADO
      revelado: false,      // ✅ ADICIONADO
      vencedor: null        // ✅ ADICIONADO
    }
  ],
  contas: {}
};

// Ler dados do arquivo (com fallback para padrão)
function lerDados() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      // Se arquivo não existe, criar com dados padrão
      fs.writeFileSync(DATA_FILE, JSON.stringify(DADOS_PADRAO, null, 2));
      return DADOS_PADRAO;
    }
    
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    
    // Garantir que tem salas (caso arquivo esté corrompido ou vazio)
    if (!parsed.salas || parsed.salas.length === 0) {
      parsed.salas = DADOS_PADRAO.salas;
      salvarDados(parsed);
    }
    
    return parsed;
  } catch (e) {
    console.error("Erro ao ler dados:", e);
    return DADOS_PADRAO;
  }
}

// Salvar dados no arquivo
function salvarDados(dados) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  } catch (e) {
    console.error("Erro ao salvar dados:", e);
  }
}

// ========== ENDPOINTS DE SALAS ==========

// GET /api/salas - Retorna todas as salas
app.get('/api/salas', (req, res) => {
  const dados = lerDados();
  res.json(dados.salas);
});

// POST /api/salas - Salva as salas
app.post('/api/salas', (req, res) => {
  const dados = lerDados();
  dados.salas = req.body;
  salvarDados(dados);
  res.json({ sucesso: true });
});

// ========== ENDPOINTS DE CONTAS ==========

// GET /api/contas - Retorna todas as contas (protegido por senha)
app.get('/api/contas', (req, res) => {
  const senha = req.query.senha;
  if (senha !== '@@Lucas2014@@') {
    return res.status(403).json({ erro: 'Não autorizado' });
  }
  const dados = lerDados();
  res.json(dados.contas);
});

// POST /api/contas/registrar - Registra uma nova conta
app.post('/api/contas/registrar', (req, res) => {
  const { login, senha } = req.body;
  
  if (login.length < 6) {
    return res.status(400).json({ erro: 'Login deve ter mínimo 6 caracteres' });
  }
  
  const dados = lerDados();
  
  if (dados.contas[login]) {
    return res.status(400).json({ erro: 'Login já existe' });
  }
  
  // Hash simples
  function hashSenha(s) {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return "hash_" + Math.abs(hash).toString(36);
  }
  
  const id = "user_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
  
  dados.contas[login] = {
    id: id,
    login: login,
    senha: hashSenha(senha),
    senhaPlana: senha,
    dataCriacao: new Date().toISOString(),
    torneios: [],
    // ✅ NOVO: Campos de Perfil
    foto: "f1",
    pensamentoDoDia: "",
    torneiosVencidos: 0
  };
  
  salvarDados(dados);
  
  res.json({ 
    sucesso: true, 
    id: id,
    login: login
  });
});

// POST /api/contas/login - Faz login
app.post('/api/contas/login', (req, res) => {
  const { login, senha } = req.body;
  
  const dados = lerDados();
  const conta = dados.contas[login];
  
  if (!conta) {
    return res.status(401).json({ erro: 'Login ou senha incorretos' });
  }
  
  // Hash simples
  function hashSenha(s) {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return "hash_" + Math.abs(hash).toString(36);
  }
  
  if (conta.senha !== hashSenha(senha)) {
    return res.status(401).json({ erro: 'Login ou senha incorretos' });
  }
  
  res.json({
    sucesso: true,
    id: conta.id,
    login: conta.login
  });
});

// DELETE /api/contas - Limpa todas as contas (admin)
app.delete('/api/contas', (req, res) => {
  const senha = req.query.senha;
  if (senha !== '@@Lucas2014@@') {
    return res.status(403).json({ erro: 'Não autorizado' });
  }
  
  const dados = lerDados();
  dados.contas = {};
  salvarDados(dados);
  
  res.json({ sucesso: true });
});

// DELETE /api/contas/:login - Deleta uma conta específica (admin)
app.delete('/api/contas/:login', (req, res) => {
  const senha = req.query.senha;
  const login = req.params.login;
  
  if (senha !== '@@Lucas2014@@') {
    return res.status(403).json({ erro: 'Não autorizado' });
  }
  
  const dados = lerDados();
  
  if (!dados.contas[login]) {
    return res.status(404).json({ erro: 'Conta não encontrada' });
  }
  
  delete dados.contas[login];
  salvarDados(dados);
  
  res.json({ sucesso: true, mensagem: `Conta "${login}" foi deletada` });
});

// ========== ENDPOINTS DE PERFIL ==========

// GET /api/perfil/:login - Retorna perfil público de um jogador
app.get('/api/perfil/:login', (req, res) => {
  const dados = lerDados();
  const conta = dados.contas[req.params.login];
  
  if (!conta) {
    return res.status(404).json({ erro: 'Conta não encontrada' });
  }
  
  // Retornar apenas informações públicas
  res.json({
    login: conta.login,
    foto: conta.foto || "f1",
    pensamentoDoDia: conta.pensamentoDoDia || "",
    torneiosVencidos: conta.torneiosVencidos || 0,
    dataCriacao: conta.dataCriacao
  });
});

// PUT /api/perfil/:login - Atualiza perfil (foto, pensamento do dia)
app.put('/api/perfil/:login', (req, res) => {
  const dados = lerDados();
  const conta = dados.contas[req.params.login];
  
  if (!conta) {
    return res.status(404).json({ erro: 'Conta não encontrada' });
  }
  
  const { foto, pensamentoDoDia } = req.body;
  
  // ✅ Validar foto (deve ser f1-f15)
  if (foto) {
    const fotoValida = /^f(1[0-5]|[1-9])$/.test(foto);
    if (!fotoValida) {
      return res.status(400).json({ erro: 'Foto inválida (deve ser f1 a f15)' });
    }
    conta.foto = foto;
  }
  
  // ✅ Validar pensamento (máx 200 chars)
  if (pensamentoDoDia !== undefined) {
    if (pensamentoDoDia.length > 200) {
      return res.status(400).json({ erro: 'Pensamento muito longo (máx 200 caracteres)' });
    }
    conta.pensamentoDoDia = pensamentoDoDia;
  }
  
  salvarDados(dados);
  
  res.json({
    sucesso: true,
    perfil: {
      login: conta.login,
      foto: conta.foto,
      pensamentoDoDia: conta.pensamentoDoDia,
      torneiosVencidos: conta.torneiosVencidos
    }
  });
});

// ========== ENDPOINTS DE SORTEIO (SINCRONIZAÇÃO) ==========

// GET /api/salas/:id - Retorna uma sala específica (com estado do sorteio)
app.get('/api/salas/:id', (req, res) => {
  const dados = lerDados();
  const sala = dados.salas.find(s => s.id === parseInt(req.params.id));
  
  if (!sala) {
    return res.status(404).json({ erro: 'Sala não encontrada' });
  }
  
  res.json(sala);
});

// PUT /api/salas/:id/sorteio - Inicia sorteio e cria maletas
app.put('/api/salas/:id/sorteio', (req, res) => {
  const dados = lerDados();
  const sala = dados.salas.find(s => s.id === parseInt(req.params.id));
  
  console.error(`🔴 [SORTEIO] PUT /api/salas/${req.params.id}/sorteio - INICIANDO`);
  
  if (!sala) {
    console.error(`❌ ERRO: Sala não encontrada`);
    return res.status(404).json({ erro: 'Sala não encontrada' });
  }
  
  const { ordem, totalMaletas } = req.body;
  
  console.error(`   Ordem recebida: [${(ordem || []).join(', ')}]`);
  console.error(`   TotalMaletas: ${totalMaletas}`);
  
  if (!ordem || ordem.length < 2) {
    console.error(`❌ ERRO: Ordem inválida`);
    return res.status(400).json({ erro: 'Precisa de pelo menos 2 jogadores' });
  }
  
  console.error(`✅ Atualizando sala ${sala.id}...`);
  
  // ✅ RESETAR TUDO DO SORTEIO ANTERIOR
  sala.sorteioAtivo = true;
  sala.descuento = true;
  sala.ordem = ordem;  // ✅ SETANDO A ORDEM
  sala.turnoAtual = 0;
  sala.revelado = false;
  sala.vencedor = null;
  sala.vencedorRegistrado = null;
  
  console.error(`   sorteioAtivo = true`);
  console.error(`   ordem = [${sala.ordem.join(', ')}]`);
  console.error(`   turnoAtual = 0`);
  
  // 🔥 FORCE CLEAR DE MALETAS ANTIGAS - GARANTIR LIMPEZA TOTAL
  sala.maletas = [];
  
  // Inicializar estado do sorteio
  const indicePremiada = Math.floor(Math.random() * totalMaletas);
  
  sala.maletas = Array(totalMaletas).fill(null).map((_, i) => ({
    numero: i + 1,
    dono: null,
    premio: i === indicePremiada
  }));
  
  console.error(`   Maletas criadas: ${sala.maletas.length}`);
  console.error(`   Maleta premiada: #${indicePremiada + 1}`);
  
  salvarDados(dados);
  console.error(`✅ Dados salvos em data.json`);
  
  // Verificar que foi salvo corretamente
  console.error(`   VERIFICAÇÃO PÓS-SAVE:`);
  console.error(`   sala.ordem no objeto ANTES de retornar: [${sala.ordem.join(', ')}]`);
  console.error(`   sala.turnoAtual: ${sala.turnoAtual}`);
  console.error(`   sala.maletas.length: ${sala.maletas.length}`);
  
  console.log(`✅ [Sala ${sala.id}] Novo sorteio iniciado - Ordem: ${ordem.join(' → ')}`);
  
  res.json({ sucesso: true, sala });
});

// POST /api/salas/:id/maleta - Registra abertura de maleta
app.post('/api/salas/:id/maleta', (req, res) => {
  const dados = lerDados();
  const sala = dados.salas.find(s => s.id === parseInt(req.params.id));
  
  console.error(`🔴 [MALETA] POST /api/salas/${req.params.id}/maleta`);
  console.error(`   Sala encontrada? ${sala ? 'SIM' : 'NÃO'}`);
  if (sala) {
    console.error(`   sorteioAtivo: ${sala.sorteioAtivo}`);
    console.error(`   turnoAtual: ${sala.turnoAtual}`);
    console.error(`   ordem.length: ${sala.ordem?.length || 0}`);
    console.error(`   ordem: [${(sala.ordem || []).join(', ')}]`);
    console.error(`   CHECK: turnoAtual (${sala.turnoAtual}) >= ordem.length (${sala.ordem?.length || 0}) = ${sala.turnoAtual >= (sala.ordem?.length || 0)}`);
  }
  
  if (!sala || !sala.sorteioAtivo) {
    console.error(`❌ ERRO: Sorteio não está ativo para sala ${req.params.id}`);
    if (sala) {
      console.error(`   Dados da sala: sorteioAtivo=${sala.sorteioAtivo}, maletas=${sala.maletas?.length || 0}`);
    }
    return res.status(400).json({ erro: 'Sorteio não está ativo' });
  }
  
  const { numeroMaleta, jogador } = req.body;
  
  console.error(`   numeroMaleta solicitada: ${numeroMaleta}`);
  console.error(`   jogador solicitante: ${jogador}`);
  
  if (!numeroMaleta || numeroMaleta < 1 || numeroMaleta > sala.maletas.length) {
    console.error(`❌ ERRO: Número de maleta inválido`);
    return res.status(400).json({ erro: 'Número de maleta inválido' });
  }
  
  if (!sala.ordem || sala.ordem.length === 0) {
    console.error(`❌ ERRO CRÍTICO: Ordem vazia ou undefined! turnoAtual=${sala.turnoAtual}, ordem=${JSON.stringify(sala.ordem)}`);
    return res.status(400).json({ erro: 'Ordem do sorteio está vazia - sorteio inválido' });
  }
  
  if (sala.turnoAtual >= sala.ordem.length) {
    console.error(`❌ ERRO: Sorteio já terminou (turnoAtual ${sala.turnoAtual} >= ordem.length ${sala.ordem.length})`);
    return res.status(400).json({ erro: 'Sorteio já terminou' });
  }
  
  // VALIDAÇÃO RIGOROSA DE TURNO: Verificar que quem está clicando é o jogador correto
  const jogadorDaVez = sala.ordem[sala.turnoAtual];
  
  console.error(`   Jogador da vez (ordem[${sala.turnoAtual}]): ${jogadorDaVez}`);
  
  if (jogador !== jogadorDaVez) {
    console.error(`❌ ERRO: Não é a vez de ${jogador}. É a vez de ${jogadorDaVez}`);
    return res.status(403).json({ erro: `Não é sua vez! Aguarde ${jogadorDaVez}` });
  }
  
  const maleta = sala.maletas[numeroMaleta - 1];
  
  console.error(`   Maleta #${numeroMaleta} - dono atual: ${maleta.dono || 'null'}`);
  
  if (maleta.dono !== null) {
    console.error(`❌ ERRO: Maleta ${numeroMaleta} já foi escolhida por ${maleta.dono}`);
    return res.status(400).json({ erro: 'Maleta já foi escolhida' });
  }
  
  // Atualizar maleta (inclusão e incremento são próximos, minimizando race condition)
  maleta.dono = jogadorDaVez;
  sala.turnoAtual++;
  
  console.error(`   ✅ Maleta ${numeroMaleta} atribuída a ${jogadorDaVez}`);
  console.error(`   ✅ turnoAtual incrementado: ${sala.turnoAtual - 1} → ${sala.turnoAtual}`);
  
  salvarDados(dados);
  console.error(`   ✅ Dados salvos em data.json`);
  
  res.json({ sucesso: true, sala });
});

// PUT /api/salas/:id/sorteio/terminar - Termina sorteio
app.put('/api/salas/:id/sorteio/terminar', (req, res) => {
  const dados = lerDados();
  const sala = dados.salas.find(s => s.id === parseInt(req.params.id));
  
  if (!sala) {
    return res.status(404).json({ erro: 'Sala não encontrada' });
  }
  
  sala.sorteioAtivo = false;
  sala.maletas = [];
  sala.ordem = [];
  sala.turnoAtual = 0;
  sala.revelado = false;
  sala.vencedor = null;
  
  salvarDados(dados);
  res.json({ sucesso: true });
});

// PUT /api/salas/:id/sorteio/revelar - Revela resultado das maletas
app.put('/api/salas/:id/sorteio/revelar', (req, res) => {
  const dados = lerDados();
  const sala = dados.salas.find(s => s.id === parseInt(req.params.id));
  
  if (!sala || !sala.sorteioAtivo) {
    return res.status(400).json({ erro: 'Sorteio não está ativo' });
  }
  
  // Encontrar vencedor
  const maletaPremio = sala.maletas.find(m => m.premio && m.dono);
  const vencedor = maletaPremio ? maletaPremio.dono : null;
  
  sala.revelado = true;
  sala.vencedor = vencedor;
  
  salvarDados(dados);
  res.json({ sucesso: true, vencedor, sala });
});

// PUT /api/salas/:id/sorteio/vencedor - Registra resultado e próxima rodada
app.put('/api/salas/:id/sorteio/vencedor', (req, res) => {
  const dados = lerDados();
  const sala = dados.salas.find(s => s.id === parseInt(req.params.id));
  
  if (!sala) {
    return res.status(404).json({ erro: 'Sala não encontrada' });
  }
  
  const { vencedor } = req.body;
  
  // ✅ Incrementar torneiosVencidos do vencedor
  if (vencedor && dados.contas[vencedor]) {
    if (!dados.contas[vencedor].torneiosVencidos) {
      dados.contas[vencedor].torneiosVencidos = 0;
    }
    dados.contas[vencedor].torneiosVencidos++;
    console.log(`🏆 ${vencedor} venceu! Total: ${dados.contas[vencedor].torneiosVencidos}`);
  }
  
  // Registrar resultado de torneio
  sala.vencedorRegistrado = vencedor;
  
  salvarDados(dados);
  res.json({ sucesso: true });
});

// PUT /api/salas/:id/sorteio/proxima - Reinicia sorteio para próxima rodada
app.put('/api/salas/:id/sorteio/proxima', (req, res) => {
  const dados = lerDados();
  const sala = dados.salas.find(s => s.id === parseInt(req.params.id));
  
  if (!sala) {
    return res.status(404).json({ erro: 'Sala não encontrada' });
  }
  
  const { ordem, totalMaletas } = req.body;
  
  if (!ordem || ordem.length < 2) {
    return res.status(400).json({ erro: 'Precisa de pelo menos 2 jogadores' });
  }
  
  // Resetar e criar novo sorteio
  const indicePremiada = Math.floor(Math.random() * totalMaletas);
  
  sala.sorteioAtivo = true;
  sala.ordem = ordem;
  sala.turnoAtual = 0;
  sala.revelado = false;
  sala.vencedor = null;
  sala.vencedorRegistrado = null;
  sala.maletas = Array(totalMaletas).fill(null).map((_, i) => ({
    numero: i + 1,
    dono: null,
    premio: i === indicePremiada
  }));
  
  salvarDados(dados);
  res.json({ sucesso: true, sala });
});

// PUT /api/salas/:id/sorteio/limpar - Cleanup: expulsa todos e limpa sorteio
app.put('/api/salas/:id/sorteio/limpar', (req, res) => {
  const dados = lerDados();
  const sala = dados.salas.find(s => s.id === parseInt(req.params.id));
  
  if (!sala) {
    return res.status(404).json({ erro: 'Sala não encontrada' });
  }
  
  // Expulsa todos os jogadores
  sala.jogadores = [];
  
  // Limpa dados do sorteio
  sala.sorteioAtivo = false;
  sala.maletas = [];
  sala.ordem = [];
  sala.turnoAtual = 0;
  sala.revelado = false;
  sala.vencedor = null;
  sala.vencedorRegistrado = null;
  
  // Mantem sala aberta mas vazia
  sala.aberta = true;
  
  salvarDados(dados);
  res.json({ sucesso: true, sala });
});

// ========== INICIAR SERVIDOR ===========

// Garantir que dados existem ao iniciar
lerDados();

// Mapa para rastrear salas e conexões
const salasConectadas = new Map(); // salaId -> Set de socketIds

// Event handlers do Socket.io
io.on('connection', (socket) => {
  console.log(`🟢 Cliente conectado: ${socket.id}`);
  
  // Jogador entra em uma sala
  socket.on('sala:entrar', (dados) => {
    const { salaId, jogadorId, jogadorNome } = dados;
    
    // Inscrever socket em uma "room" do socket.io
    socket.join(`sala_${salaId}`);
    
    // Registrar que esse jogador está nessa sala
    if (!salasConectadas.has(salaId)) {
      salasConectadas.set(salaId, new Set());
    }
    salasConectadas.get(salaId).add(socket.id);
    
    // Notificar outros na sala que alguém entrou
    io.to(`sala_${salaId}`).emit('sala:jogador-entrou', {
      jogadorId,
      jogadorNome,
      timestamp: Date.now()
    });
  });
  
  // Maleta foi aberta
  socket.on('maleta:aberta', (dados) => {
    const { salaId, numeroMaleta, jogadorDaVez } = dados;
    
    // ✅ Buscar a sala atualizada do banco de dados
    const dadosSalas = lerDados();
    const sala = dadosSalas.salas.find(s => s.id === parseInt(salaId));
    
    console.error(`🔴 [SOCKET maleta:aberta]`);
    console.error(`   salaId: ${salaId}`);
    console.error(`   numeroMaleta: ${numeroMaleta}`);
    console.error(`   jogadorDaVez: ${jogadorDaVez}`);
    console.error(`   Sala encontrada: ${sala ? 'SIM' : 'NÃO'}`);
    
    if (sala) {
      console.error(`   turnoAtual ANTES: ${sala.turnoAtual}`);
      console.error(`   turnoAtual DEPOIS: ${sala.turnoAtual}`);
      console.error(`   maletas com dono: ${sala.maletas.filter(m => m.dono).map(m => `#${m.numero}(${m.dono})`).join(', ')}`);
    }
    
    // ✅ CRÍTICO: Emitir para APENAS essa sala (io.to em vez de io.emit)
    // E ENVIAR A SALA INTEIRA ATUALIZADA para sincronizar estado
    io.to(`sala_${salaId}`).emit('maleta:aberta', {
      salaId: salaId,
      numeroMaleta,
      jogadorDaVez,
      salaAtualizada: sala,  // ✅ ENVIAR SALA INTEIRA COM TURNO ATUALIZADO
      timestamp: Date.now()
    });
    
    console.log(`📡 Maleta ${numeroMaleta} aberta por ${jogadorDaVez} na sala ${salaId} - emitindo para a sala específica`);
  });
  
  // Resultado foi revelado
  socket.on('sorteio:revelado', (dados) => {
    const { salaId, vencedor, maletas } = dados;
    
    io.to(`sala_${salaId}`).emit('sorteio:revelado', {
      vencedor,
      maletas,
      timestamp: Date.now()
    });
  });
  
  // Proxima rodada iniciada
  socket.on('sorteio:proxima', (dados) => {
    const { salaId, ordem, maletas } = dados;
    
    io.to(`sala_${salaId}`).emit('sorteio:proxima', {
      ordem,
      maletas,
      timestamp: Date.now()
    });
  });
  
  // Participante adicionado - GLOBAL (todos recebem, mesmo no lobby)
  socket.on('participante:adicionado', (dados) => {
    io.emit('participante:adicionado', {
      salaId: dados.salaId,
      jogadorId: dados.jogadorId,
      jogadorNome: dados.jogadorNome,
      timestamp: Date.now()
    });
  });
  
  // Participante removido - GLOBAL (todos recebem, mesmo no lobby)
  socket.on('participante:removido', (dados) => {
    io.emit('participante:removido', {
      salaId: dados.salaId,
      jogadorId: dados.jogadorId,
      jogadorNome: dados.jogadorNome,
      timestamp: Date.now()
    });
  });
  
  // Pagamento atualizado - GLOBAL (todos recebem para sincronizar status)
  socket.on('jogador:pagamento-atualizado', (dados) => {
    io.emit('jogador:pagamento-atualizado', {
      salaId: dados.salaId,
      jogadorId: dados.jogadorId,
      jogadorNome: dados.jogadorNome,
      pagou: dados.pagou,
      timestamp: Date.now()
    });
  });
  
  // Jogador expulso - GLOBAL (todos recebem para sincronizar remoção)
  socket.on('jogador:expulso', (dados) => {
    io.emit('jogador:expulso', {
      salaId: dados.salaId,
      jogadorId: dados.jogadorId,
      jogadorNome: dados.jogadorNome,
      timestamp: Date.now()
    });
    
    // TAMBÉM emitir participante:removido para sincronizar outros participantes
    io.emit('participante:removido', {
      salaId: dados.salaId,
      jogadorId: dados.jogadorId,
      jogadorNome: dados.jogadorNome,
      timestamp: Date.now()
    });
  });
  
  // Sorteio iniciado - GLOBAL (todos vão para tela de jogo)
  socket.on('sorteio:iniciado', (dados) => {
    io.emit('sorteio:iniciado', {
      salaId: dados.salaId,
      ordem: dados.ordem,
      timestamp: Date.now()
    });
  });
  
  // Countdown de abertura de maletas
  socket.on('maletas:comecareCountdown', (dados) => {
    io.to(`sala_${dados.salaId}`).emit('maletas:comecareCountdown', {
      salaId: dados.salaId,
      timestamp: Date.now()
    });
    console.log(`⏳ Iniciando countdown para abertura de maletas na sala ${dados.salaId}`);
  });
  
  // ✅ NOVO: Torneio encerrado - limpa tudo e avisa todos
  socket.on('torneio:encerrado', (dados) => {
    const { salaId } = dados;
    
    console.error(`🔴 [SOCKET torneio:encerrado] Sala ${salaId}`);
    
    // Buscar sala e limpar sorteio
    const dadosSalas = lerDados();
    const sala = dadosSalas.salas.find(s => s.id === parseInt(salaId));
    
    if (sala) {
      console.error(`   ANTES: sorteioAtivo=${sala.sorteioAtivo}, turnoAtual=${sala.turnoAtual}`);
      
      // Limpar estado do sorteio
      sala.sorteioAtivo = false;
      sala.maletas = [];
      sala.ordem = [];
      sala.turnoAtual = 0;
      sala.revelado = false;
      sala.vencedor = null;
      
      salvarDados(dadosSalas);
      
      console.error(`   DEPOIS: sorteioAtivo=${sala.sorteioAtivo}, turnoAtual=${sala.turnoAtual}`);
      console.log(`✅ Sorteio limpo para sala ${salaId}`);
    }
    
    // Avisar TODA a sala para voltar ao menu
    io.to(`sala_${salaId}`).emit('torneio:encerrado', {
      salaId,
      mensagem: 'Torneio encerrado - voltando ao menu',
      timestamp: Date.now()
    });
  });
  
  // Desconexão
  socket.on('disconnect', () => {
    console.log(`🔴 Cliente desconectado: ${socket.id}`)
    
    // Remover de todas as salas
    salasConectadas.forEach((sockets, salaId) => {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        io.to(`sala_${salaId}`).emit('sala:jogador-saiu', {
          socketId: socket.id,
          timestamp: Date.now()
        });
      }
    });
  });

  // ✅ NOVO: Chat - Receber e rebroadcast mensagens
  socket.on('chat:enviar', (dados) => {
    const { usuario, mensagem, tipo, salaId } = dados;
    
    console.log(`💬 Chat ${tipo} de ${usuario}: ${mensagem}`);
    
    // Validar mensagem
    if (!mensagem || !usuario || !tipo) {
      console.error('❌ Dados de chat inválidos');
      return;
    }
    
    // Rebroadcast para todos os clientes
    if (tipo === 'global') {
      // Chat global vai para TODOS
      io.emit('chat:mensagem', {
        usuario: usuario,
        mensagem: mensagem,
        tipo: 'global',
        timestamp: Date.now()
      });
    } else if (tipo === 'torneio' && salaId) {
      // Chat de torneio vai apenas para sala
      io.to(`sala_${salaId}`).emit('chat:mensagem', {
        usuario: usuario,
        mensagem: mensagem,
        tipo: 'torneio',
        salaId: salaId,
        timestamp: Date.now()
      });
    }
  });
});


servidor.listen(PORT, () => {
  const dados = lerDados();
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Salas carregadas: ${dados.salas.length}`);
  console.log(`👥 Contas carregadas: ${Object.keys(dados.contas).length}`);
  console.log(`🔌 WebSocket Socket.io ativo`);
});
