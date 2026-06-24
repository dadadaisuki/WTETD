import { computed, ref, watch } from 'vue'
import { seedDishes, seedMerchants } from '../data/seedData'
import { createSupabaseGateway } from '../services/supabaseGateway'

const STORAGE_KEY = 'wm-diet-wheel-data-v5'
const gateway = createSupabaseGateway()

const TAG_PRIORITY = ['外卖', '食堂', '校外']

const normalizeList = (list) => {
  return [...new Set((list || [])
    .map((value) => String(value || '').trim())
    .filter((item) => item && item !== '??'))]
}

const sortTagsWithPriority = (list) => {
  return normalizeList(list).sort((left, right) => {
    const leftPriority = TAG_PRIORITY.indexOf(left)
    const rightPriority = TAG_PRIORITY.indexOf(right)

    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) {
        return 1
      }

      if (rightPriority === -1) {
        return -1
      }

      return leftPriority - rightPriority
    }

    return left.localeCompare(right, 'zh-Hans-CN')
  })
}

const createTypedTagOption = (value, type) => ({
  key: `${type}:${value}`,
  value,
  type,
  label: type === 'ingredient' ? '食材tag' : '一般tag',
})

const getMerchantTagPool = (merchant) => {
  return normalizeList([...(merchant?.scene_tags || []), ...(merchant?.custom_tags || [])])
}

const isOutsideMerchant = (merchant) => {
  const tags = getMerchantTagPool(merchant)

  return merchant?.source === 'meituan'
    || String(merchant?.zone || '').includes('校外')
    || tags.includes('校外')
}

const isTakeawayMerchant = (merchant) => {
  const tags = getMerchantTagPool(merchant)

  return merchant?.source === 'takeaway'
    || String(merchant?.zone || '').includes('外卖')
    || tags.includes('外卖')
    || tags.includes('外卖爆款')
}

const isCampusMerchant = (merchant) => {
  return !isOutsideMerchant(merchant)
    && merchant?.source !== 'takeaway'
    && merchant?.zone !== '外卖美食'
}

const decorateMerchantTags = (merchant) => {
  const isTakeawayZone = String(merchant.zone || '').includes('外卖')
  const isTakeawaySource = merchant.source === 'meituan' || merchant.source === 'takeaway'
  const isTakeawayName = String(merchant.name || '').includes('外卖')
  const sceneTags = normalizeList(merchant.scene_tags)
  const customTags = normalizeList(merchant.custom_tags)
  const nextSceneTags = [...sceneTags]

  if (
    merchant.zone === '文档导入档口'
    || sceneTags.includes('校园档口')
    || sceneTags.includes('小吃档口')
    || sceneTags.includes('粉面档口')
    || sceneTags.includes('盖饭快餐')
    || sceneTags.includes('热菜档口')
  ) {
    nextSceneTags.push('食堂')
  }

  if (
    merchant.zone === '外卖美食'
    || isTakeawayZone
    || isTakeawaySource
    || isTakeawayName
    || sceneTags.includes('外卖')
    || sceneTags.includes('外卖爆款')
    || customTags.includes('外卖')
  ) {
    nextSceneTags.push('外卖')
  }

  if (
    isTakeawaySource
    || String(merchant.zone || '').includes('校外')
    || sceneTags.includes('校外')
    || customTags.includes('校外')
  ) {
    nextSceneTags.push('校外')
  }

  return {
    ...merchant,
    scene_tags: sortTagsWithPriority(nextSceneTags),
    custom_tags: sortTagsWithPriority(customTags),
  }
}

const decorateDishTags = (dish, merchant) => {
  const merchantSceneTags = normalizeList(merchant?.scene_tags)
  const merchantCustomTags = normalizeList(merchant?.custom_tags)
  const nextIngredients = sortTagsWithPriority(dish.ingredients)
  const ingredientSet = new Set(nextIngredients)
  const nextTags = normalizeList(dish.tags).filter((tag) => !ingredientSet.has(tag))

  if (
    merchant?.zone === '外卖美食'
    || merchant?.source === 'meituan'
    || merchantSceneTags.includes('外卖')
    || merchantSceneTags.includes('外卖爆款')
    || merchantCustomTags.includes('外卖')
  ) {
    nextTags.push('外卖')
  }

  return {
    ...dish,
    tags: sortTagsWithPriority(nextTags),
    ingredients: nextIngredients,
  }
}

const decorateDiningData = (nextMerchants = [], nextDishes = []) => {
  const normalizedMerchants = nextMerchants.map(decorateMerchantTags)
  const merchantMap = new Map(normalizedMerchants.map((merchant) => [merchant.id, merchant]))
  const normalizedDishes = nextDishes.map((dish) => decorateDishTags(dish, merchantMap.get(dish.merchant_id)))

  return {
    merchants: normalizedMerchants,
    dishes: normalizedDishes,
  }
}

const seededDiningData = decorateDiningData(seedMerchants, seedDishes)

