import { createApiRouter } from '../server/api/router.js'

const router = createApiRouter(process.env)

export default async function handler(req, res) {
  const result = await router.handle({
    method: req.method || 'GET',
    pathname: req.url?.split('?')[0] || '/api',
    body: req.body,
  })

  res.status(result.status)
  Object.entries(result.headers || {}).forEach(([k, v]) => res.setHeader(k, v))
  res.end(result.body)
}
