import { createApiRouter } from './router.js'

const readBody = (request) => {
  return new Promise((resolve, reject) => {
    const chunks = []

    request.on('data', (chunk) => {
      chunks.push(chunk)
    })

    request.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined)
        return
      }

      const raw = Buffer.concat(chunks).toString('utf8')

      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(new Error(`Invalid JSON request body: ${error.message}`))
      }
    })

    request.on('error', reject)
  })
}

export const createNodeApiMiddleware = (envSource = {}) => {
  const router = createApiRouter(envSource)

  return async (request, response, next) => {
    const url = new URL(request.url || '/', 'http://localhost')

    if (!url.pathname.startsWith('/api')) {
      next()
      return
    }

    const shouldReadBody = request.method === 'POST' || request.method === 'PATCH'
    const body = shouldReadBody ? await readBody(request) : undefined
    const result = await router.handle({
      method: request.method || 'GET',
      pathname: url.pathname,
      body,
    })

    response.statusCode = result.status

    Object.entries(result.headers || {}).forEach(([key, value]) => {
      response.setHeader(key, value)
    })

    response.end(result.body || '')
  }
}
