const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')

const app = express()
const port = process.env.PORT || 10000

// 🌐 servidor fica fora do bot
app.get('/', (req, res) => {
  res.send('Bot online 🤖')
})

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`)
})

async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'open') {
      console.log('✅ CONECTADO')
    }

    if (connection === 'close') {

  if (isRestarting) return
  isRestarting = true

  console.log('⚠️ conexão caiu')

  setTimeout(() => {
    isRestarting = false
    startBot()
  }, 8000)
    }

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
