import { computed, ref, watch } from 'vue'
import { seedDishes, seedMerchants } from '../data/seedData'
import { fetchMeituanNearbyRanking } from '../services/meituanGateway'
import { createSupabaseGateway } from '../services/supabaseGateway'

const STORAGE_KEY = 'wm-diet-wheel-data-v4'
const gateway = createSupabaseGateway()

const merchants = ref(seedMerchants.map((merchant) => ({ ...merchant })))
const dishes = ref(seedDishes.map((dish) => ({ ...dish })))
const isLoaded = ref(false)
const isSyncing = ref(false)
const isFetchingMeituan = ref(false)
const syncMessage = ref(gateway.isConfigured ? '云端待同步' : '本地模式：缺少 Supabase anon key')
const meituanMessage = ref('。')
const lastResult = ref(null)

const safeClone = (value) => JSON.parse(JSON.stringify(value))

const normalizeText = (value) => String(value || '').trim()

const normalizeList = (list) => {
  return [...new Set((list || [])
    .map(normalizeText)
    .filter((item) => item && item !== '??'))]
}

const retiredTestMerchantIds = new Set([
  'merchant-test-noodle',
  'merchant-test-rice',
  'merchant-test-light',
  'merchant-test-snack',
])

const retiredTestDishNames = new Set(['验收牛肉拌饭'])
const retiredTestMerchantNames = new Set(['验收测试店铺A'])

const isRetiredTestMerchant = (merchant) => {
  return retiredTestMerchantIds.has(merchant.id)
    || retiredTestMerchantNames.has(merchant.name)
    || merchant.source === 'test-poi'
}

const isRetiredTestDish = (dish, retiredMerchantIds = retiredTestMerchantIds) => {
  return String(dish.id || '').startsWith('dish-test-')
    || retiredTestDishNames.has(dish.name)
    || retiredMerchantIds.has(dish.merchant_id)
}

const sanitizeDiningData = (nextMerchants = [], nextDishes = []) => {
  const visibleMerchants = nextMerchants.filter((merchant) => !isRetiredTestMerchant(merchant))
  const visibleMerchantIds = new Set(visibleMerchants.map((merchant) => merchant.id))

  return {
    merchants: visibleMerchants,
    dishes: nextDishes.filter((dish) => (
      visibleMerchantIds.has(dish.merchant_id)
      && !isRetiredTestDish(dish)
    )),
  }
}

const createId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const readLocalData = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    console.warn('Local dining cache is broken.', error)
    return null
  }
}

const writeLocalData = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      merchants: safeClone(merchants.value),
      dishes: safeClone(dishes.value),
    }),
  )
}

watch([merchants, dishes], writeLocalData, { deep: true })

const hydrateLocalData = () => {
  const cached = readLocalData()

  if (!cached) {
    return
  }

  const sanitized = sanitizeDiningData(
    Array.isArray(cached.merchants) ? cached.merchants : [],
    Array.isArray(cached.dishes) ? cached.dishes : [],
  )

  if (sanitized.merchants.length > 0) {
    merchants.value = sanitized.merchants
  }

  if (sanitized.dishes.length > 0) {
    dishes.value = sanitized.dishes
  }
}

const queueSync = (label, task) => {
  if (!gateway.isConfigured) {
    syncMessage.value = `${label} 已保存到本地，等待配置 Supabase anon key`
    return
  }

  isSyncing.value = true
  syncMessage.value = `${label} 正在同步到云端...`

  task()
    .then(() => {
      syncMessage.value = `${label} 已同步到 Supabase`
      return refreshFromCloud()
    })
    .catch((error) => {
      syncMessage.value = `${label} 云端同步失败，本地数据已保留`
      console.error(error)
    })
    .finally(() => {
      isSyncing.value = false
    })
}

