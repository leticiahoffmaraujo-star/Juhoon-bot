const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino') // opcional, mas recomendado

const app = express()
const PORT = process.env.PORT || 10000

app.get('/', (req, res) => {
  res.send('Juhoon online 🤖')
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessao')

  // Pega a versão mais recente (muito importante para evitar ban ou problemas)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,        // ← Isso gera o QR no terminal
    logger: pino({ level: 'silent' }), // silencia logs chatos
    browser: ['Ubuntu', 'Chrome', ''],
    markOnlineOnConnect: true,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    console.log('STATUS:', connection)

    if (qr) {
      console.log('📱 QR Code gerado! Escaneie com o WhatsApp:')
      // O Baileys já imprime o QR bonitinho por causa do printQRInTerminal: true
    }

    if (connection === 'open') {
      console.log('✅ CONECTADO AO WHATSAPP COM SUCESSO!')
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      
      console.log('❌ Conexão fechada. Reconectando...', shouldReconnect ? 'Sim' : 'Não (foi deslogado)')

      if (shouldReconnect) {
        start() // reconecta automaticamente
      }
    }
  })

  // Exemplo de listener de mensagens (recomendado adicionar)
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.key.fromMe && m.message?.conversation) {
      console.log('Mensagem recebida:', m.message.conversation)
      // Responder exemplo:
      // await sock.sendMessage(m.key.remoteJid, { text: 'Olá! Eu sou o bot 🤖' })
    }
  })
}

start()
