import { computed, ref, watch } from 'vue'
import { seedDishes, seedMerchants } from '../data/seedData'
import { createSupabaseGateway } from '../services/supabaseGateway'

const STORAGE_KEY = 'wm-diet-wheel-data-v5'
const gateway = createSupabaseGateway()

const merchants = ref(seedMerchants.map((merchant) => ({ ...merchant })))
const dishes = ref(seedDishes.map((dish) => ({ ...dish })))
const homeSnapshot = ref({
  counts: {
    merchants: seedMerchants.length,
    dishes: seedDishes.length,
    campusMerchants: seedMerchants.filter((merchant) => merchant.source !== 'meituan').length,
    takeoutMerchants: seedMerchants.filter((merchant) => merchant.source === 'meituan').length,
  },
  highlights: {
    topTags: [],
    updatedAt: null,
  },
})
const loadedScopes = ref(new Set())
const isBootstrapped = ref(false)
const isSyncing = ref(false)
const isCloudReady = ref(false)
const syncMessage = ref('等待同步')
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

const isRetiredTestMerchant = (merchant) => {
  return retiredTestMerchantIds.has(merchant.id) || merchant.source === 'test-poi'
}

const isRetiredTestDish = (dish, retiredMerchantIds = retiredTestMerchantIds) => {
  return String(dish.id || '').startsWith('dish-test-')
    || retiredMerchantIds.has(dish.merchant_id)
}

const sanitizeDiningData = (nextMerchants = [], nextDishes = []) => {
  const visibleMerchants = nextMerchants.filter((merchant) => !isRetiredTestMerchant(merchant))
  const visibleMerchantIds = new Set(visibleMerchants.map((merchant) => merchant.id))

  return {
    merchants: visibleMerchants,
    dishes: nextDishes.filter((dish) => {
      return visibleMerchantIds.has(dish.merchant_id) && !isRetiredTestDish(dish)
    }),
  }
}

const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

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
      homeSnapshot: safeClone(homeSnapshot.value),
    }),
  )
}

watch([merchants, dishes, homeSnapshot], writeLocalData, { deep: true })

const rebuildHomeSnapshot = () => {
  const topTagScores = new Map()

  merchants.value.forEach((merchant) => {
    ;[...(merchant.scene_tags || []), ...(merchant.custom_tags || [])].forEach((tag) => {
      topTagScores.set(tag, (topTagScores.get(tag) || 0) + 2)
    })
  })

  dishes.value.forEach((dish) => {
    ;[...(dish.tags || []), ...(dish.ingredients || [])].forEach((tag) => {
      topTagScores.set(tag, (topTagScores.get(tag) || 0) + 1)
    })
  })

  const timestamps = [
    ...merchants.value.map((merchant) => merchant.updated_at),
    ...dishes.value.map((dish) => dish.updated_at),
  ].filter(Boolean).sort()

  homeSnapshot.value = {
    counts: {
      merchants: merchants.value.length,
      dishes: dishes.value.length,
      campusMerchants: merchants.value.filter((merchant) => merchant.source !== 'meituan').length,
      takeoutMerchants: merchants.value.filter((merchant) => merchant.source === 'meituan').length,
    },
    highlights: {
      topTags: [...topTagScores.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([tag, score]) => ({ tag, score })),
      updatedAt: timestamps.at(-1) || null,
    },
  }
}