const mergeMerchants = (nextMerchants) => {
  const current = new Map(merchants.value.map((merchant) => [merchant.id, merchant]))
  const normalizedMerchants = nextMerchants.map((merchant) => {
    const normalized = {
      ...merchant,
      source: merchant.source || 'meituan',
      scene_tags: normalizeList([...(merchant.scene_tags || []), merchant.source === 'meituan' ? '校外' : '']),
      custom_tags: normalizeList(merchant.custom_tags || []),
      updated_at: new Date().toISOString(),
    }

    current.set(normalized.id, {
      ...(current.get(normalized.id) || {}),
      ...normalized,
    })

    return normalized
  })

  merchants.value = [...current.values()]
  return normalizedMerchants
}

export const refreshFromCloud = async () => {
  if (!gateway.isConfigured) {
    syncMessage.value = '本地模式：请配置 VITE_SUPABASE_ANON_KEY 后连接云端'
    return
  }

  isSyncing.value = true
  syncMessage.value = '正在拉取全校协同数据...'

  try {
    const [cloudMerchants, cloudDishes] = await Promise.all([
      gateway.getMerchants(),
      gateway.getDishes(),
    ])

    const sanitized = sanitizeDiningData(
      Array.isArray(cloudMerchants) ? cloudMerchants : [],
      Array.isArray(cloudDishes) ? cloudDishes : [],
    )

    if (sanitized.merchants.length > 0) {
      merchants.value = sanitized.merchants
    }

    if (sanitized.dishes.length > 0) {
      dishes.value = sanitized.dishes
    }

    syncMessage.value = '已刷新标签与热度数据'
  } catch (error) {
    syncMessage.value = '云端拉取失败，当前使用本地缓存'
    console.error(error)
  } finally {
    isSyncing.value = false
  }
}

export const loadDiningData = async () => {
  if (isLoaded.value) {
    return
  }

  hydrateLocalData()
  isLoaded.value = true
  await refreshFromCloud()
}

