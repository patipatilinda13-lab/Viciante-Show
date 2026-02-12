const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const servidor = http.createServer(app);
const io = socketIo(servidor, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
const PORT = process.env.PORT || 3000;

// ========== CONFIGURAÇÃO DO BANCO DE DADOS MONGODB ==========

const MONGO_URI = "mongodb+srv://iacodeplay_db_user:GYQfCg6KLV6RRbfm@cluster0.2pfk0l2.mongodb.net/vicianteshow?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('🟢 ✅ Conectado ao MongoDB Atlas com sucesso!');
    console.log('   Database: vicianteshow');
    console.log('   Cluster: cluster0');
  })
  .catch(err => {
    console.error('🔴 ❌ Erro ao conectar no MongoDB:', err.message);
    process.exit(1);
  });

// Middleware
app.use(cors());
app.use(express.json());

// ========== SCHEMAS (MODELOS DO BANCO) ==========

// Modelo da Conta
const ContaSchema = new mongoose.Schema({
  id: String,
  login: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  senhaPlana: String,
  dataCriacao: { type: Date, default: Date.now },
  foto: { type: String, default: "f1" },
  pensamentoDoDia: { type: String, default: "" },
  torneiosVencidos: { type: Number, default: 0 },
  torneios: [{
    salaId: Number,
    salaNome: String,
    valor: Number,
    resultado: String,
    vencedor: String,
    data: { type: Date, default: Date.now }
  }]
});

const Conta = mongoose.model('Conta', ContaSchema);

// Modelo da Sala
const SalaSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  nome: String,
  valor: Number,
  limite: Number,
  aberta: { type: Boolean, default: true },
  moderador: { type: String, default: null },
  
  jogadores: [{
    id: String,
    nome: String,
    pagou: { type: Boolean, default: false },
    sessionId: String
  }],
  
  sorteioAtivo: { type: Boolean, default: false },
  ordem: [String],
  turnoAtual: { type: Number, default: 0 },
  revelado: { type: Boolean, default: false },
  vencedor: { type: String, default: null },
  vencedorRegistrado: { type: String, default: null },
  
  maletas: [{
    numero: Number,
    dono: { type: String, default: null },
    premio: Boolean
  }],
  
  descuento: Boolean,
  createdAt: { type: Date, default: Date.now }
});

const Sala = mongoose.model('Sala', SalaSchema);


// ========== INICIALIZAÇÃO DE DADOS PADRÃO ==========
async function inicializarSalasPadrao() {
  try {
    const contagem = await Sala.countDocuments();
    if (contagem === 0) {
      console.log("⚠️ Nenhuma sala encontrada. Criando salas padrão no MongoDB...");
      const salasPadrao = [
        {
          id: 1,
          nome: "Partida 10 reais",
          valor: 10,
          limite: 10,
          aberta: true,
          jogadores: [],
          sorteioAtivo: false,
          ordem: [],
          turnoAtual: 0,
          maletas: [],
          revelado: false,
          vencedor: null
        },
        {
          id: 2,
          nome: "Partida 20 reais",
          valor: 20,
          limite: 10,
          aberta: true,
          jogadores: [],
          sorteioAtivo: false,
          ordem: [],
          turnoAtual: 0,
          maletas: [],
          revelado: false,
          vencedor: null
        }
      ];
      await Sala.insertMany(salasPadrao);
      console.log("✅ Salas padrão criadas no MongoDB!");
    } else {
      console.log(`✅ MongoDB já tem ${contagem} sala(s) configurada(s)`);
    }
  } catch (error) {
    console.error("🔴 Erro ao inicializar salas:", error);
  }
}

inicializarSalasPadrao();


// ========== ENDPOINTS DE SALAS ==========

