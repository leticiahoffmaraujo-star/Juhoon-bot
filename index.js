const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')

async function startBot() {

  // 📦 sessão salva em pasta (NUNCA apague isso)
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  // 🤖 cria conexão com WhatsApp
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: 'silent' }) // deixa o terminal mais limpo
  })

  // 💾 salva login automaticamente (ESSENCIAL)
  sock.ev.on('creds.update', saveCreds)

  // 🔌 monitor de conexão
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      console.log('⚠️ Conexão caiu. Reconectando...', shouldReconnect)

      if (shouldReconnect) {
        startBot()
      }
    }

    if (connection === 'open') {
      console.log('✅ Bot conectado com sucesso!')
    }
  })

  // 💬 mensagens recebidas (base pra comandos depois)
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0]

    if (!msg.message) return

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    console.log('📩 Mensagem recebida:', texto)

    // exemplo simples de comando
    if (texto === '!ping') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'pong 🏓' })
    }
  })
}

startBot()
