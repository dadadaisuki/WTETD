const normalizeList = (list) => {
  return [...new Set((list || []).filter(Boolean))]
}

const getLatestTimestamp = (...groups) => {
  const timestamps = groups
    .flat()
    .map((item) => item.updated_at)
    .filter(Boolean)
    .sort()

  return timestamps.at(-1) || null
}

const buildTopTags = (merchants, dishes, limit = 6) => {
  const scoreMap = new Map()

  const pushScore = (tag, increment = 1) => {
    if (!tag) {
      return
    }

    scoreMap.set(tag, (scoreMap.get(tag) || 0) + increment)
  }

  merchants.forEach((merchant) => {
    ;[...(merchant.scene_tags || []), ...(merchant.custom_tags || [])].forEach((tag) => pushScore(tag, 2))
  })

  dishes.forEach((dish) => {
    ;[...(dish.tags || []), ...(dish.ingredients || [])].forEach((tag) => pushScore(tag, 1))
  })

  return [...scoreMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([tag, score]) => ({ tag, score }))
}

export const createCatalogService = (repository) => {
  const getHomeCatalog = async () => {
    const [merchants, dishes] = await Promise.all([
      repository.listMerchants({
        fields: ['id', 'source', 'scene_tags', 'custom_tags', 'updated_at'],
        orderBy: 'updated_at.desc',
      }),
      repository.listDishes({
        fields: ['id', 'tags', 'ingredients', 'updated_at'],
        orderBy: 'updated_at.desc',
      }),
    ])

    return {
      scope: 'home',
      cloudReady: repository.isConfigured,
      counts: {
        merchants: merchants.length,
        dishes: dishes.length,
        campusMerchants: merchants.filter((merchant) => merchant.source !== 'meituan').length,
        takeoutMerchants: merchants.filter((merchant) => merchant.source === 'meituan').length,
      },
      highlights: {
        topTags: buildTopTags(merchants, dishes),
        updatedAt: getLatestTimestamp(merchants, dishes),
      },
    }
  }

  const getDashboardCatalog = async () => {
    const [merchants, dishes] = await Promise.all([
      repository.listMerchants({
        fields: ['id', 'name', 'zone', 'source', 'heat', 'scene_tags', 'custom_tags', 'updated_at'],
        orderBy: 'heat.desc',
      }),
      repository.listDishes({
        fields: ['id', 'merchant_id', 'name', 'heat', 'tags', 'ingredients', 'updated_at'],
        orderBy: 'heat.desc',
      }),
    ])

    return {
      scope: 'dashboard',
      cloudReady: repository.isConfigured,
      merchants,
      dishes,
      filters: {
        tags: normalizeList([
          ...merchants.flatMap((merchant) => [
            ...(merchant.scene_tags || []),
            ...(merchant.custom_tags || []),
          ]),
          ...dishes.flatMap((dish) => dish.tags || []),
        ]),
      },
      updatedAt: getLatestTimestamp(merchants, dishes),
    }
  }

  const getWheelCatalog = async () => {
    const [merchants, dishes] = await Promise.all([
      repository.listMerchants({
        fields: ['id', 'name', 'scene_tags', 'custom_tags', 'updated_at'],
        orderBy: 'name.asc',
      }),
      repository.listDishes({
        fields: ['id', 'merchant_id', 'name', 'heat', 'tags', 'ingredients', 'updated_at'],
        orderBy: 'heat.desc',
      }),
    ])

    return {
      scope: 'wheel',
      cloudReady: repository.isConfigured,
      merchants,
      dishes,
      filters: {
        tags: normalizeList(dishes.flatMap((dish) => dish.tags || [])),
        ingredients: normalizeList(dishes.flatMap((dish) => dish.ingredients || [])),
      },
      updatedAt: getLatestTimestamp(merchants, dishes),
    }
  }

  const getManageCatalog = async () => {
    const merchants = await repository.listMerchants({
      fields: ['id', 'name', 'zone', 'source', 'heat', 'scene_tags', 'custom_tags', 'updated_at'],
      orderBy: 'updated_at.desc',
    })

    return {
      scope: 'manage',
      cloudReady: repository.isConfigured,
      merchants,
      updatedAt: getLatestTimestamp(merchants),
    }
  }

  return {
    async getCatalog(scope) {
      switch (scope) {
        case 'home':
          return getHomeCatalog()
        case 'dashboard':
          return getDashboardCatalog()
        case 'wheel':
          return getWheelCatalog()
        case 'manage':
          return getManageCatalog()
        default:
          throw new Error(`Unsupported catalog scope: ${scope}`)
      }
    },
  }
}
