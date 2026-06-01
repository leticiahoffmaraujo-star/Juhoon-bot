const express = require('express')
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')

const app = express()
const PORT = process.env.PORT || 10000

app.get('/', (req, res) => {
  res.send('Juhoon online 🤖')
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('sessao')

  const sock = makeWASocket({
    auth: state
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection } = update

    console.log('STATUS:', connection)

    if (connection === 'open') {
      console.log('✅ CONECTADO!')
    }


start()
