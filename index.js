const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getContentType } = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const pino = require('pino')
const sharp = require('sharp')

const app = express()
const PORT = process.env.PORT || 10000

let qrCodeData = null
let soAdm = false // Modo só administrador

app.get('/', (req, res) => res.send('Juhoon Bot Online 🤖 <br><a href="/qr">Ver QR Code</a>'))
app.get('/qr', async (req, res) => {
  if (!qrCodeData) return res.send('Nenhum QR disponível.')
  const buffer = await QRCode.toBuffer(qrCodeData, { width: 400 })
  res.setHeader('Content-Type', 'image/png')
  res.send(buffer)
})

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`))

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
    if (qr) qrCodeData = qr
    if (connection === 'open') console.log('✅ JUHOON BOT CONECTADO!')
    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        setTimeout(start, 5000)
      }
    }
  })

  // ==================== HANDLER DE MENSAGENS ====================
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0]
      if (!m.message || m.key.fromMe) return

      const from = m.key.remoteJid
      const isGroup = from.endsWith('@g.us')
      const sender = m.key.participant || from

      let text = m.message.conversation || 
                m.message.extendedTextMessage?.text ||
                m.message.imageMessage?.caption ||
                m.message.videoMessage?.caption || ''

      if (!text) return
      const comando = text.toLowerCase().trim().split(' ')[0]

      // Verifica se é só admin
      if (soAdm && isGroup) {
        const groupMetadata = await sock.groupMetadata(from)
        const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin
        if (!isAdmin) return
      }

      // ====================== COMANDOS ======================

      if (comando === '!sticker' || comando === '!s') {
        const msg = m.message.imageMessage || m.message.videoMessage || m.message.stickerMessage
        if (!msg) return sock.sendMessage(from, { text: '❌ Envie uma imagem/vídeo com o comando !sticker' })

        const buffer = await sock.downloadMediaMessage(m)
        const sticker = await sharp(buffer)
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toFormat('webp')
          .toBuffer()

        await sock.sendMessage(from, { sticker })
      }

      else if (comando === '!promover') {
        const groupMeta = await sock.groupMetadata(from)
        const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || text.split(' ')[1]
        if (!target) return sock.sendMessage(from, { text: '❌ Marque o usuário (@)' })
        await sock.groupParticipantsUpdate(from, [target], "promote")
        sock.sendMessage(from, { text: '✅ Usuário promovido a administrador!' })
      }

      else if (comando === '!rebaixar') {
        const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || text.split(' ')[1]
        if (!target) return sock.sendMessage(from, { text: '❌ Marque o usuário' })
        await sock.groupParticipantsUpdate(from, [target], "demote")
        sock.sendMessage(from, { text: '✅ Usuário rebaixado!' })
      }

      else if (comando === '!remover') {
        const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || text.split(' ')[1]
        if (!target) return sock.sendMessage(from, { text: '❌ Marque o usuário' })
        await sock.groupParticipantsUpdate(from, [target], "remove")
        sock.sendMessage(from, { text: '✅ Usuário removido do grupo!' })
      }

      else if (comando === '!marcar' || comando === '!totag') {
        const groupMeta = await sock.groupMetadata(from)
        let teks = text.split(' ').slice(1).join(' ') || '📢 Chamando todos!'
        let mentions = groupMeta.participants.map(p => p.id)
        await sock.sendMessage(from, { text: teks, mentions })
      }

      else if (comando === '!fechargp') {
        await sock.groupSettingUpdate(from, 'announcement')
        sock.sendMessage(from, { text: '🔒 Grupo fechado (só admins podem falar)' })
      }

      else if (comando === '!abrirgp') {
        await sock.groupSettingUpdate(from, 'not_announcement')
        sock.sendMessage(from, { text: '🔓 Grupo aberto (todos podem falar)' })
      }

      else if (comando === '!soadm') {
        soAdm = !soAdm
        sock.sendMessage(from, { text: `🔐 Modo só administrador: ${soAdm ? '✅ Ativado' : '❌ Desativado'}` })
      }

      else if (comando === '!menu') {
        const menu = `🤖 *JUHOON BOT MENU*\n\n` +
                     `📌 *Comandos Gerais:*\n` +
                     `• !sticker ou !s\n` +
                     `• !menu\n` +
                     `• !ping\n\n` +
                     `👑 *Admin:*\n` +
                     `• !promover @user\n` +
                     `• !rebaixar @user\n` +
                     `• !remover @user\n` +
                     `• !marcar ou !totag\n` +
                     `• !fechargp\n` +
                     `• !abrirgp\n` +
                     `• !soadm\n`
        await sock.sendMessage(from, { text: menu })
      }

      else if (comando === '!ping') {
        await sock.sendMessage(from, { text: '🏓 Pong! Bot online!' })
      }

    } catch (err) {
      console.error('Erro:', err)
    }
  })
}

start()
