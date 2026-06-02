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
const fs = require('fs')
const config = require('./config.json')

// 👑 DONO
const DONO = '5527999945586@s.whatsapp.net'

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
  console.log('❌ Desconectado')
  console.log(lastDisconnect)

  const code = lastDisconnect?.error?.output?.statusCode

  if (code !== DisconnectReason.loggedOut) {
    setTimeout(start, 5000)
  }
    }
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
    const isGroup = from.endsWith('@g.us')
    
    // 👋 ping
    if (cmd === '!ping') {
      return sock.sendMessage(from, { text: '🏓 pong' })
    }
    
    //boas vindas
    if (cmd === '!bvon') {
  if (!isDono) return

  config.boasVindas = true
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))

  return sock.sendMessage(from, {
    text: '✅ Boas-vindas ativadas.'
  })
}

if (cmd === '!bvoff') {
  if (!isDono) return

  config.boasVindas = false
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))

  return sock.sendMessage(from, {
    text: '✅ Boas-vindas desativadas.'
  })
    }
    
// 👑 PROMOVER
if (cmd === '!promover') {
  if (!isGroup) return

  const alvo =
    m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

  if (!alvo) {
    return sock.sendMessage(from, {
      text: '❌ Marque alguém.'
    })
  }

  await sock.groupParticipantsUpdate(
    from,
    [alvo],
    'promote'
  )

  return sock.sendMessage(from, {
    text: '✅ Usuário promovido.'
  })
}
    // 👇 REBAIXAR
if (cmd === '!rebaixar') {
  if (!isGroup) return

  const alvo =
    m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

  if (!alvo) {
    return sock.sendMessage(from, {
      text: '❌ Marque alguém.'
    })
  }

  await sock.groupParticipantsUpdate(
    from,
    [alvo],
    'demote'
  )

  return sock.sendMessage(from, {
    text: '✅ Usuário rebaixado.'
  })
}
    // ❌ REMOVER
if (cmd === '!remover') {
  if (!isGroup) return

  const alvo =
    m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

  if (!alvo) {
    return sock.sendMessage(from, {
      text: '❌ Marque alguém.'
    })
  }

  await sock.groupParticipantsUpdate(
    from,
    [alvo],
    'remove'
  )

  return sock.sendMessage(from, {
    text: '✅ Usuário removido.'
  })
}
    // 🔒 FECHAR GRUPO
if (cmd === '!fechargp') {
  if (!isGroup) return

  await sock.groupSettingUpdate(
    from,
    'announcement'
  )

  return sock.sendMessage(from, {
    text: config.mensagemFecharGrupo
  })
}
    // 🔓 ABRIR GRUPO
if (cmd === '!abrirgp') {
  if (!isGroup) return

  await sock.groupSettingUpdate(
    from,
    'not_announcement'
  )

  return sock.sendMessage(from, {
    text: config.mensagemAbrirGrupo
  })
}
    // 📢 MARCAR TODOS
if (cmd === '!marcar' || cmd === '!totag') {

  if (!isGroup) return

  const grupo = await sock.groupMetadata(from)

  const membros = grupo.participants.map(
    p => p.id
  )

  const mensagem =
    text.replace(cmd, '').trim() ||
    '📢 Chamando todos!'

  return sock.sendMessage(from, {
    text: mensagem,
    mentions: membros
  })
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

    // MENU
    if (cmd === '!menu') {
      return sock.sendMessage(from, {
        text: `🤖 MENU JUHOON

📌 Gerais
• !ping
• !sticker
• !menu

👑 Administração
• !promover
• !rebaixar
• !remover
• !marcar
• !totag
• !fechargp
• !abrirgp

⚙️ Dono
• !menudono`
      })
    }

  })
}

start()
