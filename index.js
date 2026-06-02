const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')

const QRCode = require('qrcode')
const pino = require('pino')
const sharp = require('sharp')

const app = express()
const PORT = process.env.PORT || 10000

// 👑 DONO
const DONO = '554797918312@s.whatsapp.net'

// 📱 QR
let qrCodeData = null

// 🌐 WEB
app.get('/', (req, res) => {
  res.send('🤖 Bot online <br><a href="/qr">QR Code</a>')
})

app.get('/qr', async (req, res) => {
  if (!qrCodeData) return res.send('QR ainda não gerado.')
  const buffer = await QRCode.toBuffer(qrCodeData, { width: 400 })
  res.setHeader('Content-Type', 'image/png')
  res.send(buffer)
})

app.listen(PORT, () => {
  console.log(`🚀 servidor rodando na porta ${PORT}`)
})

// 🤖 BOT
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessao')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' })
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) qrCodeData = qr

    if (connection === 'open') {
      console.log('✅ BOT CONECTADO')
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode

      if (code !== DisconnectReason.loggedOut) {
        setTimeout(start, 5000)
      }
    }
  })

  // 💬 MENSAGENS
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return

    const from = m.key.remoteJid
    const sender = m.key.participant || from

    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      ''

    const cmd = text.toLowerCase().split(' ')[0]

    const isDono = sender === DONO

    // 👋 ping
    if (cmd === '!ping') {
      return sock.sendMessage(from, { text: '🏓 pong' })
    }

    // 👑 menu dono
    if (cmd === '!menudono') {
      if (!isDono) return

      return sock.sendMessage(from, {
        text: `👑 MENU DONO\n\n• !ping\n• !soadm (futuro)`
      })
    }

    // 📌 sticker básico
    if (cmd === '!sticker' || cmd === '!s') {
      const media =
        m.message.imageMessage ||
        m.message.videoMessage

      if (!media) {
        return sock.sendMessage(from, {
          text: '❌ envie imagem ou vídeo'
        })
      }

      const buffer = await sock.downloadMediaMessage(m)

      const sticker = await sharp(buffer)
        .resize(512, 512, { fit: 'contain' })
        .webp()
        .toBuffer()

      return sock.sendMessage(from, { sticker })
    }
  })
}

start()
