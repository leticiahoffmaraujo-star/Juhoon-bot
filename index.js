const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
browser: ["Juhoon Bot", "Chrome", "1.0.0"]
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;

    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text || "";

    if (body === "&menu") {
      await sock.sendMessage(from, {
        text: "📜 Menu do bot funcionando!"
      });
    }
  });

  console.log("Bot rodando...");
}

start();
