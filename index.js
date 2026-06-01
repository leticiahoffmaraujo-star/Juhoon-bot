const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')

async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('📲 QR atualizado — escaneia de novo se precisar')
    }

    if (connection === 'open') {
      console.log('✅ CONECTADO COM SUCESSO')
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode

      const loggedOut = statusCode === DisconnectReason.loggedOut

      console.log('⚠️ caiu conexão')

      if (loggedOut) {
        console.log('❌ Logout detectado — precisa novo QR')
        return
      }

      // 🔥 delay antes de reconectar (evita loop infinito no Render)
      setTimeout(() => {
        startBot()
      }, 5000)
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0]
    if (!msg.message) return

    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text

    if (texto === '&ping') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'pong 🏓' })
    }
  })
}

startBot()
