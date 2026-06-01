const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')

const app = express()
const port = process.env.PORT || 10000

// 🌐 servidor web (Render precisa disso)
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
        console.log('✅ CONECTADO AO WHATSAPP')
        retryCount = 0
        isRestarting = false
      }

      if (connection === 'close') {

        if (isRestarting) return
        isRestarting = true

        const statusCode = lastDisconnect?.error?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut

        console.log('⚠️ conexão caiu')

        // 🚨 logout real (precisa novo QR)
        if (loggedOut) {
          console.log('❌ sessão expirada — precisa novo QR')
          return
        }

        retryCount++

        // 🛑 trava anti-loop infinito
        if (retryCount > MAX_RETRIES) {
          console.log('🛑 muitas tentativas. bot pausado.')
          return
        }

        // 🌿 reconexão progressiva (leve e segura)
        const delay = Math.min(60000, 5000 * retryCount)

        console.log(`🔄 reconectando em ${delay / 1000}s`)

        setTimeout(() => {
          startBot()
        }, delay)
      }
    })

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
