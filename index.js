const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TOKEN = "8981952623:AAFkQ_6zgt5mpCmBKNh9gx4q-rak8osPkRc";
const SHEET_ID = "1b11H23SDAjJzwXBINRGgyCcOEoOhTIXOMX_qSU-5SbQ";
const SHEET_NAME = "ANUNCIOS";

// ==========================================
// FUNÇÃO PARA REMOVER ACENTOS
// ==========================================
function removerAcentos(texto) {
  const acentos = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n'
  };
  return texto.replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/gi, letra => acentos[letra] || letra);
}

// ==========================================
// BUSCAR DADOS NA PLANILHA
// ==========================================
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

// ==========================================
// WEBHOOK DO TELEGRAM
// ==========================================
app.post('/webhook', async (req, res) => {
  try {
    const message = req.body.message;
    if (!message || !message.text) {
      return res.sendStatus(200);
    }
    
    const chatId = message.chat.id;
    const texto = message.text;
    
    console.log(`Mensagem recebida: ${texto}`);
    
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
  res.send('✅ Bot está online!');
});

// ==========================================
// BUSCAR PRODUTOS
// ==========================================
async function buscarProdutos(termoBusca, produtos) {
  const termoSemAcento = removerAcentos(termoBusca.toLowerCase());
  
  // Lista de palavras comuns a ignorar
  const palavrasComuns = ["para", "de", "a", "o", "e", "da", "do", "das", "dos", "em", "um", "uma", "com", "por", "pra", "pro", "na", "no", "nas", "nos"];
  let palavras = termoSemAcento.trim().split(/\s+/);
  
  // Filtra removendo palavras comuns
  palavras = palavras.filter(palavra => !palavrasComuns.includes(palavra));
  
  // Se não sobrou nenhuma palavra, mantém as originais
  if (palavras.length === 0) {
    palavras = termoSemAcento.trim().split(/\s+/);
  }
  
  // Tenta do maior número de palavras para o menor
  for (let numPalavras = palavras.length; numPalavras >= 1; numPalavras--) {
    // Gera todas as combinações possíveis de 'numPalavras' palavras
    const combinacoes = gerarCombinacoes(palavras, numPalavras);
    let melhoresResultados = [];
    
    for (const combinacao of combinacoes) {
      const resultados = produtos.filter(p => {
        const titulo = removerAcentos((p[1] || "").toLowerCase());
        const sku = removerAcentos((p[2] || "").toLowerCase());
        const textoBusca = titulo + " " + sku;
        return combinacao.every(palavra => textoBusca.includes(palavra));
      });
      
      if (resultados.length > melhoresResultados.length) {
        melhoresResultados = resultados;
      }
    }
    
    if (melhoresResultados.length > 0) {
      // Remove duplicatas por SKU
      const skusVistos = new Set();
      const resultadosUnicos = [];
      for (const p of melhoresResultados) {
        const sku = p[2] || "SEM_SKU";
        if (!skusVistos.has(sku)) {
          skusVistos.add(sku);
          resultadosUnicos.push(p);
        }
      }
      
      // ==========================================
      // CONSTRUÇÃO DA RESPOSTA
      // ==========================================
      let resposta = `🔍 ${melhoresResultados.length} anúncios encontrados, ${resultadosUnicos.length} produto(s) único(s):\n\n`;
      
      // ==========================================
      // SEÇÃO 1: ANÚNCIOS (MERCADO LIVRE)
      // ==========================================
      resposta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      resposta += `📢 ANÚNCIOS (MERCADO LIVRE)\n`;
      resposta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      // Mostra anúncios (coluna B) - limitado a 10
      for (let i = 0; i < Math.min(resultadosUnicos.length, 10); i++) {
        const p = resultadosUnicos[i];
        const estoque = p[3] || 0;
        const emoji = estoque <= 0 ? "❌" : (estoque < 10 ? "⚠️" : "✅");
        const precoML = p[4] ? `R$ ${parseFloat(p[4]).toFixed(2).replace('.', ',')}` : 'R$ 0,00';
        
        resposta += `📢 ${p[1]}\n`;
        resposta += `SKU: ${p[2]}\n`;
        resposta += `Quantidade: ${emoji} ${estoque}\n`;
        resposta += `Preço ML: ${precoML}\n`;
        resposta += `────────────────────────────────────────────────────\n\n`;
      }
      
      // ==========================================
      // SEÇÃO 2: PRODUTOS NO ESTOQUE (ESTOQUE BALCÃO)
      // ==========================================
      resposta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      resposta += `📦 PRODUTOS NO ESTOQUE (ESTOQUE BALCÃO)\n`;
      resposta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      // Mostra produtos originais (coluna I) - SOMENTE se tiver título original
      let contadorProdutos = 0;
      for (let i = 0; i < resultadosUnicos.length && contadorProdutos < 10; i++) {
        const p = resultadosUnicos[i];
        const tituloOriginal = p[8] && p[8] !== "" ? p[8] : "";
        const precoBalcao = p[7] && p[7] !== "" && parseFloat(p[7]) > 0 ? p[7] : null;
        
        // SÓ MOSTRA SE TIVER TÍTULO ORIGINAL (coluna I) E PREÇO BALCÃO VÁLIDO
        if (tituloOriginal && precoBalcao !== null) {
          const estoque = p[3] || 0;
          const emoji = estoque <= 0 ? "❌" : (estoque < 10 ? "⚠️" : "✅");
          const precoBalcaoFmt = `R$ ${parseFloat(precoBalcao).toFixed(2).replace('.', ',')}`;
          const alocacao = p[9] && p[9] !== "" ? p[9] : "Não informada";
          
          resposta += `📦 ${tituloOriginal}\n`;
          resposta += `SKU: ${p[2]}\n`;
          resposta += `Alocação: ${alocacao}\n`;
          resposta += `Quantidade: ${emoji} ${estoque}\n`;
          resposta += `Preço Balcão: ${precoBalcaoFmt}\n`;
          resposta += `────────────────────────────────────────────────────\n\n`;
          contadorProdutos++;
        }
      }
      
      // Se não mostrou nenhum produto, avisa
      if (contadorProdutos === 0) {
        resposta += `ℹ️ Nenhum produto com título original e preço Balcão cadastrado.\n\n`;
      }
      
      return resposta;
    }
  }
  
  return `🔍 Nenhum produto encontrado para: "${termoBusca}"`;
}

// ==========================================
// FUNÇÃO PARA GERAR COMBINAÇÕES
// ==========================================
function gerarCombinacoes(arr, tamanho) {
  const combinacoes = [];
  
  function gerar(inicio, atual) {
    if (atual.length === tamanho) {
      combinacoes.push([...atual]);
      return;
    }
    for (let i = inicio; i < arr.length; i++) {
      atual.push(arr[i]);
      gerar(i + 1, atual);
      atual.pop();
    }
  }
  
  gerar(0, []);
  return combinacoes;
}

// ==========================================
// ESTOQUE BAIXO
// ==========================================
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
    const estoque = p[3] || 0;
    resposta += `📦 ${p[1]}\nSKU: ${p[2]}\n⚠️ Estoque: ${estoque}\n---\n`;
  }
  return resposta;
}

// ==========================================
// INICIAR SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot rodando na porta ${PORT}`);
});