const merchants = ref(seededDiningData.merchants.map((merchant) => ({ ...merchant })))
const dishes = ref(seededDiningData.dishes.map((dish) => ({ ...dish })))
const homeSnapshot = ref({
  counts: {
    merchants: seededDiningData.merchants.length,
    dishes: seededDiningData.dishes.length,
    campusMerchants: seededDiningData.merchants.filter((merchant) => isCampusMerchant(merchant)).length,
    takeoutMerchants: seededDiningData.merchants.filter((merchant) => {
      return isOutsideMerchant(merchant) || isTakeawayMerchant(merchant)
    }).length,
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
const mergeRecordsById = (baseList = [], nextList = []) => {
  const mergedMap = new Map(baseList.map((item) => [item.id, safeClone(item)]))

  nextList.forEach((item) => {
    mergedMap.set(item.id, {
      ...(mergedMap.get(item.id) || {}),
      ...safeClone(item),
    })
  })

  return [...mergedMap.values()]
}
const normalizeText = (value) => String(value || '').trim()
const normalizeCompareText = (value) => normalizeText(value).toLowerCase()

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
  const decorated = decorateDiningData(nextMerchants, nextDishes)
  const visibleMerchants = decorated.merchants.filter((merchant) => !isRetiredTestMerchant(merchant))
  const visibleMerchantIds = new Set(visibleMerchants.map((merchant) => merchant.id))

  return {
    merchants: visibleMerchants,
    dishes: decorated.dishes.filter((dish) => {
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
      campusMerchants: merchants.value.filter((merchant) => isCampusMerchant(merchant)).length,
      takeoutMerchants: merchants.value.filter((merchant) => {
        return isOutsideMerchant(merchant) || isTakeawayMerchant(merchant)
      }).length,
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
    mergeRecordsById(
      seededDiningData.merchants,
      Array.isArray(cached.merchants) ? cached.merchants : [],
    ),
    mergeRecordsById(
      seededDiningData.dishes,
      Array.isArray(cached.dishes) ? cached.dishes : [],
    ),
  )

  if (sanitized.merchants.length > 0) {
    merchants.value = sanitized.merchants
  }

  if (sanitized.dishes.length > 0) {
    dishes.value = sanitized.dishes
  }

  rebuildHomeSnapshot()
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
      mergeRecordsById(
        seededDiningData.merchants,
        Array.isArray(payload.merchants) ? payload.merchants : merchants.value,
      ),
      mergeRecordsById(
        seededDiningData.dishes,
        Array.isArray(payload.dishes) ? payload.dishes : dishes.value,
      ),
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
    return sortTagsWithPriority(merchants.value.flatMap((merchant) => merchant.scene_tags || []))
  })

  const allIngredients = computed(() => {
    return sortTagsWithPriority(dishes.value.flatMap((dish) => dish.ingredients || []))
  })

  const ingredientTagSet = computed(() => {
    return new Set(allIngredients.value)
  })

  const allDishTags = computed(() => {
    return sortTagsWithPriority(dishes.value.flatMap((dish) => dish.tags || []))
      .filter((tag) => !ingredientTagSet.value.has(tag))
  })

  const allDishTagOptions = computed(() => {
    return allDishTags.value.map((value) => createTypedTagOption(value, 'normal'))
  })

  const allIngredientTagOptions = computed(() => {
    return allIngredients.value.map((value) => createTypedTagOption(value, 'ingredient'))
  })

  const getMerchantName = (merchantId) => {
    return merchantById.value.get(merchantId)?.name || '未知档口'
  }

  const getMerchant = (merchantId) => {
    return merchantById.value.get(merchantId) || null
  }

  const addMerchant = (payload) => {
    ensureBootstrapped()

    const merchantName = normalizeText(payload.name)
    const hasDuplicateMerchant = merchants.value.some((merchant) => {
      return normalizeCompareText(merchant.name) === normalizeCompareText(merchantName)
    })

    if (hasDuplicateMerchant) {
      throw new Error('该店铺已存在，请勿重复添加。')
    }

    const merchant = {
      id: createId('merchant'),
      name: merchantName,
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
    const dishName = normalizeText(payload.name)

    if (!merchant) {
      throw new Error('所选店铺不存在，请重新选择后再试。')
    }

    const hasDuplicateDish = dishes.value.some((dish) => {
      return dish.merchant_id === payload.merchant_id
        && normalizeCompareText(dish.name) === normalizeCompareText(dishName)
    })

    if (hasDuplicateDish) {
      throw new Error('该店铺下已存在同名菜品，请勿重复添加。')
    }

    const merchantTags = [
      ...(merchant?.scene_tags || []),
      ...(merchant?.custom_tags || []),
    ]
    const payloadIngredients = normalizeList(payload.ingredients)
    const ingredientSet = new Set(payloadIngredients)
    const payloadTags = normalizeList(payload.tags).filter((tag) => !ingredientSet.has(tag))
    const shouldMarkTakeaway = merchant?.source === 'meituan'
      || merchantTags.includes('校外')
      || merchantTags.includes('外卖')
      || merchantTags.includes('外卖爆款')
      || payloadTags.includes('校外')
      || payloadTags.includes('外卖爆款')

    const dish = {
      id: createId('dish'),
      merchant_id: payload.merchant_id,
      name: dishName,
      calories: Number(payload.calories) || 0,
      price: Number(payload.price) || 0,
      heat: 1,
      tags: normalizeList([...payloadTags, shouldMarkTakeaway ? '外卖' : '']),
      ingredients: payloadIngredients,
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
    allDishTagOptions,
    allIngredientTagOptions,
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
