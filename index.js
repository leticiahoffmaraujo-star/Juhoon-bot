const sock = makeWASocket({
  auth: state,
  printQRInTerminal: false
});

sock.ev.on("connection.update", (update) => {
  const { connection, qr } = update;

  if (qr) {
    console.log("📲 QR CODE:");
    console.log(qr);
  }

  if (connection === "open") {
    console.log("✅ WhatsApp conectado!");
  }
});

sock.ev.on("creds.update", saveCreds);
