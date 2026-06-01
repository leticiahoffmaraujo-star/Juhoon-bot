const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const pino = require('pino')

const app = express()
const PORT = process.env.PORT || 10000

let qrCodeData = null // Para guardar o QR temporariamente

app.get('/', (req, res) => {
  res.send('Juhoon online 🤖 <br><br><a href="/qr">📱 Ver QR Code</a>')
})

// Rota do QR Code
app.get('/qr', async (req, res) => {
  if (!qrCodeData) {
    return res.send('Nenhum QR Code disponível no momento.<br>Aguarde alguns segundos ou reinicie o serviço.')
  }

  try {
    const qrImage = await QRCode.toBuffer(qrCodeData, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    })

    res.setHeader('Content-Type', 'image/png')
    res.send(qrImage)
  } catch (err) {
    res.status(500).send('Erro ao gerar QR Code')
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

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrCodeData = qr
      console.log('📱 QR Code gerado! Acesse: https://juhoon-bot.onrender.com/qr')
    }

    if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP COM SUCESSO!')
      qrCodeData = null
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log(`❌ Conexão fechada (código: ${reason || 'desconhecido'})`)

      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔄 Reconectando em 5 segundos...')
        setTimeout(start, 5000)
      }
    }
  })

  // Listener de mensagens
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (m.message?.conversation) {
      console.log(`📩 Mensagem de ${m.key.remoteJid}: ${m.message.conversation}`)
    }
  })
}

start()
