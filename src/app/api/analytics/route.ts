import { appCtx, currentUser, handle, json } from '@/lib/api/http'
import { getAnalyticsReport, parseRange } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handle(() => {
    const { user } = currentUser(request)
    const range = parseRange(new URL(request.url).searchParams.get('range'))
    return json({ report: getAnalyticsReport(appCtx(), user, { rangeDays: range }) })
  })
}