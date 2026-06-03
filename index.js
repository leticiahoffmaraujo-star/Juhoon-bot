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
const fs = require('fs')
const config = require('./config.json')

const app = express()
const PORT = process.env.PORT || 10000

const DONO = '5527999945586@s.whatsapp.net'

let qrCodeData = null

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
  const { connection, lastDisconnect } = update

  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode

    console.log('⚠️ caiu:', code)

    // 👇 reconecta SEM resetar sessão
    if (code !== DisconnectReason.loggedOut) {
      setTimeout(() => {
        console.log('🔄 reconectando...')
        start()
      }, 3000)
    }
  }
})

  sock.ev.on('group-participants.update', async (data) => {
  sock.ev.on('connection.update', (update) => {
  console.log(update)

  const { connection, qr } = update

  if (qr) {
    console.log('📱 QR GERADO')
    qrCodeData = qr
  }

  if (connection === 'open') {
    console.log('✅ BOT CONECTADO')
  }
})

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
    const isGroup = from.endsWith('@g.us')

    if (cmd === '!ping') {
      return sock.sendMessage(from, { text: '🏓 pong' })
    }

    if (cmd === '!bvon') {
      if (!isDono) return
      config.boasVindas = true
      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
      return sock.sendMessage(from, { text: 'Boas-vindas ativadas' })
    }

    if (cmd === '!bvoff') {
      if (!isDono) return
      config.boasVindas = false
      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
      return sock.sendMessage(from, { text: 'Boas-vindas desativadas' })
    }

    if (cmd === '!menu') {
      return sock.sendMessage(from, {
        text: `🤖 MENU

• !ping
• !menu`
      })
    }
  })
}

start()

// 💓 mantém o bot "acordado"
setInterval(() => {
  console.log('💓 bot vivo')
}, 60000)
const path = require('path')

function protegerSessao() {
  const pasta = path.join(__dirname, 'sessao')

  if (!fs.existsSync(pasta)) {
    fs.mkdirSync(pasta)
    console.log('📁 Sessão recriada')
  }
}

protegerSessao()
