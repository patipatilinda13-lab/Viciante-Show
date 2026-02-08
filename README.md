# 🎲 Viciante Show - Sorteio das Maletas

Aplicação web para sorteio de maletas com sistema de autenticação e gerenciamento de salas.

## 🚀 Como Usar

### Local (Desenvolvimento)

1. **Instalar dependências**:
```bash
npm install
```

2. **Iniciar o servidor**:
```bash
npm start
```

3. **Acessar a aplicação**:
Abra `http://localhost:3000` no navegador

### Deploy no Render

1. **Fazer push para GitHub**
2. **No Render.com**:
   - Criar novo Web Service
   - Conectar repositório GitHub
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables: (nenhuma necessária por enquanto)

## 📁 Estrutura do Projeto

```
├── index.html          # Interface do frontend
├── script.js           # Lógica do frontend
├── style.css           # Estilos
├── server.js           # Servidor Node.js/Express
├── package.json        # Dependências
├── data.json           # Banco de dados (salas e contas)
├── .gitignore          # Arquivos a não fazer upload
└── README.md           # Este arquivo
```

## 🔌 Endpoints da API

### Salas
- `GET /api/salas` - Retorna todas as salas
- `POST /api/salas` - Salva/atualiza as salas

### Contas
- `POST /api/contas/registrar` - Registra nova conta
- `POST /api/contas/login` - Faz login
- `GET /api/contas?senha=@@Lucas2014@@` - Lista contas (admin)
- `DELETE /api/contas?senha=@@Lucas2014@@` - Limpa contas (admin)

## 📝 Senhas Padrão

- **Admin**: `@@Lucas2014@@`

## 📦 O que fazer upload no GitHub

✅ **FAZER UPLOAD:**
- `index.html`
- `script.js`
- `style.css`
- `server.js`
- `package.json`
- `.gitignore`
- `README.md`

❌ **NÃO FAZER UPLOAD:**
- `node_modules/` (gerado automaticamente)
- `data.json` (gerado em tempo de execução)
- `.env` (se houver variáveis sensíveis)

## 🔐 Segurança

- Senhas com hash simples (considere usar bcryptjs em produção)
- CORS habilitado para requests de qualquer origem
- Admin verificado por senha

## 📝 Notas

- O `data.json` é criado automaticamente na primeira execução
- Dados são persistidos localmente no servidor
- Para produção, considere usar um banco de dados real (MongoDB, PostgreSQL)
