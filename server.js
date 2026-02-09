const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
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

// ========== INICIAR SERVIDOR ==========

// Garantir que dados existem ao iniciar
lerDados();

app.listen(PORT, () => {
  const dados = lerDados();
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Salas carregadas: ${dados.salas.length}`);
  console.log(`👥 Contas carregadas: ${Object.keys(dados.contas).length}`);
});