const hydrateLocalData = () => {
  const cached = readLocalData()

  if (!cached) {
    rebuildHomeSnapshot()
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

  if (cached.homeSnapshot?.counts) {
    homeSnapshot.value = cached.homeSnapshot
  } else {
    rebuildHomeSnapshot()
  }
}

const ensureBootstrapped = () => {
  if (isBootstrapped.value) {
    return
  }

  hydrateLocalData()
  isBootstrapped.value = true
}

const applyCatalogPayload = (scope, payload) => {
  if (typeof payload?.cloudReady === 'boolean') {
    isCloudReady.value = payload.cloudReady
  }

  if (payload?.merchants || payload?.dishes) {
    const sanitized = sanitizeDiningData(
      Array.isArray(payload.merchants) ? payload.merchants : merchants.value,
      Array.isArray(payload.dishes) ? payload.dishes : dishes.value,
    )

    if (Array.isArray(payload.merchants)) {
      merchants.value = sanitized.merchants
    }

    if (Array.isArray(payload.dishes)) {
      dishes.value = sanitized.dishes
    }
  }

  if (scope === 'home' && payload?.counts) {
    homeSnapshot.value = {
      counts: payload.counts,
      highlights: payload.highlights || homeSnapshot.value.highlights,
    }
    return
  }

  rebuildHomeSnapshot()
}

const loadCatalog = async (scope, options = {}) => {
  ensureBootstrapped()

  if (!options.force && loadedScopes.value.has(scope)) {
    return scope === 'home'
      ? homeSnapshot.value
      : {
        merchants: merchants.value,
        dishes: dishes.value,
      }
  }

  try {
    const payload = await gateway.getCatalog(scope)
    applyCatalogPayload(scope, payload)
    loadedScopes.value = new Set([...loadedScopes.value, scope])
    syncMessage.value = scope === 'home' ? '首页摘要已更新' : '云端数据已刷新'
    return payload
  } catch (error) {
    syncMessage.value = '云端拉取失败，当前使用本地缓存'
    console.error(error)
    return scope === 'home'
      ? homeSnapshot.value
      : {
        merchants: merchants.value,
        dishes: dishes.value,
      }
  }
}

const refreshFromCloud = async (scope = 'dashboard') => {
  isSyncing.value = true
  syncMessage.value = '正在刷新云端数据...'

  try {
    return await loadCatalog(scope, { force: true })
  } finally {
    isSyncing.value = false
  }
}

const queueSync = (label, task, refreshScopes = ['dashboard', 'wheel', 'manage', 'home']) => {
  isSyncing.value = true
  syncMessage.value = `${label} 正在同步到云端...`

  task()
    .then(async () => {
      syncMessage.value = `${label} 已同步到云端`
      await Promise.all(refreshScopes.map((scope) => loadCatalog(scope, { force: true })))
    })
    .catch((error) => {
      syncMessage.value = `${label} 同步失败，本地数据已保留`
      console.error(error)
    })
    .finally(() => {
      isSyncing.value = false
    })
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
    ensureBootstrapped()

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
    rebuildHomeSnapshot()

    queueSync('新增店铺', async () => {
      await gateway.upsertMerchant(merchant)
    })

    return merchant
  }

  const addDish = (payload) => {
    ensureBootstrapped()

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
    rebuildHomeSnapshot()

    queueSync('新增菜品', async () => {
      await gateway.upsertDish(dish)
    })

    return dish
  }

  const updateMerchantTags = (merchantId, nextTags) => {
    ensureBootstrapped()

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

    rebuildHomeSnapshot()

    queueSync('协同标签', async () => {
      await gateway.patchMerchant(merchantId, {
        custom_tags: nextCustomTags,
        updated_at: updatedAt,
      })
    })

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
    ensureBootstrapped()

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

    rebuildHomeSnapshot()

    queueSync('转盘热度', async () => {
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

  return {
    merchants,
    dishes,
    homeSnapshot,
    isLoaded: computed(() => loadedScopes.value.size > 0),
    isSyncing,
    isCloudReady: computed(() => isCloudReady.value),
    syncMessage,
    lastResult,
    allSceneTags,
    allDishTags,
    allIngredients,
    getMerchant,
    getMerchantName,
    loadCatalog,
    loadDiningData: () => loadCatalog('dashboard'),
    refreshFromCloud,
    addMerchant,
    addDish,
    addMerchantTag,
    incrementDishHeat,
    updateMerchantTags,
  }
}
