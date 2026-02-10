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
    torneios: []
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
  
  if (!sala) {
    return res.status(404).json({ erro: 'Sala não encontrada' });
  }
  
  const { ordem, totalMaletas } = req.body;
  
  if (!ordem || ordem.length < 2) {
    return res.status(400).json({ erro: 'Precisa de pelo menos 2 jogadores' });
  }
  
  // Inicializar estado do sorteio
  const indicePremiada = Math.floor(Math.random() * totalMaletas);
  
  sala.sorteioAtivo = true;
  sala.ordem = ordem;
  sala.turnoAtual = 0;
  sala.maletas = Array(totalMaletas).fill(null).map((_, i) => ({
    numero: i + 1,
    dono: null,
    premio: i === indicePremiada
  }));
  
  salvarDados(dados);
  res.json({ sucesso: true, sala });
});

// POST /api/salas/:id/maleta - Registra abertura de maleta
app.post('/api/salas/:id/maleta', (req, res) => {
  const dados = lerDados();
  const sala = dados.salas.find(s => s.id === parseInt(req.params.id));
  
  if (!sala || !sala.sorteioAtivo) {
    return res.status(400).json({ erro: 'Sorteio não está ativo' });
  }
  
  const { numeroMaleta, jogador } = req.body;
  
  if (!numeroMaleta || numeroMaleta < 1 || numeroMaleta > sala.maletas.length) {
    return res.status(400).json({ erro: 'Número de maleta inválido' });
  }
  
  if (sala.turnoAtual >= sala.ordem.length) {
    return res.status(400).json({ erro: 'Sorteio já terminou' });
  }
  
  // VALIDAÇÃO RIGOROSA DE TURNO: Verificar que quem está clicando é o jogador correto
  const jogadorDaVez = sala.ordem[sala.turnoAtual];
  
  if (jogador !== jogadorDaVez) {
    return res.status(403).json({ erro: `Não é sua vez! Aguarde ${jogadorDaVez}` });
  }
  
  const maleta = sala.maletas[numeroMaleta - 1];
  
  if (maleta.dono !== null) {
    return res.status(400).json({ erro: 'Maleta já foi escolhida' });
  }
  
  // Atualizar maleta (inclusão e incremento são práximos, minimizando race condition)
  maleta.dono = jogadorDaVez;
  sala.turnoAtual++;
  
  salvarDados(dados);
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
  
  // Registrar resultado de torneio - aqui você poderia salvar no histórico
  // Por enquanto apenas marca como registrado
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
    
    // Emitir para TODOS na sala
    io.to(`sala_${salaId}`).emit('maleta:aberta', {
      numeroMaleta,
      jogadorDaVez,
      timestamp: Date.now()
    });
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
});

servidor.listen(PORT, () => {
  const dados = lerDados();
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Salas carregadas: ${dados.salas.length}`);
  console.log(`👥 Contas carregadas: ${Object.keys(dados.contas).length}`);
  console.log(`🔌 WebSocket Socket.io ativo`);
});
