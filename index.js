const express = require("express");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");
const pino = require("pino");

const app = express();

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info"
});

console.log("🚀 Iniciando Juhoon Bot...");

let sock;
let qrCode = null;

// 🌐 Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "✅ Bot Juhoon ativo!", 
    timestamp: new Date().toISOString(),
    connected: sock?.user ? "✅ Conectado" : "❌ Desconectado"
  });
});

// 📱 QR Code endpoint
app.get("/qr", (req, res) => {
  if (!qrCode) {
    return res.json({ status: "Aguardando QR code..." });
  }
  res.type("html").send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Juhoon Bot - QR Code</title>
      <style>
        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; font-family: Arial; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); text-align: center; }
        h1 { color: #25d366; margin: 0 0 20px 0; }
        img { width: 300px; height: 300px; }
        p { color: #666; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📲 Escaneie com WhatsApp</h1>
        <img src="data:image/png;base64,${qrCode}" alt="QR Code">
        <p>Aponte a câmera do seu celular com WhatsApp aberto</p>
      </div>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
  console.log(`📱 QR Code disponível em: http://localhost:${PORT}/qr`);
});

async function startBot() {
  try {
    console.log("\n⏳ Iniciando conexão WhatsApp...");

    // Criar pasta auth se não existir
    const authPath = path.resolve("./auth");
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
      console.log("📁 Pasta ./auth criada");
    }

    // Obter credenciais
    const { state, saveCreds } = await useMultiFileAuthState("./auth");
    console.log("✅ Estado de autenticação carregado");

    // Obter versão
    let version;
    try {
      const versionData = await fetchLatestBaileysVersion();
      version = versionData.version;
      console.log(`✅ Versão Baileys: ${version.join(".")}`);
    } catch (versionError) {
      console.error("⚠️ Erro ao buscar versão, usando fallback");
      version = [6, 143, 155];
    }

    // Criar socket
    console.log("🔌 Criando conexão...");
    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // ❌ Desativado
      logger: logger,
      browser: Browsers.ubuntu("Chrome"),
      syncFullHistory: false,
      markOnlineOnConnect: true
    });

    // 💾 Salvar credenciais
    sock.ev.on("creds.update", saveCreds);

    // 📡 Eventos de conexão
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR CODE - Gerar imagem
      if (qr) {
        try {
          qrCode = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: "H",
            type: "image/png",
            width: 300,
            margin: 1,
            color: {
              dark: "#000000",
              light: "#FFFFFF"
            }
          });
          console.log("\n📲 QR CODE GERADO!");
          console.log(`🔗 Acesse: http://localhost:${PORT}/qr`);
          console.log("✅ Escaneie o código com seu WhatsApp\n");
        } catch (err) {
          console.error("❌ Erro ao gerar QR code:", err.message);
        }
      }

      if (connection === "connecting") {
        console.log("🔄 Conectando...");
      }

      if (connection === "open") {
        console.log("\n✅ ✅ ✅ CONECTADO COM SUCESSO! ✅ ✅ ✅");
        console.log(`👤 Usuário: ${sock.user.name}`);
        console.log(`📱 Número: ${sock.user.id}\n`);
        qrCode = null; // Limpar QR code
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`\n❌ Desconectado (Código: ${statusCode})`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.log("🚫 Logout detectado. Apague a pasta ./auth para reconectar.\n");
          fs.rmSync("./auth", { recursive: true, force: true });
          setTimeout(() => startBot(), 3000);
        } else {
          console.log("🔄 Reconectando em 3 segundos...\n");
          setTimeout(() => startBot(), 3000);
        }
      }
    });

    // 💬 Mensagens
    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message) return;

      const from = msg.key.remoteJid;
      const isGroup = msg.key.remoteJid.endsWith("@g.us");

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!body) return;

      console.log(`📨 [${isGroup ? "GRUPO" : "PRIVADO"}] ${from}: "${body}"`);

      // Comandos
      if (body === "&menu") {
        await sock.sendMessage(from, {
          text: "📜 **Menu do Juhoon Bot**\n\n&ping - Testa a conexão\n&menu - Mostra este menu"
        });
      }

      if (body === "&ping") {
        await sock.sendMessage(from, {
          text: "🏓 Pong! Bot funcionando perfeitamente!"
        });
      }
    });

    console.log("🤖 Bot pronto! Aguardando QR code...\n");

  } catch (error) {
    console.error("❌ Erro ao iniciar bot:", error.message);
    console.log("🔄 Tentando novamente em 5 segundos...\n");
    setTimeout(() => startBot(), 5000);
  }
}

// Iniciar bot
startBot();

// Tratamento de erros
process.on("uncaughtException", (error) => {
  console.error("❌ Erro não capturado:", error.message);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Promise rejeitada:", error.message);
});
