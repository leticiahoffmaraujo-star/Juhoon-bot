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

// 👑 DONO
const DONOS = ['554797918312@s.whatsapp.net']

function isDono(sender) {
  return DONOS.includes(sender)
}

// CONFIG
let config = {}
try {
  config = require('./config.json')
} catch {
  config = {
    soAdm: false,
    bv: '👋 Bem-vindo @user!',
    msgFechar: '🔒 grupo fechado',
    msgAbrir: '🔓 grupo aberto',
    prefix: '!'
  }
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
}

function salvarConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
}

// QR
let qrCodeData = null

// WEB
app.get('/', (req, res) =>
  res.send('🤖 Bot Online <br><a href="/qr">QR Code</a>')
)

app.get('/qr', async (req, res) => {
  if (!qrCodeData) return res.send('Nenhum QR disponível.')
  const buffer = await QRCode.toBuffer(qrCodeData, { width: 400 })
  res.setHeader('Content-Type', 'image/png')
  res.send(buffer)
})

app.listen(PORT, () => console.log(`🚀 Rodando na porta ${PORT}`))

// BOT START
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

  // CONEXÃO
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) qrCodeData = qr

    if (connection === 'open') {
      console.log('✅ BOT ONLINE')
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode

      console.log('⚠️ caiu:', code)

      if (code !== DisconnectReason.loggedOut) {
        setTimeout(() => start(), 5000)
      }
    }
  })

  // ENTRADA GRUPO (BOAS VINDAS)
  sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update

    if (action === 'add') {
      for (let user of participants) {
        await sock.sendMessage(id, {
          text: config.bv.replace('@user', `@${user.split('@')[0]}`),
          mentions: [user]
        })
      }
    }
  })

  // MENSAGENS
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0]
      if (!m.message || m.key.fromMe) return

      const from = m.key.remoteJid
      const isGroup = from.endsWith('@g.us')
      const sender = m.key.participant || from

      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        m.message.imageMessage?.caption ||
        m.message.videoMessage?.caption ||
        ''

      if (!text) return

      const prefix = config.prefix
      if (!text.startsWith(prefix)) return

      const comando = text.slice(prefix.length).split(' ')[0].toLowerCase()

      const isDonoUser = isDono(sender)

      // 🔐 SO ADM BLOQUEIO
      if (config.soAdm && isGroup && !isDonoUser) {
        const meta = await sock.groupMetadata(from)
        const isAdmin = meta.participants.find(p => p.id === sender)?.admin
        if (!isAdmin) return
      }

      // 👑 MENU DONO
      if (comando === 'menudono') {
        if (!isDonoUser)
          return sock.sendMessage(from, { text: '❌ só dono' })

        return sock.sendMessage(from, {
          text: `👑 MENU DONO

• setbv
• setmsgfechar
• setmsgabrir
• soadm`
        })
      }

      // 🔐 SO ADM
      if (comando === 'soadm') {
        if (!isDonoUser)
          return sock.sendMessage(from, { text: '❌ só dono' })

        config.soAdm = !config.soAdm
        salvarConfig()

        return sock.sendMessage(from, {
          text: `🔐 modo admin: ${config.soAdm ? 'ON' : 'OFF'}`
        })
      }

      // 💬 SET BOAS VINDAS
      if (comando === 'setbv') {
        if (!isDonoUser) return

        config.bv = text.split(' ').slice(1).join(' ')
        salvarConfig()

        return sock.sendMessage(from, {
          text: '✅ boas-vindas atualizada'
        })
      }

      // 🔒 MSG FECHAR
      if (comando === 'setmsgfechar') {
        if (!isDonoUser) return

        config.msgFechar = text.split(' ').slice(1).join(' ')
        salvarConfig()

        return sock.sendMessage(from, {
          text: '🔒 msg de fechar salva'
        })
      }

      // 🔓 MSG ABRIR
      if (comando === 'setmsgabrir') {
        if (!isDonoUser) return

        config.msgAbrir = text.split(' ').slice(1).join(' ')
        salvarConfig()

        return sock.sendMessage(from, {
          text: '🔓 msg de abrir salva'
        })
      }

      // 📌 STICKER
      if (comando === 'sticker' || comando === 's') {
        const msg = m.message.imageMessage || m.message.videoMessage
        if (!msg) return sock.sendMessage(from, { text: '❌ mídia necessária' })

        const buffer = await sock.downloadMediaMessage(m)

        const sticker = await sharp(buffer)
          .resize(512, 512, { fit: 'contain' })
          .webp()
          .toBuffer()

        return sock.sendMessage(from, { sticker })
      }

      // 👑 PROMOVER
      if (comando === 'promover') {
        const target =
          m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
          text.split(' ')[1]

        if (!target) return sock.sendMessage(from, { text: '❌ marca alguém' })

        await sock.groupParticipantsUpdate(from, [target], 'promote')

        return sock.sendMessage(from, { text: '✅ promovido' })
      }

      // 👇 REBAIXAR
      if (comando === 'rebaixar') {
        const target =
          m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
          text.split(' ')[1]

        if (!target) return sock.sendMessage(from, { text: '❌ marca alguém' })

        await sock.groupParticipantsUpdate(from, [target], 'demote')

        return sock.sendMessage(from, { text: '✅ rebaixado' })
      }

      // ❌ REMOVER
      if (comando === 'remover') {
        const target =
          m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
          text.split(' ')[1]

        if (!target) return sock.sendMessage(from, { text: '❌ marca alguém' })

        await sock.groupParticipantsUpdate(from, [target], 'remove')

        return sock.sendMessage(from, { text: '❌ removido' })
      }

      // 📢 MARCAR TODOS
      if (comando === 'marcar' || comando === 'totag') {
        const group = await sock.groupMetadata(from)
        const mentions = group.participants.map(p => p.id)

        return sock.sendMessage(from, {
          text: text.replace(prefix + comando, '').trim() || '📢 geral',
          mentions
        })
      }

      // 🔒 FECHAR
      if (comando === 'fechargp') {
        await sock.groupSettingUpdate(from, 'announcement')

        return sock.sendMessage(from, {
          text: config.msgFechar
        })
      }

      // 🔓 ABRIR
      if (comando === 'abrirgp') {
        await sock.groupSettingUpdate(from, 'not_announcement')

        return sock.sendMessage(from, {
          text: config.msgAbrir
        })
      }

      // 📌 MENU
      if (comando === 'menu') {
        return sock.sendMessage(from, {
          text: `🤖 MENU

• sticker
• marcar
• promover
• rebaixar
• remover
• fechargp
• abrirgp
• soadm`
        })
      }

      // 🏓 PING
      if (comando === 'ping') {
        return sock.sendMessage(from, {
          text: '🏓 pong'
        })
      }

    } catch (e) {
      console.log(e)
    }
  })
}

start()