export const useDiningStore = () => {
  const merchantById = computed(() => {
    return new Map(merchants.value.map((merchant) => [merchant.id, merchant]))
  })

  const allSceneTags = computed(() => {
    return normalizeList(merchants.value.flatMap((merchant) => merchant.scene_tags || []))
  })

  const allDishTags = computed(() => {
    return normalizeList(dishes.value.flatMap((dish) => dish.tags || []))
  })

  const allIngredients = computed(() => {
    return normalizeList(dishes.value.flatMap((dish) => dish.ingredients || []))
  })

  const getMerchantName = (merchantId) => {
    return merchantById.value.get(merchantId)?.name || '未知档口'
  }

  const getMerchant = (merchantId) => {
    return merchantById.value.get(merchantId) || null
  }

  const addMerchant = (payload) => {
    const merchant = {
      id: createId('merchant'),
      name: normalizeText(payload.name),
      zone: normalizeText(payload.zone) || '自定义店铺',
      source: payload.source || 'manual',
      rating: Number(payload.rating) || 4.5,
      monthly_sales: Number(payload.monthly_sales) || 0,
      heat: Number(payload.heat) || 1,
      scene_tags: normalizeList(payload.scene_tags),
      custom_tags: normalizeList(payload.custom_tags),
      updated_at: new Date().toISOString(),
    }

    merchants.value = [merchant, ...merchants.value]
    queueSync('新增店铺', () => gateway.upsertMerchant(merchant))
    return merchant
  }

  const addDish = (payload) => {
    const merchant = merchantById.value.get(payload.merchant_id)
    const merchantTags = [
      ...(merchant?.scene_tags || []),
      ...(merchant?.custom_tags || []),
    ]
    const payloadTags = normalizeList(payload.tags)
    const shouldMarkTakeaway = merchant?.source === 'meituan'
      || merchantTags.includes('校外')
      || merchantTags.includes('外卖')
      || merchantTags.includes('外卖爆款')
      || payloadTags.includes('校外')
      || payloadTags.includes('外卖爆款')

    const dish = {
      id: createId('dish'),
      merchant_id: payload.merchant_id,
      name: normalizeText(payload.name),
      calories: Number(payload.calories) || 0,
      price: Number(payload.price) || 0,
      heat: 1,
      tags: normalizeList([...payloadTags, shouldMarkTakeaway ? '外卖' : '']),
      ingredients: normalizeList(payload.ingredients),
      updated_at: new Date().toISOString(),
    }

    dishes.value = [dish, ...dishes.value]
    queueSync('新增餐品', () => gateway.upsertDish(dish))
    return dish
  }

  const updateMerchantTags = (merchantId, nextTags) => {
    const nextCustomTags = normalizeList(nextTags)
    const updatedAt = new Date().toISOString()
    const merchant = merchants.value.find((item) => item.id === merchantId)

    if (!merchant) {
      return null
    }

    merchants.value = merchants.value.map((item) => {
      if (item.id !== merchantId) {
        return item
      }

      return {
        ...item,
        custom_tags: nextCustomTags,
        updated_at: updatedAt,
      }
    })

    queueSync('协同标签', () =>
      gateway.patchMerchant(merchantId, {
        custom_tags: nextCustomTags,
        updated_at: updatedAt,
      }),
    )

    return {
      ...merchant,
      custom_tags: nextCustomTags,
      updated_at: updatedAt,
    }
  }

  const addMerchantTag = (merchantId, tag) => {
    const merchant = merchantById.value.get(merchantId)
    if (!merchant) {
      return null
    }

    return updateMerchantTags(merchantId, [...(merchant.custom_tags || []), tag])
  }

  const incrementDishHeat = (dishId) => {
    const updatedAt = new Date().toISOString()
    let updatedDish = null
    let updatedMerchant = null

    dishes.value = dishes.value.map((dish) => {
      if (dish.id !== dishId) {
        return dish
      }

      updatedDish = {
        ...dish,
        heat: Number(dish.heat || 0) + 1,
        updated_at: updatedAt,
      }

      return updatedDish
    })

    if (!updatedDish) {
      return null
    }

    merchants.value = merchants.value.map((merchant) => {
      if (merchant.id !== updatedDish.merchant_id) {
        return merchant
      }

      updatedMerchant = {
        ...merchant,
        heat: Number(merchant.heat || 0) + 1,
        updated_at: updatedAt,
      }

      return updatedMerchant
    })

    queueSync('轮盘热度', async () => {
      await gateway.patchDish(updatedDish.id, {
        heat: updatedDish.heat,
        updated_at: updatedDish.updated_at,
      })

      if (updatedMerchant) {
        await gateway.patchMerchant(updatedMerchant.id, {
          heat: updatedMerchant.heat,
          updated_at: updatedMerchant.updated_at,
        })
      }
    })

    return updatedDish
  }

  const loadMeituanNearbyRanking = async () => {
    isFetchingMeituan.value = true
    meituanMessage.value = ''

    try {
      const result = await fetchMeituanNearbyRanking()
      const merged = mergeMerchants(result.merchants)
      meituanMessage.value = result.message

      queueSync('周边登记商家', () => gateway.upsertMerchants(merged))
    } catch (error) {
      meituanMessage.value = '周边餐饮数据拉取失败，请检查接口地址、鉴权或浏览器跨域限制。'
      console.error(error)
    } finally {
      isFetchingMeituan.value = false
    }
  }

  return {
    merchants,
    dishes,
    isLoaded,
    isSyncing,
    isFetchingMeituan,
    syncMessage,
    meituanMessage,
    isCloudReady: computed(() => gateway.isConfigured),
    lastResult,
    allSceneTags,
    allDishTags,
    allIngredients,
    getMerchant,
    getMerchantName,
    loadDiningData,
    refreshFromCloud,
    addMerchant,
    addDish,
    addMerchantTag,
    incrementDishHeat,
    updateMerchantTags,
    loadMeituanNearbyRanking,
  }
}
