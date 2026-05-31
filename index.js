const express = require("express");
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
const logger = pino();

// 🌐 manter Render vivo
app.get("/", (req, res) => {
  res.send("🤖 Juhoon ativo!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🌐 Servidor rodando na porta", PORT);
});

let sock; // evita múltiplas instâncias

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`usando versão do baileys ${version.join(".")}, isLatest: ${isLatest}`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true, // ✅ ATIVAR QR NO TERMINAL
      logger,
      browser: Browsers.ubuntu("Chrome")
    });

    // 💾 salvar credenciais
    sock.ev.on("creds.update", saveCreds);

    // 📡 conexão
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;

      if (qr) {
        console.log("\n📲 ESCANEIE O QR CODE:\n", qr, "\n");
      }

      if (connection === "open") {
        console.log("✅ CONECTADO NO WHATSAPP!");
      }

      if (connection === "connecting") {
        console.log("🔄 Conectando...");
      }

      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

        console.log("❌ Conexão caiu.", shouldReconnect ? "Reiniciando..." : "");

        if (shouldReconnect) {
          setTimeout(() => {
            startBot();
          }, 3000);
        } else {
          console.log("🚫 Logout detectado. Precisa reconectar manualmente.");
        }
      }
    });

    // 🔌 Socket errors
    sock.ev.on("socket.connecting", () => {
      console.log("🔌 Socket conectando...");
    });

    sock.ev.on("socket.open", () => {
      console.log("🔌 Socket aberto");
    });

    sock.ev.on("socket.close", () => {
      console.log("🔌 Socket fechado");
    });

    // 💬 mensagens
    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message) return;

      const from = msg.key.remoteJid;
      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      console.log(`📨 Mensagem recebida: "${body}" de ${from}`);

      if (body === "&menu") {
        await sock.sendMessage(from, {
          text: "📜 Menu do Juhoon funcionando!"
        });
      }

      if (body === "&ping") {
        await sock.sendMessage(from, {
          text: "🏓 Pong!"
        });
      }
    });

    console.log("🤖 Bot iniciado...");
  } catch (error) {
    console.error("❌ Erro ao iniciar bot:", error);
    setTimeout(() => {
      startBot();
    }, 5000);
  }
}

startBot();
