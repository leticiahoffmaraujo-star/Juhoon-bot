const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();

// Mantém o Render vivo
app.get("/", (req, res) => {
  res.send("🤖 Bot Juhoon ativo!");
});

app.listen(3000, () => {
  console.log("🌐 Servidor rodando na porta 3000");
});

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Juhoon Bot", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // Conexão e QR
  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log("📲 QR CODE:");
      console.log(qr);
    }

    if (connection === "open") {
      console.log("✅ WhatsApp conectado!");
    }

    if (connection === "close") {
      console.log("❌ Conexão fechada, tentando reconectar...");
      start();
    }
  });

  // Mensagens
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

start();
