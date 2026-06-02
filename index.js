const express = require('express')
const mongoose = require('mongoose')
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

// 👑 DONO DO BOT
const DONO = '554797918312@s.whatsapp.net'

// ================= MONGO =================
mongoose.connect(process.env.MONGO_URL || 'SUA_MONGO_URL')
  .then(() => console.log('🟢 MongoDB conectado'))
  .catch(err => console.log('🔴 erro MongoDB', err))

const ConfigSchema = new mongoose.Schema({
  id: String,
  soAdm: { type: Boolean, default: false }
})

const Config = mongoose.model('Config', ConfigSchema)

async function getConfig() {
  let cfg = await Config.findOne({ id: 'global' })
  if (!cfg) cfg = await Config.create({ id: 'global' })
  return cfg
}

async function saveConfig(cfg) {
  await Config.updateOne({ id: 'global' }, cfg, { upsert: true })
}

// ================= EXPRESS =================
let qrCodeData = null

app.get('/', (req, res) =>
  res.send('🤖 Bot Online <br><a href="/qr">Ver QR</a>')
)

app.get('/qr', async (req, res) => {
  if (!qrCodeData) return res.send('Nenhum QR disponível')
  const buffer = await QRCode.toBuffer(qrCodeData, { width: 400 })
  res.setHeader('Content-Type', 'image/png')
  res.send(buffer)
})

app.listen(PORT, () =>
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
)

// ================= BOT =================
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessao')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' })
  })

  // salva login
  sock.ev.on('creds.update', saveCreds)

  // conexão
  sock.ev.on('connection.update', async (update) => {
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

  // ================= MENSAGENS =================
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0]
      if (!m.message || m.key.fromMe) return

      const from = m.key.remoteJid
      const sender = m.key.participant || from
      const isGroup = from.endsWith('@g.us')

      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        ''

      if (!text) return

      const comando = text.toLowerCase().split(' ')[0]

      const isDono = sender === DONO

      const cfg = await getConfig()

      // 🔐 bloqueio admin global
      if (cfg.soAdm && isGroup) {
        const meta = await sock.groupMetadata(from)
        const isAdmin = meta.participants.find(p => p.id === sender)?.admin
        if (!isAdmin && !isDono) return
      }

      // ================= DONO MENU =================
      if (comando === '!menudono') {
        if (!isDono) return

        return sock.sendMessage(from, {
          text:
`👑 MENU DO DONO

• !soadm → modo admin global
• controle total do bot`
        })
      }

      // ================= SO ADM =================
      if (comando === '!soadm') {
        if (!isDono) return

        cfg.soAdm = !cfg.soAdm
        await saveConfig(cfg)

        return sock.sendMessage(from, {
          text: `🔐 modo admin: ${cfg.soAdm ? 'ON' : 'OFF'}`
        })
      }

      // ================= STICKER =================
      if (comando === '!sticker' || comando === '!s') {
        const msg =
          m.message.imageMessage ||
          m.message.videoMessage

        if (!msg) return sock.sendMessage(from, { text: 'envie mídia' })

        const buffer = await sock.downloadMediaMessage(m)

        const sticker = await sharp(buffer)
          .resize(512, 512, { fit: 'contain' })
          .webp()
          .toBuffer()

        return sock.sendMessage(from, { sticker })
      }

      // ================= GRUPO =================
      if (comando === '!marcar') {
        const meta = await sock.groupMetadata(from)
        const mentions = meta.participants.map(p => p.id)

        return sock.sendMessage(from, {
          text: text.replace(comando, '') || '📢 geral',
          mentions
        })
      }

      if (comando === '!fechargp') {
        await sock.groupSettingUpdate(from, 'announcement')
        return sock.sendMessage(from, { text: '🔒 fechado' })
      }

      if (comando === '!abrirgp') {
        await sock.groupSettingUpdate(from, 'not_announcement')
        return sock.sendMessage(from, { text: '🔓 aberto' })
      }

      if (comando === '!promover') {
        const target =
          m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

        if (!target) return

        await sock.groupParticipantsUpdate(from, [target], 'promote')

        return sock.sendMessage(from, { text: '✅ promovido' })
      }

      if (comando === '!rebaixar') {
        const target =
          m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

        if (!target) return

        await sock.groupParticipantsUpdate(from, [target], 'demote')

        return sock.sendMessage(from, { text: '⬇️ rebaixado' })
      }

      if (comando === '!remover') {
        const target =
          m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

        if (!target) return

        await sock.groupParticipantsUpdate(from, [target], 'remove')

        return sock.sendMessage(from, { text: '❌ removido' })
      }

      if (comando === '!menu') {
        return sock.sendMessage(from, {
          text:
`🤖 MENU

• !sticker
• !marcar
• !promover
• !rebaixar
• !remover
• !fechargp
• !abrirgp`
        })
      }

    } catch (e) {
      console.log('erro:', e)
    }
  })
}

start()
