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

    if (!state.creds.registered) {
      try {
        const numero = '554797918312' // coloque o número completo com DDI e DDD

        const code = await sock.requestPairingCode(numero)

        console.log('\n🔑 CÓDIGO DE PAREAMENTO:\n')
        console.log(code)
      } catch (err) {
        console.log('Erro ao gerar código:', err.message)
      }
    }
  })
}

start()
