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
  // Remove acentos da busca
  const termoSemAcento = removerAcentos(termoBusca.toLowerCase());
  const palavras = termoSemAcento.trim().split(/\s+/);
  
  for (let numPalavras = palavras.length; numPalavras >= 1; numPalavras--) {
    const termosBusca = palavras.slice(0, numPalavras);
    
    const resultados = produtos.filter(p => {
      // Remove acentos do título e SKU
      const titulo = removerAcentos((p[1] || "").toLowerCase());
      const sku = removerAcentos((p[2] || "").toLowerCase());
      const textoBusca = titulo + " " + sku;
      
      return termosBusca.every(palavra => textoBusca.includes(palavra));
    });
    
    if (resultados.length > 0) {
      let resposta = `🔍 ${resultados.length} produto(s) encontrado(s) com ${numPalavras} palavra(s):\n\n`;
      
      for (let i = 0; i < Math.min(resultados.length, 10); i++) {
        const p = resultados[i];
        let estoque = p[3] || 0;
        let emoji = estoque <= 0 ? "❌" : (estoque < 10 ? "⚠️" : "✅");
        const precoML = p[4] ? `R$ ${parseFloat(p[4]).toFixed(2).replace('.', ',')}` : 'R$ 0,00';
        const precoBalcao = p[7] ? `R$ ${parseFloat(p[7]).toFixed(2).replace('.', ',')}` : 'R$ 0,00';
        
        resposta += `📦 ${p[1]}\nSKU: ${p[2]}\nEstoque: ${emoji} ${estoque}\nPreço ML: ${precoML}\nPreço Balcão: ${precoBalcao}\n-------------------\n`;
      }
      return resposta;
    }
  }
  
  return `🔍 Nenhum produto encontrado para: "${termoBusca}"`;
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot rodando na porta ${PORT}`);
  console.log(`📡 Webhook URL: https://bot-consulta-estoque.onrender.com/webhook`);
});
