const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();

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
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ["Juhoon", "Chrome", "1.0.0"]
  });

  // 💾 salvar credenciais
  sock.ev.on("creds.update", saveCreds);

  // 📡 conexão
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📲 ESCANEIE O QR / LINK:");
      console.log(qr);
    }

    if (connection === "open") {
      console.log("✅ CONECTADO NO WHATSAPP!");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Conexão caiu. Reiniciando...");

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        setTimeout(() => {
          startBot();
        }, 5000); // 🔥 evita loop agressivo
      } else {
        console.log("🚫 Logout detectado. Precisa reconectar manualmente.");
      }
    }
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
}

startBot();
