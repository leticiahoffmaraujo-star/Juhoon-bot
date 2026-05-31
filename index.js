const express = require("express");
const fs = require("fs");
const QRCode = require("qrcode");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");

const app = express();

const logger = pino({ level: "info" });

let sock;
let qrCode = null;

// 🌐 STATUS
app.get("/", (req, res) => {
  res.json({
    status: "Juhoon Bot rodando",
    connected: !!sock?.user
  });
});

// 📲 QR CODE PAGE
app.get("/qr", (req, res) => {
  if (!qrCode) return res.send("⏳ Aguardando QR Code...");

  res.send(`
    <html>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;">
        <div style="text-align:center;color:white">
          <h2>📲 Escaneie o QR</h2>
          <img width="300" src="${qrCode}" />
        </div>
      </body>
    </html>
  `);
});

// 🚀 BOT
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: Browsers.ubuntu("Chrome")
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    // 📲 GERAR QR
    if (qr) {
      qrCode = await QRCode.toDataURL(qr);
      console.log("📲 QR gerado");
    }

    // ✅ CONECTADO
    if (connection === "open") {
      console.log("✅ CONECTADO NO WHATSAPP!");
      qrCode = null;
    }

    // ❌ DESCONECTOU
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconectando...");
        setTimeout(startBot, 3000);
      } else {
        console.log("🚫 Logout detectado. Limpando auth...");
        fs.rmSync("./auth", { recursive: true, force: true });
        setTimeout(startBot, 3000);
      }
    }
  });

  // 💬 MENSAGENS
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;

    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    // 📜 MENU
    if (body === "&menu") {
      return sock.sendMessage(from, {
        text: "📜 Menu Juhoon Bot\n\n&ping - testar bot\n&menu - ver menu"
      });
    }

    // 🏓 PING
    if (body === "&ping") {
      return sock.sendMessage(from, {
        text: "🏓 Pong! Bot conectado com sucesso ⚡"
      });
    }
  });

  console.log("🤖 Bot iniciando...");
}

// 🌐 SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🌐 Servidor rodando na porta", PORT);
  console.log(`📲 QR: https://juhoon-bot.onrender.com/qr`);
});

// 🚀 START
startBot();
