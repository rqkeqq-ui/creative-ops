const base = process.argv[2] ?? 'http://127.0.0.1:3200'

async function login(email) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  })
  const cookie = response.headers.get('set-cookie')?.split(';')[0]
  return { status: response.status, cookie }
}

async function call(path, { method = 'GET', body, cookie, raw } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  const text = await response.text()
  let json
  try { json = JSON.parse(text) } catch { json = text.slice(0, 120) }
  return { status: response.status, json }
}

const manager = await login('lead@creativeops.demo')
const buyer = await login('buyer@creativeops.demo')
const creative = await login('creative@creativeops.demo')

const results = {}
results.invalidStatus = await call('/api/tasks?status=bogus', { cookie: buyer.cookie })
results.longQuery = await call(`/api/tasks?q=${'x'.repeat(140)}`, { cookie: buyer.cookie })
results.invalidPriority = await call('/api/tasks?priority=urgentt', { cookie: buyer.cookie })
results.noAuthTasks = await call('/api/tasks')
results.badAction = await call('/api/tasks/00000000-0000-0000-0000-000000000000/actions', {
  method: 'POST', cookie: buyer.cookie, body: { action: 'delete' },
})
results.missingTask = await call('/api/tasks/00000000-0000-0000-0000-000000000000', { cookie: buyer.cookie })
results.emptyLogin = await call('/api/auth/login', { method: 'POST', body: {} })
results.badJson = await call('/api/auth/login', { method: 'POST', raw: '{oops', cookie: buyer.cookie })
results.managerCreate = await call('/api/tasks', {
  method: 'POST', cookie: manager.cookie,
  body: { offer: 'X', geo: 'DE', creativeType: 'static', quantity: 1, description: 'short', references: [], priority: 'normal', deadline: new Date(Date.now() + 86400000).toISOString() },
})

for (const [name, result] of Object.entries(results)) {
  console.log(name.padEnd(16), result.status, JSON.stringify(result.json).slice(0, 190))
}