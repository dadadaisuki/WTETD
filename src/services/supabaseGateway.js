const DEFAULT_SUPABASE_URL = 'https://pjgixbywuffzovsblyku.supabase.co/rest/v1'

const normalizeBaseUrl = (url) => {
  return String(url || DEFAULT_SUPABASE_URL).replace(/\/$/, '')
}

export const createSupabaseGateway = () => {
  const baseUrl = normalizeBaseUrl(import.meta.env.VITE_SUPABASE_URL)
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const isConfigured = Boolean(baseUrl && anonKey)

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  }

  const request = async (path, options = {}) => {
    if (!isConfigured) {
      throw new Error('Supabase anon key is missing.')
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `Supabase request failed: ${response.status}`)
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  }

  return {
    baseUrl,
    isConfigured,
    getMerchants() {
      return request('/dining_merchants?select=*&order=heat.desc')
    },
    getDishes() {
      return request('/dining_dishes?select=*&order=heat.desc')
    },
    upsertMerchant(merchant) {
      return request('/dining_merchants?on_conflict=id', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(merchant),
      })
    },
    upsertMerchants(merchants) {
      return request('/dining_merchants?on_conflict=id', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(merchants),
      })
    },
    upsertDish(dish) {
      return request('/dining_dishes?on_conflict=id', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(dish),
      })
    },
    patchMerchant(id, payload) {
      return request(`/dining_merchants?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })
    },
    patchDish(id, payload) {
      return request(`/dining_dishes?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })
    },
  }
}
