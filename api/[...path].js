import { createApiRouter } from '../server/api/router.js'

const router = createApiRouter(process.env)

export default async function handler(req, res) {
  try {
    const result = await router.handle({
      method: req.method || 'GET',
      pathname: req.url?.split('?')[0] || '/api',
      body: req.body,
    })

    res.status(result.status)
    Object.entries(result.headers || {}).forEach(([k, v]) => res.setHeader(k, v))
    res.end(result.body)
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Unknown function error.',
    })
  }
}
