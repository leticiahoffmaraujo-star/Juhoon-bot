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
  res.send("🤖 Bot Juhoon ativo!");
});

app.listen(process.env.PORT || 10000, () => {
  console.log("🌐 Servidor rodando");
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true
  });

  // 💾 salvar login
  sock.ev.on("creds.update", saveCreds);

  // 📡 conexão + QR
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📲 ESCANEIE O QR:");
      console.log(qr);
    }

    if (connection === "open") {
      console.log("✅ CONECTADO NO WHATSAPP!");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Conexão caiu. Reiniciando...");

      // 🔁 reconexão automática
      if (statusCode !== DisconnectReason.loggedOut) {
        startBot();
      }
    }
  });

  // 💬 comandos
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;

    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text || "";

    if (body === "&menu") {
      await sock.sendMessage(from, {
        text: "📜 Menu do Juhoon Bot funcionando!"
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
