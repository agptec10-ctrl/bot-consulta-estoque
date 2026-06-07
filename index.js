const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TOKEN = "8748488253:AAE3mEFhsQOWTVZQy9QBB1sbcC8fB40zHZM";
const SHEET_ID = "1b11H23SDAjJzwXBINRGgyCcOEoOhTIXOMX_qSU-5SbQ";
const SHEET_NAME = "ANUNCIOS";

// Teste do token
console.log("Token configurado:", TOKEN.substring(0, 10) + "...");

app.post('/webhook', async (req, res) => {
  try {
    const message = req.body.message;
    if (!message || !message.text) {
      return res.sendStatus(200);
    }
    
    const chatId = message.chat.id;
    const texto = message.text;
    
    console.log(`Mensagem recebida: ${texto}`);
    console.log(`Chat ID: ${chatId}`);
    
    let resposta;
    
    if (texto === "/start") {
      resposta = "🤖 Bot de Consulta de Estoque\n\nEnvie o nome do produto ou SKU";
    } 
    else if (texto === "/estoque_baixo") {
      const produtos = await buscarPlanilha();
      resposta = await estoqueBaixo(produtos);
    }
    else {
      const produtos = await buscarPlanilha();
      resposta = await buscarProdutos(texto, produtos);
    }
    
    console.log("Enviando resposta para o Telegram...");
    
    const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text: resposta
    });
    
    console.log("Resposta enviada com sucesso!");
    res.sendStatus(200);
    
  } catch (error) {
    console.log("ERRO DETALHADO:", error.response?.data || error.message);
    res.sendStatus(200);
  }
});

app.get('/', (req, res) => {
  res.send('✅ Bot está online!');
});

async function buscarPlanilha() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
  const response = await axios.get(url);
  const jsonStr = response.data.substring(47).slice(0, -2);
  const data = JSON.parse(jsonStr);
  
  const produtos = [];
  for (let i = 1; i < data.table.rows.length; i++) {
    const row = data.table.rows[i];
    produtos.push(row.c.map(cell => cell ? cell.v : ""));
  }
  console.log(`Planilha carregada: ${produtos.length} produtos`);
  return produtos;
}

async function buscarProdutos(termoBusca, produtos) {
  const termo = termoBusca.toLowerCase();
  const resultados = produtos.filter(p => 
    (p[1] || "").toLowerCase().includes(termo) || 
    (p[2] || "").toLowerCase().includes(termo)
  );
  
  if (resultados.length === 0) {
    return `🔍 Nenhum produto encontrado para: "${termoBusca}"`;
  }
  
  let resposta = `🔍 ${resultados.length} produto(s) encontrado(s):\n\n`;
  
  // USANDO A CONFIGURAÇÃO
  const limite = CONFIG.MAX_RESULTADOS || 5;
  
  for (let i = 0; i < Math.min(resultados.length, limite); i++) {
    const p = resultados[i];
    resposta += `📦 ${p[1]}\nSKU: ${p[2]}\nEstoque: ${p[3] || 0}\n-------------------\n`;
  }
  return resposta;
}

  const termo = termoBusca.toLowerCase();
  const resultados = produtos.filter(p => 
    (p[1] || "").toLowerCase().includes(termo) || 
    (p[2] || "").toLowerCase().includes(termo)
  );
  
  if (resultados.length === 0) {
    return `🔍 Nenhum produto encontrado para: "${termoBusca}"`;
  }
  
  let resposta = `🔍 ${resultados.length} produto(s) encontrado(s):\n\n`;
  for (let i = 0; i < Math.min(resultados.length, 5); i++) {
    const p = resultados[i];
    resposta += `📦 ${p[1]}\nSKU: ${p[2]}\nEstoque: ${p[3] || 0}\n-------------------\n`;
  }
  return resposta;
}

async function estoqueBaixo(produtos) {
  const baixos = produtos.filter(p => {
    const estoque = p[3] || 0;
    return estoque > 0 && estoque < 10;
  });
  
  if (baixos.length === 0) {
    return "✅ Nenhum produto com estoque baixo";
  }
  
  let resposta = `⚠️ ESTOQUE BAIXO (<10):\n\n`;
  for (const p of baixos) {
    resposta += `📦 ${p[1]}\nSKU: ${p[2]}\n⚠️ Estoque: ${p[3]}\n---\n`;
  }
  return resposta;
}

// ... todo o código existente ...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));





// ==========================================
// ⚙️ SETOR DE CONFIGURAÇÕES (ALTERE APENAS AQUI)
// ==========================================

const CONFIG = {
  MAX_RESULTADOS: 10,
  BUSCAR_POR_NOME: true,
  BUSCAR_POR_SKU: true,
  MOSTRAR_PRECO: true,
  MOSTRAR_EMOJI_ESTOQUE: true
};









const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot rodando na porta ${PORT}`);
  console.log(`📡 Webhook URL: https://bot-consulta-estoque.onrender.com/webhook`);
});
