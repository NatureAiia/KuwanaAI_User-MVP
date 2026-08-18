import { PrismaClient } from '@prisma/client'
import { createPrismaAdapter } from './prismaAdapter'

declare global {
  var prisma: PrismaClient | undefined
}

// Prisma service-role is the trust boundary - no RLS
// users.id is the authoritative identity (Auth.js JWT sub claim), not a mirror of an external provider
export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter: createPrismaAdapter(),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') global.prisma = prisma