// GET /api/salas
app.get('/api/salas', async (req, res) => {
  try {
    const salas = await Sala.find().sort({ id: 1 });
    res.json(salas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao buscar salas" });
  }
});

// GET /api/salas/:id
app.get('/api/salas/:id', async (req, res) => {
  try {
    const sala = await Sala.findOne({ id: parseInt(req.params.id) });
    if (!sala) return res.status(404).json({ erro: 'Sala não encontrada' });
    res.json(sala);
  } catch (e) {
    res.status(500).json({ erro: "Erro ao buscar sala" });
  }
});

// POST /api/salas (Atualizar múltiplas)
app.post('/api/salas', async (req, res) => {
  try {
    const salasRecebidas = req.body;
    
    for (const sala of salasRecebidas) {
      await Sala.findOneAndUpdate(
        { id: sala.id },
        sala,
        { upsert: true, new: true }
      );
    }
    
    res.json({ sucesso: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao salvar salas" });
  }
});

// PUT /api/salas/:id (Atualizar uma sala específica)
app.put('/api/salas/:id', async (req, res) => {
  try {
    const salaId = parseInt(req.params.id);
    const atualizacao = req.body;
    
    delete atualizacao._id;
    
    const salaAtualizada = await Sala.findOneAndUpdate(
      { id: salaId },
      atualizacao,
      { new: true }
    );
    
    if (!salaAtualizada) return res.status(404).json({ erro: 'Sala não encontrada' });
    
    res.json(salaAtualizada);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao atualizar sala" });
  }
});

// ========== ENDPOINTS DE CONTAS ==========

// GET /api/contas (Protegido)
app.get('/api/contas', async (req, res) => {
  const senha = req.query.senha;
  if (senha !== '@@Lucas2014@@') {
    return res.status(403).json({ erro: 'Não autorizado' });
  }
  
  try {
    const contas = await Conta.find();
    const contasMap = {};
    contas.forEach(c => contasMap[c.login] = c);
    res.json(contasMap);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao buscar contas" });
  }
});


// POST /api/contas/registrar
app.post('/api/contas/registrar', async (req, res) => {
  const { login, senha } = req.body;
  
  if (login.length < 6) {
    return res.status(400).json({ erro: 'Login deve ter mínimo 6 caracteres' });
  }

  try {
    const existe = await Conta.findOne({ login });
    if (existe) return res.status(400).json({ erro: 'Login já existe' });

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
    
    const novaConta = new Conta({
      id: id,
      login: login,
      senha: hashSenha(senha),
      senhaPlana: senha,
      dataCriacao: new Date(),
      torneios: [],
      torneiosVencidos: 0
    });

    await novaConta.save();
    
    console.log(`✅ Nova conta criada: ${login}`);
    res.json({ sucesso: true, id: id, login: login });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao registrar" });
  }
});

// POST /api/contas/login
app.post('/api/contas/login', async (req, res) => {
  const { login, senha } = req.body;
  
  try {
    const conta = await Conta.findOne({ login });
    if (!conta) return res.status(401).json({ erro: 'Login ou senha incorretos' });

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

    console.log(`✅ Login realizado: ${login}`);
    res.json({ sucesso: true, id: conta.id, login: conta.login });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro no login" });
  }
});

// GET /api/perfil/:login
app.get('/api/perfil/:login', async (req, res) => {
  try {
    const conta = await Conta.findOne({ login: req.params.login });
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada' });
    
    res.json({
      login: conta.login,
      foto: conta.foto || "f1",
      pensamentoDoDia: conta.pensamentoDoDia || "",
      torneiosVencidos: conta.torneiosVencidos || 0,
      dataCriacao: conta.dataCriacao,
      torneios: conta.torneios || []
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao buscar perfil" });
  }
});

// PUT /api/perfil/:login
app.put('/api/perfil/:login', async (req, res) => {
  try {
    const { foto, pensamentoDoDia } = req.body;
    const conta = await Conta.findOne({ login: req.params.login });
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada' });

    if (foto) {
      if (!/^f(1[0-5]|[1-9])$/.test(foto)) {
        return res.status(400).json({ erro: 'Foto inválida' });
      }
      conta.foto = foto;
    }
    
    if (pensamentoDoDia !== undefined) {
      if (pensamentoDoDia.length > 200) {
        return res.status(400).json({ erro: 'Texto muito longo' });
      }
      conta.pensamentoDoDia = pensamentoDoDia;
    }

    await conta.save();
    
    res.json({
      sucesso: true,
      perfil: {
        login: conta.login,
        foto: conta.foto,
        pensamentoDoDia: conta.pensamentoDoDia,
        torneiosVencidos: conta.torneiosVencidos
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao atualizar perfil" });
  }
});

// DELETE /api/contas (Zerar tudo - Admin)
app.delete('/api/contas', async (req, res) => {
  const senha = req.query.senha;
  if (senha !== '@@Lucas2014@@') {
    return res.status(403).json({ erro: 'Não autorizado' });
  }
  
  try {
    await Conta.deleteMany({});
    res.json({ sucesso: true, mensagem: 'Todas as contas deletadas' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao zerar contas" });
  }
});

// DELETE /api/contas/:login (Deletar conta específica)
app.delete('/api/contas/:login', async (req, res) => {
  const senha = req.query.senha;
  if (senha !== '@@Lucas2014@@') {
    return res.status(403).json({ erro: 'Não autorizado' });
  }
  
  try {
    const resultado = await Conta.deleteOne({ login: req.params.login });
    if (resultado.deletedCount === 0) {
      return res.status(404).json({ erro: 'Conta não encontrada' });
    }
    res.json({ sucesso: true, mensagem: `Conta ${req.params.login} deletada` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao apagar conta" });
  }
});

// ========== ENDPOINTS DE SORTEIO ==========

// PUT /api/salas/:id/sorteio - Inicia novo sorteio
app.put('/api/salas/:id/sorteio', async (req, res) => {
  try {
    const salaId = parseInt(req.params.id);
    const { ordem, totalMaletas } = req.body;
    
    console.error(`🔴 [SORTEIO] PUT /api/salas/${salaId}/sorteio - INICIANDO`);
    
    if (!ordem || ordem.length < 2) {
      return res.status(400).json({ erro: 'Precisa de pelo menos 2 jogadores' });
    }

    const sala = await Sala.findOne({ id: salaId });
    if (!sala) return res.status(404).json({ erro: 'Sala não encontrada' });

    const indicePremiada = Math.floor(Math.random() * totalMaletas);
    const novasMaletas = Array(totalMaletas).fill(null).map((_, i) => ({
      numero: i + 1,
      dono: null,
      premio: i === indicePremiada
    }));

    sala.sorteioAtivo = true;
    sala.ordem = ordem;
    sala.turnoAtual = 0;
    sala.revelado = false;
    sala.vencedor = null;
    sala.vencedorRegistrado = null;
    sala.maletas = novasMaletas;

    await sala.save();
    
    console.error(`   ✅ Sorteio iniciado: ordem=[${ordem.join(', ')}]`);
    console.error(`   Maleta premiada: #${indicePremiada + 1}`);
    res.json({ sucesso: true, sala });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao iniciar sorteio" });
  }
});

// POST /api/salas/:id/maleta - Registra abertura de maleta
app.post('/api/salas/:id/maleta', async (req, res) => {
  try {
    const salaId = parseInt(req.params.id);
    const { numeroMaleta, jogador } = req.body;

    console.error(`🔴 [MALETA] POST /api/salas/${salaId}/maleta`);

    const sala = await Sala.findOne({ id: salaId });
    
    console.error(`   Sala encontrada? ${sala ? 'SIM' : 'NÃO'}`);
    if (sala) {
      console.error(`   sorteioAtivo: ${sala.sorteioAtivo}`);
      console.error(`   turnoAtual: ${sala.turnoAtual}`);
      console.error(`   ordem: [${(sala.ordem || []).join(', ')}]`);
    }

    if (!sala || !sala.sorteioAtivo) {
      return res.status(400).json({ erro: 'Sorteio não está ativo' });
    }

    if (numeroMaleta < 1 || numeroMaleta > sala.maletas.length) {
      return res.status(400).json({ erro: 'Número de maleta inválido' });
    }

    if (!sala.ordem || sala.ordem.length === 0) {
      return res.status(400).json({ erro: 'Ordem do sorteio está vazia' });
    }

    if (sala.turnoAtual >= sala.ordem.length) {
      console.error(`❌ Sorteio já terminou (turnoAtual ${sala.turnoAtual} >= ordem.length ${sala.ordem.length})`);
      return res.status(400).json({ erro: 'Sorteio já terminou' });
    }

    const jogadorDaVez = sala.ordem[sala.turnoAtual];
    
    console.error(`   Jogador da vez: ${jogadorDaVez}`);
    console.error(`   Jogador solicitante: ${jogador}`);

    if (jogador !== jogadorDaVez) {
      return res.status(403).json({ erro: `Não é sua vez! Vez de ${jogadorDaVez}` });
    }

    const maleta = sala.maletas[numeroMaleta - 1];

    if (maleta.dono !== null) {
      return res.status(400).json({ erro: 'Maleta já foi escolhida' });
    }

    maleta.dono = jogador;
    sala.turnoAtual++;

    await sala.save();

    console.error(`   ✅ Maleta ${numeroMaleta} atribuída a ${jogador}`);
    console.error(`   turnoAtual: ${sala.turnoAtual - 1} → ${sala.turnoAtual}`);

    res.json({ sucesso: true, sala });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao abrir maleta" });
  }
});

// PUT /api/salas/:id/sorteio/revelar
app.put('/api/salas/:id/sorteio/revelar', async (req, res) => {
  try {
    const sala = await Sala.findOne({ id: parseInt(req.params.id) });
    if (!sala) return res.status(404).json({ erro: 'Sala não encontrada' });

    const maletaPremio = sala.maletas.find(m => m.premio && m.dono);
    const vencedor = maletaPremio ? maletaPremio.dono : null;

    sala.revelado = true;
    sala.vencedor = vencedor;

    await sala.save();

    if (vencedor) {
      await Conta.updateOne(
        { login: vencedor },
        { $inc: { torneiosVencidos: 1 } }
      );
      console.log(`🏆 ${vencedor} venceu!`);
    }

    res.json({ sucesso: true, vencedor, sala });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao revelar" });
  }
});

// PUT /api/salas/:id/sorteio/vencedor - Registra resultado e histórico
app.put('/api/salas/:id/sorteio/vencedor', async (req, res) => {
  try {
    const sala = await Sala.findOne({ id: parseInt(req.params.id) });
    
    if (!sala) return res.status(404).json({ erro: 'Sala não encontrada' });
    
    const { vencedor, jogadores } = req.body;
    
    console.error(`🔴 [VENCEDOR] Processando resultado: ${vencedor}`);
    console.error(`   Jogadores: ${jogadores?.map(j => j.nome || j.id).join(', ') || 'NENHUM'}`);
    
    // ✅ Registrar histórico para TODOS os jogadores
    if (jogadores && Array.isArray(jogadores)) {
      jogadores.forEach(jogador => {
        const loginJogador = jogador.nome || jogador.id;
        
        (async () => {
          const conta = await Conta.findOne({ login: loginJogador });
          
          if (conta) {
            const resultado = loginJogador === vencedor ? "ganhou" : "perdeu";
            
            if (!Array.isArray(conta.torneios)) {
              conta.torneios = [];
            }
            
            conta.torneios.push({
              salaId: sala.id,
              salaNome: sala.nome,
              valor: sala.valor,
              resultado: resultado,
              vencedor: vencedor,
              data: new Date()
            });
            
            if (loginJogador === vencedor) {
              conta.torneiosVencidos = (conta.torneiosVencidos || 0) + 1;
            }
            
            await conta.save();
            console.error(`   ✅ ${loginJogador}: ${resultado}`);
          }
        })();
      });
    }
    
    sala.vencedorRegistrado = vencedor;
    await sala.save();
    
    console.error(`   ✅ Dados salvos no MongoDB`);
    res.json({ sucesso: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao registrar vencedor" });
  }
});

// PUT /api/salas/:id/sorteio/terminar
app.put('/api/salas/:id/sorteio/terminar', async (req, res) => {
  try {
    const sala = await Sala.findOne({ id: parseInt(req.params.id) });
    if (!sala) return res.status(404).json({ erro: 'Sala não encontrada' });

    sala.sorteioAtivo = false;
    sala.maletas = [];
    sala.ordem = [];
    sala.turnoAtual = 0;
    sala.revelado = false;
    sala.vencedor = null;

    await sala.save();
    
    console.log(`✅ Sorteio terminado para sala ${req.params.id}`);
    res.json({ sucesso: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao terminar sorteio" });
  }
});

// PUT /api/salas/:id/sorteio/limpar
app.put('/api/salas/:id/sorteio/limpar', async (req, res) => {
  try {
    const sala = await Sala.findOne({ id: parseInt(req.params.id) });
    if (!sala) return res.status(404).json({ erro: 'Sala não encontrada' });

    sala.jogadores = [];
    sala.sorteioAtivo = false;
    sala.maletas = [];
    sala.ordem = [];
    sala.turnoAtual = 0;
    sala.revelado = false;
    sala.vencedor = null;
    sala.aberta = true;

    await sala.save();
    
    console.log(`✅ Sala ${req.params.id} limpa - pronta para novo sorteio`);
    res.json({ sucesso: true, sala });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao limpar sala" });
  }
});

// PUT /api/salas/:id/sorteio/proxima
app.put('/api/salas/:id/sorteio/proxima', async (req, res) => {
  try {
    const { ordem, totalMaletas } = req.body;
    const sala = await Sala.findOne({ id: parseInt(req.params.id) });
    if (!sala) return res.status(404).json({ erro: 'Sala não encontrada' });

    const indicePremiada = Math.floor(Math.random() * totalMaletas);
    const novasMaletas = Array(totalMaletas).fill(null).map((_, i) => ({
      numero: i + 1,
      dono: null,
      premio: i === indicePremiada
    }));

    sala.sorteioAtivo = true;
    sala.ordem = ordem;
    sala.turnoAtual = 0;
    sala.revelado = false;
    sala.vencedor = null;
    sala.maletas = novasMaletas;

    await sala.save();
    
    console.log(`✅ Próxima rodada iniciada para sala ${req.params.id}`);
    res.json({ sucesso: true, sala });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro na próxima rodada" });
  }
});

// ========== SOCKET.IO ==========

const salasConectadas = new Map();

io.on('connection', (socket) => {
  console.log(`🟢 Cliente conectado: ${socket.id}`);
  
  socket.on('sala:entrar', (dados) => {
    socket.join(`sala_${dados.salaId}`);
    io.to(`sala_${dados.salaId}`).emit('sala:jogador-entrou', {
      jogadorId: dados.jogadorId,
      jogadorNome: dados.jogadorNome,
      timestamp: Date.now()
    });
  });
  
  socket.on('maleta:aberta', async (dados) => {
    const sala = await Sala.findOne({ id: parseInt(dados.salaId) });
    io.to(`sala_${dados.salaId}`).emit('maleta:aberta', {
      ...dados,
      salaAtualizada: sala,
      timestamp: Date.now()
    });
  });
  
  socket.on('sorteio:revelado', (dados) => {
    io.to(`sala_${dados.salaId}`).emit('sorteio:revelado', {
      ...dados,
      timestamp: Date.now()
    });
  });
  
  socket.on('sorteio:proxima', (dados) => {
    io.to(`sala_${dados.salaId}`).emit('sorteio:proxima', {
      ...dados,
      timestamp: Date.now()
    });
  });
  
  socket.on('participante:adicionado', (dados) => {
    io.emit('participante:adicionado', {
      ...dados,
      timestamp: Date.now()
    });
  });
  
  socket.on('participante:removido', (dados) => {
    io.emit('participante:removido', {
      ...dados,
      timestamp: Date.now()
    });
  });
  
  socket.on('jogador:pagamento-atualizado', (dados) => {
    io.emit('jogador:pagamento-atualizado', {
      ...dados,
      timestamp: Date.now()
    });
  });
  
  socket.on('jogador:expulso', (dados) => {
    io.emit('jogador:expulso', {
      ...dados,
      timestamp: Date.now()
    });
    io.emit('participante:removido', {
      ...dados,
      timestamp: Date.now()
    });
  });
  
  socket.on('sorteio:iniciado', (dados) => {
    io.emit('sorteio:iniciado', {
      ...dados,
      timestamp: Date.now()
    });
  });
  
  socket.on('maletas:comecareCountdown', (dados) => {
    io.to(`sala_${dados.salaId}`).emit('maletas:comecareCountdown', {
      ...dados,
      timestamp: Date.now()
    });
  });
  
  socket.on('torneio:encerrado', async (dados) => {
    const sala = await Sala.findOne({ id: parseInt(dados.salaId) });
    if (sala) {
      sala.sorteioAtivo = false;
      await sala.save();
    }
    io.to(`sala_${dados.salaId}`).emit('torneio:encerrado', {
      ...dados,
      timestamp: Date.now()
    });
  });

  socket.on('chat:enviar', (dados) => {
    if (dados.tipo === 'global') {
      io.emit('chat:mensagem', {
        ...dados,
        timestamp: Date.now()
      });
    } else if (dados.tipo === 'torneio' && dados.salaId) {
      io.to(`sala_${dados.salaId}`).emit('chat:mensagem', {
        ...dados,
        timestamp: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Cliente desconectado: ${socket.id}`);
  });
});

// ========== INICIAR SERVIDOR ==========

servidor.listen(PORT, () => {
  console.log(`\n🚀 ================================`);
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🚀 Database: MongoDB Atlas`);
  console.log(`🚀 Socket.io: Ativo`);
  console.log(`🚀 ================================\n`);
});

module.exports = { Conta, Sala };
