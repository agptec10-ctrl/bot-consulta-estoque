const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TOKEN = "8748488253:AAE3mEFhsQOWTVZQy9QBB1sbcC8fB40zHZM";
const SHEET_ID = "1b11H23SDAjJzwXBINRGgyCcOEoOhTIXOMX_qSU-5SbQ";
const SHEET_NAME = "ANUNCIOS";

app.post('/webhook', async (req, res) => {
  try {
    const message = req.body.message;
    if (!message || !message.text) return res.sendStatus(200);
    
    const chatId = message.chat.id;
    const texto = message.text;
    
    console.log(`Mensagem: ${texto}`);
    
    let resposta;
    
    if (texto === "/start") {
      resposta = "Bot de Consulta de Estoque - Envie o nome do produto";
    } else if (texto === "/estoque_baixo") {
      const produtos = await buscarPlanilha();
      resposta = await estoqueBaixo(produtos);
    } else {
      const produtos = await buscarPlanilha();
      resposta = await buscarProdutos(texto, produtos);
    }
    
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: resposta
    });
    
    res.sendStatus(200);
  } catch (error) {
    console.log("Erro:", error.message);
    res.sendStatus(200);
  }
});

app.get('/', (req, res) => {
  res.send('Bot online');
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
  return produtos;
}

async function buscarProdutos(termoBusca, produtos) {
  const termo = termoBusca.toLowerCase();
  const resultados = produtos.filter(p => 
    (p[1] || "").toLowerCase().includes(termo) || 
    (p[2] || "").toLowerCase().includes(termo)
  );
  
  if (resultados.length === 0) {
    return `Nenhum produto encontrado para: "${termoBusca}"`;
  }
  
  let resposta = `${resultados.length} produto(s) encontrado(s):\n\n`;
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
    return "Nenhum produto com estoque baixo";
  }
  
  let resposta = `PRODUTOS COM ESTOQUE BAIXO:\n\n`;
  for (const p of baixos) {
    resposta += `📦 ${p[1]}\nSKU: ${p[2]}\nEstoque: ${p[3]}\n---\n`;
  }
  return resposta;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
