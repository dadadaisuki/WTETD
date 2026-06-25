import { createCatalogService } from './catalogService.js'
import { createSupabaseRepository } from '../data/supabaseRepository.js'

const json = (payload, status = 200) => {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  }
}

const getNotFound = (pathname) => {
  return json({
    message: `Unknown API route: ${pathname}`,
  }, 404)
}

const sanitizeMerchantPayload = (payload) => {
  const list = Array.isArray(payload) ? payload : [payload]
  return list.map((merchant) => ({
    ...merchant,
    updated_at: merchant.updated_at || new Date().toISOString(),
  }))
}

const sanitizeDishPayload = (payload) => {
  const list = Array.isArray(payload) ? payload : [payload]
  return list.map((dish) => ({
    ...dish,
    updated_at: dish.updated_at || new Date().toISOString(),
  }))
}

export const createApiRouter = (envSource = {}) => {
  const repository = createSupabaseRepository(envSource)
  const catalogs = createCatalogService(repository)

  const getRouteSegments = (pathname = '') => {
    const cleanPath = String(pathname)
      .replace(/^\/\.netlify\/functions\/api\/?/, '')
      .replace(/^\/api\/?/, '')

    return cleanPath.split('/').filter(Boolean)
  }

  const handleGet = async ({ segments, pathname }) => {
    if (segments.length === 0) {
      return json({
        message: 'Campus dining API is ready.',
        cloudReady: repository.isConfigured,
      })
    }

    if (segments[0] === 'catalogs' && segments[1]) {
      const payload = await catalogs.getCatalog(segments[1])
      return json(payload)
    }

    if (segments[0] === 'merchants' && segments.length === 1) {
      const merchants = await repository.listMerchants({
        fields: ['id', 'name', 'zone', 'source', 'heat', 'scene_tags', 'custom_tags', 'updated_at'],
        orderBy: 'heat.desc',
      })

      return json({
        items: merchants,
      })
    }

    if (segments[0] === 'dishes' && segments.length === 1) {
      const dishes = await repository.listDishes({
        fields: ['id', 'merchant_id', 'name', 'heat', 'tags', 'ingredients', 'updated_at'],
        orderBy: 'heat.desc',
      })

      return json({
        items: dishes,
      })
    }

    return getNotFound(pathname)
  }

  const handlePost = async ({ segments, pathname, body }) => {
    if (!body) {
      return json({ message: 'Request body is required.' }, 400)
    }

    if (segments[0] === 'merchants' && segments.length === 1) {
      const merchants = sanitizeMerchantPayload(body)
      const saved = await repository.saveMerchants(Array.isArray(body) ? merchants : merchants[0])

      return json({
        items: Array.isArray(saved) ? saved : [saved],
      }, 201)
    }

    if (segments[0] === 'dishes' && segments.length === 1) {
      const dishes = sanitizeDishPayload(body)
      const saved = await repository.saveDishes(Array.isArray(body) ? dishes : dishes[0])

      return json({
        items: Array.isArray(saved) ? saved : [saved],
      }, 201)
    }

    return getNotFound(pathname)
  }

  const handlePatch = async ({ segments, pathname, body }) => {
    if (segments[0] === 'merchants' && segments[1]) {
      const saved = await repository.patchMerchant(segments[1], {
        ...body,
        updated_at: body.updated_at || new Date().toISOString(),
      })

      return json({
        item: saved,
      })
    }

    if (segments[0] === 'dishes' && segments[1]) {
      const saved = await repository.patchDish(segments[1], {
        ...body,
        updated_at: body.updated_at || new Date().toISOString(),
      })

      return json({
        item: saved,
      })
    }

    return getNotFound(pathname)
  }

  const handleDelete = async ({ segments, pathname }) => {
    if (segments[0] === 'merchants' && segments[1]) {
      await repository.deleteMerchant(segments[1])
      return json({ ok: true }, 200)
    }

    if (segments[0] === 'dishes' && segments[1]) {
      await repository.deleteDish(segments[1])
      return json({ ok: true }, 200)
    }

    return getNotFound(pathname)
  }

  return {
    async handle({ method, pathname, body }) {
      const segments = getRouteSegments(pathname)

      try {
        switch (method) {
          case 'GET':
            return await handleGet({ segments, pathname })
          case 'POST':
            return await handlePost({ segments, pathname, body })
          case 'PATCH':
            return await handlePatch({ segments, pathname, body })
          case 'DELETE':
            return await handleDelete({ segments, pathname })
          default:
            return json({
              message: `Method ${method} is not allowed for ${pathname}.`,
            }, 405)
        }
      } catch (error) {
        return json({
          message: error instanceof Error ? error.message : 'Unknown server error.',
        }, 500)
      }
    },
  }
}
