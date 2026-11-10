import { currentUser, handle, json } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handle(async () => {
    const { user } = currentUser(request)
    return json({ user })
  })
}