const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const pino = require('pino')

const app = express()
const PORT = process.env.PORT || 10000

app.get('/', (req, res) => {
  res.send('Juhoon online 🤖')
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
    printQRInTerminal: false,        // Desativado (deprecated)
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', ''],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('📱 QR Code gerado! Escaneie abaixo:')

      try {
        // Gera QR grande no terminal
        const qrTerminal = await QRCode.toString(qr, { type: 'terminal', small: false })
        console.log(qrTerminal)

        // Também gera versão pequena (caso o terminal corte)
        const qrSmall = await QRCode.toString(qr, { type: 'terminal', small: true })
        console.log('\nVersão pequena:\n' + qrSmall)
      } catch (err) {
        console.log('Erro ao gerar QR:', err.message)
      }
    }

    if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP COM SUCESSO!')
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log(`❌ Conexão fechada. Motivo: ${reason}`)

      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔄 Tentando reconectar...')
        setTimeout(start, 5000)
      }
    }
  })

  // Listener de mensagens (exemplo)
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (m.message?.conversation) {
      console.log(`Mensagem de ${m.key.remoteJid}: ${m.message.conversation}`)
    }
  })
}

start()
