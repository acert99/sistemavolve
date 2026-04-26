import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { revokeBlockedSession } from '@/lib/cache'

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request })

  if (
    !token ||
    typeof token.sessionId !== 'string' ||
    typeof token.exp !== 'number'
  ) {
    return NextResponse.json({ success: true, revoked: false })
  }

  const revoked = await revokeBlockedSession(token.sessionId, token.exp)

  return NextResponse.json({ success: true, revoked })
}
