const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();

// Keep alive pro Render
app.get("/", (req, res) => {
  res.send("🤖 Bot Juhoon ativo!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Servidor rodando");
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    browser: ["Juhoon Bot", "Chrome", "1.0.0"],
    printQRInTerminal: false
  });

  // salva sessão
  sock.ev.on("creds.update", saveCreds);

  // conexão + QR (IMPORTANTE)
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log("\n📲 ESCANEIE ESSE QR NO WHATSAPP:\n");
      console.log(qr);
    }

    if (connection === "open") {
      console.log("✅ WhatsApp conectado com sucesso!");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log("❌ Conexão fechada. Reconnect:", shouldReconnect);

      if (shouldReconnect) {
        startBot();
      }
    }
  });

  // comandos
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
