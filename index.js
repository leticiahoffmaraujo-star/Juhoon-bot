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

const app = express()
const PORT = process.env.PORT || 10000

// 👑 DONO DO BOT
const DONO = '554797918312@s.whatsapp.net'

// QR
let qrCodeData = null

// CONFIG
let config = require('./config.json')

function salvarConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
}

// WEB
app.get('/', (req, res) =>
  res.send('Juhoon Bot Online 🤖 <br><a href="/qr">Ver QR Code</a>')
)

app.get('/qr', async (req, res) => {
  if (!qrCodeData) return res.send('Nenhum QR disponível.')
  const buffer = await QRCode.toBuffer(qrCodeData, { width: 400 })
  res.setHeader('Content-Type', 'image/png')
  res.send(buffer)
})

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`))

// BOT
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessao')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', 'Bot']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) qrCodeData = qr

    if (connection === 'open') {
      console.log('✅ BOT CONECTADO!')
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(start, 5000)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0]
      if (!m.message || m.key.fromMe) return

      const from = m.key.remoteJid
      const isGroup = from.endsWith('@g.us')
      const sender = m.key.participant || from

      let text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        m.message.imageMessage?.caption ||
        m.message.videoMessage?.caption ||
        ''

      if (!text) return

      const comando = text.toLowerCase().trim().split(' ')[0]

      const isDono = sender === DONO

      // 🔐 bloqueio modo só admin
      if (config.soAdm && isGroup) {
        const groupMetadata = await sock.groupMetadata(from)

        const isAdmin = groupMetadata.participants.find(
          p => p.id === sender
        )?.admin

        if (!isAdmin && !isDono) return
      }

      // 👑 MENU DONO
      if (comando === '!menudono') {
        if (!isDono)
          return sock.sendMessage(from, {
            text: '❌ Apenas o dono pode usar isso.'
          })

        return sock.sendMessage(from, {
          text:
`👑 MENU DO DONO

• !soadm → liga/desliga modo admin
• !menudono → este menu

💼 controle total do bot`
        })
      }

      // 🔐 SO ADM
      if (comando === '!soadm') {
        if (!isDono)
          return sock.sendMessage(from, {
            text: '❌ Apenas o dono pode usar esse comando.'
          })

        config.soAdm = !config.soAdm
        salvarConfig()

        return sock.sendMessage(from, {
          text: `🔐 Modo só admin: ${config.soAdm ? 'ON' : 'OFF'}`
        })
      }

      // 📌 STICKER
      if (comando === '!sticker' || comando === '!s') {
        const msg =
          m.message.imageMessage ||
          m.message.videoMessage ||
          m.message.stickerMessage

        if (!msg)
          return sock.sendMessage(from, {
            text: '❌ envie imagem ou vídeo'
          })

        const buffer = await sock.downloadMediaMessage(m)

        const sticker = await sharp(buffer)
          .resize(512, 512, { fit: 'contain' })
          .webp()
          .toBuffer()

        return sock.sendMessage(from, { sticker })
      }

      // 👑 PROMOVER
      if (comando === '!promover') {
        const target =
          m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
          text.split(' ')[1]

        if (!target)
          return sock.sendMessage(from, { text: '❌ marque alguém' })

        await sock.groupParticipantsUpdate(from, [target], 'promote')

        return sock.sendMessage(from, {
          text: '✅ promovido'
        })
      }

      // 👇 REBAIXAR
      if (comando === '!rebaixar') {
        const target =
          m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
          text.split(' ')[1]

        if (!target)
          return sock.sendMessage(from, { text: '❌ marque alguém' })

        await sock.groupParticipantsUpdate(from, [target], 'demote')

        return sock.sendMessage(from, {
          text: '✅ rebaixado'
        })
      }

      // ❌ REMOVER
      if (comando === '!remover') {
        const target =
          m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
          text.split(' ')[1]

        if (!target)
          return sock.sendMessage(from, { text: '❌ marque alguém' })

        await sock.groupParticipantsUpdate(from, [target], 'remove')

        return sock.sendMessage(from, {
          text: '❌ removido'
        })
      }

      // 📢 MARCAR TODOS
      if (comando === '!marcar' || comando === '!totag') {
        const group = await sock.groupMetadata(from)

        const mentions = group.participants.map(p => p.id)

        return sock.sendMessage(from, {
          text: text.replace(comando, '').trim() || '📢 ֮ϐׁᨵׁׅׅꭈׁׅɑׁׅ ɑׁׅ℘ɑׁׅꭈׁׅꫀׁׅܻ݊ᝯׁ֒ꫀׁׅܻ݊ꭈׁׅ?',
          mentions
        })
      }

      // 🔒 FECHAR
      if (comando === '!fechargp') {
        await sock.groupSettingUpdate(from, 'announcement')

        return sock.sendMessage(from, {
          text: '🔒 grupo fechado'
        })
      }

      // 🔓 ABRIR
      if (comando === '!abrirgp') {
        await sock.groupSettingUpdate(from, 'not_announcement')

        return sock.sendMessage(from, {
          text: '🔓 grupo aberto'
        })
      }

      // 📌 MENU
      if (comando === '!menu') {
        return sock.sendMessage(from, {
          text:
`🤖 𝐌𝐄𝐍𝐔

• !sticker
• !marcar
• !promover
• !rebaixar
• !remover
• !fechargp
• !abrirgp
• !soadm`
        })
      }

      // 🏓 PING
      if (comando === '!ping') {
        return sock.sendMessage(from, {
          text: '🏓 ℘ᨵׁׅׅ݊ꪀᧁׁ! hׁׅ֮ᨵׁׅׅᨵׁׅׅ݊ꪀ ᨵׁׅׅ݊ꪀ!'        })
      }
    } catch (e) {
      console.log('erro:', e)
    }
  })
}

start()
