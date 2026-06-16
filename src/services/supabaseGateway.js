const API_BASE = '/api'

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `API request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

const toPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload
  }

  return payload
}

export const createSupabaseGateway = () => {
  return {
    baseUrl: API_BASE,
    isConfigured: true,
    getCatalog(scope) {
      return request(`/catalogs/${scope}`)
    },
    getMerchants() {
      return request('/merchants').then((payload) => payload.items || [])
    },
    getDishes() {
      return request('/dishes').then((payload) => payload.items || [])
    },
    upsertMerchant(merchant) {
      return request('/merchants', {
        method: 'POST',
        body: JSON.stringify(toPayload(merchant)),
      })
    },
    upsertMerchants(merchants) {
      return request('/merchants', {
        method: 'POST',
        body: JSON.stringify(toPayload(merchants)),
      })
    },
    upsertDish(dish) {
      return request('/dishes', {
        method: 'POST',
        body: JSON.stringify(toPayload(dish)),
      })
    },
    patchMerchant(id, payload) {
      return request(`/merchants/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },
    patchDish(id, payload) {
      return request(`/dishes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },
    deleteMerchant(id) {
      return request(`/merchants/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
    },
    deleteDish(id) {
      return request(`/dishes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
    },
  }
}
