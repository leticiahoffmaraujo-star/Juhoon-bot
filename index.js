const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      console.log("📲 ESCANEIE O QR OU LINK GERADO PELO WHATSAPP");
      console.log(qr);
    }

    if (connection === "open") {
      console.log("✅ CONECTADO COM SUCESSO!");
    }

    if (connection === "close") {
      console.log("❌ CONEXÃO FECHOU, REINICIANDO...");
      start();
    }
  });

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
  });

  console.log("🤖 Bot iniciado...");
}

start();
