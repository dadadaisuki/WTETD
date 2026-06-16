import { seedDishes, seedMerchants } from '../../src/data/seedData.js'

const DEFAULT_SUPABASE_URL = 'https://pjgixbywuffzovsblyku.supabase.co/rest/v1'

const fallbackState = {
  merchants: seedMerchants.map((merchant) => ({ ...merchant })),
  dishes: seedDishes.map((dish) => ({ ...dish })),
}

const cloneValue = (value) => JSON.parse(JSON.stringify(value))

const normalizeBaseUrl = (url) => String(url || DEFAULT_SUPABASE_URL).replace(/\/$/, '')

const parseOrderBy = (orderBy) => {
  const [field = 'updated_at', direction = 'asc'] = String(orderBy || '').split('.')
  return {
    field,
    desc: direction === 'desc',
  }
}

const pickFields = (record, fields) => {
  if (!Array.isArray(fields) || fields.length === 0 || fields.includes('*')) {
    return { ...record }
  }

  return fields.reduce((result, field) => {
    result[field] = record[field]
    return result
  }, {})
}

const applyFallbackFilters = (records, filters = {}) => {
  return records.filter((record) => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return true
      }

      return String(record[key]) === String(value)
    })
  })
}

const applyFallbackOrder = (records, orderBy) => {
  if (!orderBy) {
    return [...records]
  }

  const { field, desc } = parseOrderBy(orderBy)
  const direction = desc ? -1 : 1

  return [...records].sort((left, right) => {
    const leftValue = left[field]
    const rightValue = right[field]

    if (leftValue === rightValue) {
      return 0
    }

    if (leftValue === undefined || leftValue === null) {
      return 1
    }

    if (rightValue === undefined || rightValue === null) {
      return -1
    }

    return leftValue > rightValue ? direction : -direction
  })
}

const buildSelect = (fields) => {
  if (!Array.isArray(fields) || fields.length === 0) {
    return '*'
  }

  return fields.join(',')
}

const buildQueryString = ({ fields, filters = {}, orderBy, limit } = {}) => {
  const params = new URLSearchParams()
  params.set('select', buildSelect(fields))

  if (orderBy) {
    params.set('order', orderBy)
  }

  if (limit) {
    params.set('limit', String(limit))
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    params.set(key, `eq.${value}`)
  })

  return params.toString()
}

const upsertById = (currentList, payloadList) => {
  const currentMap = new Map(currentList.map((item) => [item.id, item]))

  payloadList.forEach((item) => {
    currentMap.set(item.id, {
      ...(currentMap.get(item.id) || {}),
      ...cloneValue(item),
    })
  })

  return [...currentMap.values()]
}

export const resolveSupabaseConfig = (envSource = {}) => {
  const baseUrl = normalizeBaseUrl(envSource.SUPABASE_URL || envSource.VITE_SUPABASE_URL)
  const anonKey = envSource.SUPABASE_ANON_KEY || envSource.VITE_SUPABASE_ANON_KEY || ''

  return {
    baseUrl,
    anonKey,
    isConfigured: Boolean(baseUrl && anonKey),
  }
}

export const createSupabaseRepository = (envSource = {}) => {
  const config = resolveSupabaseConfig(envSource)

  const request = async (path, options = {}) => {
    if (!config.isConfigured) {
      throw new Error('Supabase credentials are missing on the server.')
    }

    const response = await fetch(`${config.baseUrl}${path}`, {
      ...options,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `Supabase request failed with ${response.status}.`)
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  }

  const listFallback = (resourceName, options = {}) => {
    const source = resourceName === 'merchants'
      ? fallbackState.merchants
      : fallbackState.dishes
    const filtered = applyFallbackFilters(source, options.filters)
    const ordered = applyFallbackOrder(filtered, options.orderBy)
    const limited = options.limit ? ordered.slice(0, options.limit) : ordered

    return limited.map((record) => pickFields(record, options.fields))
  }

  const saveFallback = (resourceName, payload) => {
    const payloadList = Array.isArray(payload) ? payload : [payload]

    if (resourceName === 'merchants') {
      fallbackState.merchants = upsertById(fallbackState.merchants, payloadList)
    } else {
      fallbackState.dishes = upsertById(fallbackState.dishes, payloadList)
    }

    return cloneValue(payloadList)
  }

  const patchFallback = (resourceName, id, payload) => {
    const listKey = resourceName === 'merchants' ? 'merchants' : 'dishes'
    fallbackState[listKey] = fallbackState[listKey].map((item) => {
      if (item.id !== id) {
        return item
      }

      return {
        ...item,
        ...cloneValue(payload),
      }
    })

    return cloneValue(
      fallbackState[listKey].find((item) => item.id === id) || null,
    )
  }

  const listResource = async (tableName, fallbackName, options = {}) => {
    if (!config.isConfigured) {
      return listFallback(fallbackName, options)
    }

    const query = buildQueryString(options)
    return request(`/${tableName}?${query}`)
  }

  const saveResource = async (tableName, fallbackName, payload) => {
    if (!config.isConfigured) {
      return saveFallback(fallbackName, payload)
    }

    return request(`/${tableName}?on_conflict=id`, {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    })
  }

  const patchResource = async (tableName, fallbackName, id, payload) => {
    if (!config.isConfigured) {
      return patchFallback(fallbackName, id, payload)
    }

    const result = await request(`/${tableName}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    })

    return Array.isArray(result) ? result[0] || null : result
  }

  const deleteFallback = (resourceName, id) => {
    const listKey = resourceName === 'merchants' ? 'merchants' : 'dishes'
    const beforeCount = fallbackState[listKey].length
    fallbackState[listKey] = fallbackState[listKey].filter((item) => item.id !== id)

    if (resourceName === 'merchants') {
      fallbackState.dishes = fallbackState.dishes.filter((dish) => dish.merchant_id !== id)
    }

    return beforeCount !== fallbackState[listKey].length
  }

  const deleteResource = async (tableName, fallbackName, id) => {
    if (!config.isConfigured) {
      return deleteFallback(fallbackName, id)
    }

    await request(`/${tableName}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        Prefer: 'return=minimal',
      },
    })

    return true
  }

  return {
    isConfigured: config.isConfigured,
    async listMerchants(options = {}) {
      return listResource('dining_merchants', 'merchants', options)
    },
    async listDishes(options = {}) {
      return listResource('dining_dishes', 'dishes', options)
    },
    async saveMerchants(payload) {
      return saveResource('dining_merchants', 'merchants', payload)
    },
    async saveDishes(payload) {
      return saveResource('dining_dishes', 'dishes', payload)
    },
    async patchMerchant(id, payload) {
      return patchResource('dining_merchants', 'merchants', id, payload)
    },
    async patchDish(id, payload) {
      return patchResource('dining_dishes', 'dishes', id, payload)
    },
    async deleteMerchant(id) {
      return deleteResource('dining_merchants', 'merchants', id)
    },
    async deleteDish(id) {
      return deleteResource('dining_dishes', 'dishes', id)
    },
  }
}
