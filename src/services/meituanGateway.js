const SCHOOL_CENTER = {
  name: '西安文理学院高新校区',
  address: '西安市雁塔区科技六路1号',
  latitude: 34.215692,
  longitude: 108.906064,
  radius: 800,
}

const fallbackMerchants = [
  {
    id: 'meituan-hot-potato',
    name: '科技六路热辣拌',
    zone: '校外 480m · 美团登记',
    source: 'meituan',
    rating: 4.7,
    monthly_sales: 3140,
    heat: 77,
    scene_tags: ['校外', '外卖爆款', '高性价比'],
    custom_tags: ['热辣拌', '下课冲', '美团榜单'],
  },
  {
    id: 'meituan-soup-rice',
    name: '丈八汤饭研究所',
    zone: '校外 760m · 美团登记',
    source: 'meituan',
    rating: 4.6,
    monthly_sales: 2298,
    heat: 71,
    scene_tags: ['校外', '外卖爆款', '控卡减脂'],
    custom_tags: ['汤饭', '暖胃', '美团榜单'],
  },
  {
    id: 'meituan-bbq',
    name: '高新烤肉拌饭',
    zone: '校外 690m · 美团登记',
    source: 'meituan',
    rating: 4.8,
    monthly_sales: 3580,
    heat: 83,
    scene_tags: ['校外', '外卖爆款', '高性价比'],
    custom_tags: ['烤肉', '米饭', '美团榜单'],
  },
]

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value
  }

  if (!value) {
    return []
  }

  return [value]
}

const extractMerchantList = (payload) => {
  if (payload?.payload) {
    return extractMerchantList(payload.payload)
  }

  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.merchants)) {
    return payload.merchants
  }

  if (Array.isArray(payload?.items)) {
    return payload.items
  }

  if (Array.isArray(payload?.list)) {
    return payload.list
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  if (Array.isArray(payload?.data?.openPoiBaseInfoList)) {
    return payload.data.openPoiBaseInfoList
  }

  if (Array.isArray(payload?.data?.merchants)) {
    return payload.data.merchants
  }

  return []
}

const normalizeMerchant = (merchant, index) => {
  const rawId = merchant.id
    || merchant.poi_id
    || merchant.poiId
    || merchant.shop_id
    || merchant.wm_poi_id
    || merchant.encryptPoiId
    || index
  const distance = merchant.distance || merchant.distance_meter || merchant.distanceMeter
  const tags = ensureArray(merchant.tags || merchant.tag_list || merchant.categories)
  const sales = merchant.monthly_sales
    || merchant.monthSales
    || merchant.sales
    || merchant.recent_order_num
    || merchant.orderCount
    || 0

  return {
    id: String(rawId).startsWith('meituan-') ? String(rawId) : `meituan-${rawId}`,
    name: merchant.name || merchant.shop_name || merchant.title || `美团商家 ${index + 1}`,
    zone: distance ? `校外 ${distance} · 美团登记` : '校外 800m 内 · 美团登记',
    source: 'meituan',
    rating: Number(merchant.rating || merchant.avg_score || merchant.score || merchant.wm_poi_score || 4.6),
    monthly_sales: Number(sales),
    heat: Number(merchant.heat || merchant.hot || merchant.popularity || sales || 50),
    scene_tags: ['校外', '外卖爆款'],
    custom_tags: ['美团榜单', merchant.average_price_tip, merchant.status_desc, ...tags].filter(Boolean).slice(0, 6),
  }
}

const getOfficialProxyPayload = () => {
  return {
    provider: 'meituan-enterprise-waimai',
    method: 'waimai.poi.list',
    uri: '/waimai/v1/poi/list',
    school: SCHOOL_CENTER,
    query: {
      longitude: Math.round(SCHOOL_CENTER.longitude * 1000000),
      latitude: Math.round(SCHOOL_CENTER.latitude * 1000000),
      page_index: 1,
      page_size: 20,
      sort_type: 0,
      keyword: '美食',
    },
  }
}

const fetchFromProxy = async (proxyUrl, apiKey) => {
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(getOfficialProxyPayload()),
  })

  if (!response.ok) {
    throw new Error(`美团代理接口请求失败：${response.status}`)
  }

  return response.json()
}

export const getSchoolSearchMeta = () => SCHOOL_CENTER

export const fetchMeituanNearbyRanking = async () => {
  const proxyUrl = import.meta.env.VITE_MEITUAN_PROXY_URL
  const apiUrl = import.meta.env.VITE_MEITUAN_RANKING_API_URL
  const apiKey = import.meta.env.VITE_MEITUAN_API_KEY

  if (!proxyUrl && !apiUrl) {
    return {
      source: 'fallback',
      message: '未配置真实美团榜单 API，当前使用西安文理学院 800m 校外兜底榜单。',
      merchants: fallbackMerchants,
    }
  }

  if (proxyUrl) {
    const payload = await fetchFromProxy(proxyUrl, apiKey)
    const list = extractMerchantList(payload)

    return {
      source: 'proxy',
      message: `已通过代理按 ${SCHOOL_CENTER.address} 周边 ${SCHOOL_CENTER.radius}m 拉取美团登记商家。`,
      merchants: list.map(normalizeMerchant),
    }
  }

  const url = new URL(apiUrl)
  url.searchParams.set('lat', SCHOOL_CENTER.latitude)
  url.searchParams.set('lng', SCHOOL_CENTER.longitude)
  url.searchParams.set('radius', SCHOOL_CENTER.radius)
  url.searchParams.set('category', 'food')

  const response = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  })

  if (!response.ok) {
    throw new Error(`美团榜单接口请求失败：${response.status}`)
  }

  const payload = await response.json()
  const list = extractMerchantList(payload)

  return {
    source: 'api',
    message: `已按 ${SCHOOL_CENTER.address} 周边 ${SCHOOL_CENTER.radius}m 拉取美团登记商家。`,
    merchants: list.map(normalizeMerchant),
  }
}
