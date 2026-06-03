const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const pino = require('pino')
const sharp = require('sharp')

const app = express()
const PORT = process.env.PORT || 10000

let qrCodeData = null
let soAdm = false

app.get('/', (req, res) => res.send('Juhoon Bot Online 🤖 <br><a href="/qr">Ver QR Code</a>'))

app.get('/qr', async (req, res) => {
  if (!qrCodeData) return res.send('Nenhum QR disponível no momento.')
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
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 5000,
    connectTimeoutMs: 60000,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrCodeData = qr
      console.log('📱 QR Code gerado! Acesse /qr')
    }

    if (connection === 'open') {
      console.log('✅ JUHOON BOT CONECTADO COM SUCESSO!')
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log(`❌ Desconectado (Código: ${reason})`)

      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔄 Reconectando em 5 segundos...')
        setTimeout(start, 5000)
      } else {
        console.log('❌ Sessão expirada. Escaneie o QR novamente.')
      }
    }
  })

  // ==================== COMANDOS ====================
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0]
      if (!m.message || m.key.fromMe) return

      const from = m.key.remoteJid
      const isGroup = from.endsWith('@g.us')
      const sender = m.key.participant || from

      let text = m.message.conversation || 
                m.message.extendedTextMessage?.text ||
                m.message.imageMessage?.caption || ''

      if (!text) return

      const comando = text.toLowerCase().trim().split(' ')[0]

      // Modo Só Adm
      if (soAdm && isGroup) {
        const groupMetadata = await sock.groupMetadata(from)
        const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin)
        if (!isAdmin) return
      }

      // !sticker
      if (comando === '!sticker' || comando === '!s') {
        if (!m.message.imageMessage && !m.message.videoMessage && !m.message.stickerMessage) {
          return sock.sendMessage(from, { text: '❌ Responda uma imagem, vídeo ou sticker com !sticker' })
        }
        const buffer = await sock.downloadMediaMessage(m)
        const sticker = await sharp(buffer)
          .resize(512, 512, { fit: 'contain' })
          .toFormat('webp')
          .toBuffer()
        await sock.sendMessage(from, { sticker })
      }

      // !promover
      else if (comando === '!promover') {
        const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || text.split(' ')[1]
        if (!target) return sock.sendMessage(from, { text: '❌ Marque o usuário (@)' })
        await sock.groupParticipantsUpdate(from, [target.replace('@', '') + '@s.whatsapp.net'], "promote")
        sock.sendMessage(from, { text: '✅ Promovido a administrador!' })
      }

      // !rebaixar
      else if (comando === '!rebaixar') {
        const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || text.split(' ')[1]
        if (!target) return sock.sendMessage(from, { text: '❌ Marque o usuário' })
        await sock.groupParticipantsUpdate(from, [target.replace('@', '') + '@s.whatsapp.net'], "demote")
        sock.sendMessage(from, { text: '✅ Rebaixado!' })
      }

      // !remover
      else if (comando === '!remover') {
        const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || text.split(' ')[1]
        if (!target) return sock.sendMessage(from, { text: '❌ Marque o usuário' })
        await sock.groupParticipantsUpdate(from, [target.replace('@', '') + '@s.whatsapp.net'], "remove")
        sock.sendMessage(from, { text: '✅ Usuário removido!' })
      }

      // !marcar / !totag
      else if (comando === '!marcar' || comando === '!totag') {
        const groupMeta = await sock.groupMetadata(from)
        const teks = text.split(' ').slice(1).join(' ') || '📢 Chamando todos!'
        const mentions = groupMeta.participants.map(p => p.id)
        await sock.sendMessage(from, { text: teks, mentions })
      }

      // !fechargp
      else if (comando === '!fechargp') {
        await sock.groupSettingUpdate(from, 'announcement')
        sock.sendMessage(from, { text: '🔒 Grupo fechado!' })
      }

      // !abrirgp
      else if (comando === '!abrirgp') {
        await sock.groupSettingUpdate(from, 'not_announcement')
        sock.sendMessage(from, { text: '🔓 Grupo aberto!' })
      }

      // !soadm
      else if (comando === '!soadm') {
        soAdm = !soAdm
        sock.sendMessage(from, { text: `🔐 Modo Só Adm: ${soAdm ? '✅ ATIVADO' : '❌ DESATIVADO'}` })
      }

      // !menu
      else if (comando === '!menu') {
        const menu = `🤖 *JUHOON BOT MENU*\n\n` +
                     `📌 *Gerais:*\n` +
                     `• !sticker ou !s\n` +
                     `• !ping\n\n` +
                     `👑 *Admin:*\n` +
                     `• !promover @user\n` +
                     `• !rebaixar @user\n` +
                     `• !remover @user\n` +
                     `• !marcar ou !totag\n` +
                     `• !fechargp\n` +
                     `• !abrirgp\n` +
                     `• !soadm`
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
