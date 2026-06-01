const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('sessao')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection } = update

    console.log('STATUS:', connection)

    if (connection === 'open') {
      console.log('✅ CONECTADO!')
    }

    // pairing code (só se não estiver registrado)
    if (connection === 'open' && !state.creds.registered) {
      const numero = '554797918312'

      try {
        const code = await sock.requestPairingCode(numero)
        console.log('\n🔑 CÓDIGO:\n', code)
      } catch (e) {
        console.log('Erro pairing:', e.message)
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)
}

start()
