const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'admin@volve.com.br'
const ADMIN_NAME = 'Admin Volve'

async function main() {
  const password = process.env.ADMIN_INITIAL_PASSWORD?.trim()

  if (!password) {
    throw new Error('ADMIN_INITIAL_PASSWORD nao definido')
  }

  const senhaHash = await bcrypt.hash(password, 12)

  const admin = await prisma.usuario.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      nome: ADMIN_NAME,
      email: ADMIN_EMAIL,
      senhaHash,
      perfil: 'equipe',
      ativo: true,
    },
    update: {
      nome: ADMIN_NAME,
      senhaHash,
      perfil: 'equipe',
      ativo: true,
    },
  })

  console.log(`Admin preparado com sucesso: ${admin.email}`)
  console.log('Remova ADMIN_INITIAL_PASSWORD do ambiente apos executar este script.')
}

main()
  .catch((error) => {
    console.error('[seed-admin]', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
