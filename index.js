const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')

const app = express()
const port = process.env.PORT || 10000

app.get('/', (req, res) => {
  res.send('Bot online 🤖')
})

app.listen(port, () => {
  console.log(`🌐 servidor rodando na porta ${port}`)
})

// 🧠 controle de estabilidade
let retryCount = 0
const MAX_RETRIES = 8
let isRestarting = false

async function startBot() {
  try {

    const { state, saveCreds } = await useMultiFileAuthState('./auth')

    const sock = makeWASocket({
      auth: state,
      logger: P({ level: 'silent' })
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update

      if (connection === 'open') {
        console.log('✅ CONECTADO')
        retryCount = 0
        isRestarting = false
      }

      if (connection === 'close') {

        if (isRestarting) return
        isRestarting = true

        const statusCode = lastDisconnect?.error?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut

        console.log('⚠️ conexão caiu')

        // se foi logout real, para tudo
        if (loggedOut) {
          console.log('❌ sessão perdida — precisa novo QR')
          return
        }

        retryCount++

        if (retryCount > MAX_RETRIES) {
          console.log('🛑 muitas tentativas. bot pausado para evitar loop.')
          return
        }

        // 🌿 delay progressivo (mais humano)
        const delay = Math.min(60000, 4000 * retryCount)

        retryCount++

const delay = Math.min(120000, 10000 * retryCount)

console.log(`⏳ aguardando ${delay / 1000}s antes de tentar de novo...`)

setTimeout(() => {
  startBot()
}, delay)

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0]
      if (!msg.message) return

      const texto =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text

      if (texto === '&ping') {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'pong 🏓'
        })
      }
    })

  } catch (err) {
    console.log('💥 erro fatal:', err)

    setTimeout(() => {
      startBot()
    }, 10000)
  }
}

startBot()
