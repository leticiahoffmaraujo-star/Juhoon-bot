const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const pino = require('pino')

const app = express()
const PORT = process.env.PORT || 10000

let qrCodeData = null

app.get('/', (req, res) => {
  res.send('Juhoon online 🤖 <br><br><a href="/qr">📱 Ver QR Code</a>')
})

app.get('/qr', async (req, res) => {
  if (!qrCodeData) {
    return res.send('Nenhum QR Code disponível no momento.')
  }
  try {
    const qrImage = await QRCode.toBuffer(qrCodeData, { width: 400, margin: 2 })
    res.setHeader('Content-Type', 'image/png')
    res.send(qrImage)
  } catch (err) {
    res.status(500).send('Erro ao gerar QR')
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
})

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessao')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', ''],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrCodeData = qr
      console.log('📱 QR Code disponível em: /qr')
    }

    if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP!')
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔄 Reconectando...')
        setTimeout(start, 5000)
      }
    }
  })

  // ==================== COMANDOS DO BOT ====================
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return

    const text = m.message.conversation || m.message.extendedTextMessage?.text || ''
    const from = m.key.remoteJid

    if (!text) return

    const comando = text.toLowerCase().trim()

    if (comando === '!ping') {
      await sock.sendMessage(from, { text: '🏓 Pong!' })
    }

    else if (comando === '!menu') {
      const menu = `🤖 *JUHOON BOT*\n\n` +
                   `Comandos disponíveis:\n` +
                   `• !ping - Testar bot\n` +
                   `• !menu - Ver menu\n\n` +
                   `Bot feito com Baileys`
      await sock.sendMessage(from, { text: menu })
    }

    else if (comando.startsWith('!echo ')) {
      const msg = text.slice(6)
      await sock.sendMessage(from, { text: msg })
    }
  })
}

start()
