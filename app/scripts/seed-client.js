const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const email = process.env.CLIENT_TEST_EMAIL?.trim().toLowerCase()
  const password = process.env.CLIENT_TEST_PASSWORD?.trim()
  const nome = process.env.CLIENT_TEST_NAME?.trim() || 'Cliente Teste'
  const whatsapp = process.env.CLIENT_TEST_WHATSAPP?.trim() || null

  if (!email) {
    throw new Error('CLIENT_TEST_EMAIL nao definido')
  }

  if (!password) {
    throw new Error('CLIENT_TEST_PASSWORD nao definido')
  }

  const senhaHash = await bcrypt.hash(password, 12)

  const cliente = await prisma.cliente.upsert({
    where: { email },
    create: {
      nome,
      email,
      whatsapp,
      ativo: true,
    },
    update: {
      nome,
      whatsapp,
      ativo: true,
    },
  })

  const usuario = await prisma.usuario.upsert({
    where: { email },
    create: {
      nome,
      email,
      senhaHash,
      perfil: 'cliente',
      clienteId: cliente.id,
      ativo: true,
    },
    update: {
      nome,
      senhaHash,
      perfil: 'cliente',
      clienteId: cliente.id,
      ativo: true,
    },
  })

  console.log(`Cliente preparado com sucesso: ${cliente.email}`)
  console.log(`Usuario cliente preparado com sucesso: ${usuario.email}`)
  console.log(`clienteId vinculado: ${cliente.id}`)
}

main()
  .catch((error) => {
    console.error('[seed-client]', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
