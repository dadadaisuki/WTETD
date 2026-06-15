<script setup>
import { computed, ref, watch } from 'vue'
import { useDiningStore } from '../composables/useDiningStore'
import { getSchoolSearchMeta } from '../services/meituanGateway'

const DASHBOARD_FILTER_KEY = 'wm-diet-wheel-dashboard-filter-v1'

const readSavedFilter = () => {
  if (typeof window === 'undefined') {
    return { selectedTags: [] }
  }

  try {
    return JSON.parse(window.localStorage.getItem(DASHBOARD_FILTER_KEY)) || { selectedTags: [] }
  } catch (error) {
    console.warn('Dashboard filter cache is broken.', error)
    return { selectedTags: [] }
  }
}

const {
  allDishTags,
  allSceneTags,
  dishes,
  isFetchingMeituan,
  loadMeituanNearbyRanking,
  meituanMessage,
  merchants,
} = useDiningStore()

const savedFilter = readSavedFilter()
const selectedTags = ref(Array.isArray(savedFilter.selectedTags) ? savedFilter.selectedTags : [])
const searchQuery = ref('')
const isFilterOpen = ref(false)
const expandedMerchantId = ref('')

const schoolMeta = getSchoolSearchMeta()

watch(selectedTags, () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    DASHBOARD_FILTER_KEY,
    JSON.stringify({ selectedTags: selectedTags.value }),
  )
}, { deep: true })

const toggleTag = (tag) => {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter((item) => item !== tag)
    : [...selectedTags.value, tag]
}

const resetFilters = () => {
  selectedTags.value = []
  searchQuery.value = ''
}

const normalizeSearchText = (value) => {
  return String(value || '').trim().toLowerCase()
}

const matchesSearch = (fields, query) => {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return true
  }

  const haystack = fields.map(normalizeSearchText).join(' ')
  return tokens.every((token) => haystack.includes(token))
}

const heatMetric = (merchant) => {
  const ratingScore = Number(merchant.rating || 0) * 18
  const salesScore = Math.round(Number(merchant.monthly_sales || 0) / 55)
  const tagScore = (merchant.custom_tags || []).length * 4
  return Math.round(Number(merchant.heat || 0) + ratingScore + salesScore + tagScore)
}

const filteredMerchants = computed(() => {
  const activeTags = selectedTags.value
  const query = searchQuery.value
  const pool = merchants.value.filter((merchant) => {
    const relatedDishes = dishes.value.filter((dish) => dish.merchant_id === merchant.id)
    const tags = [
      ...(merchant.scene_tags || []),
      ...(merchant.custom_tags || []),
      ...relatedDishes.flatMap((dish) => dish.tags || []),
    ]
    const tagMatched = activeTags.length === 0 || activeTags.every((tag) => tags.includes(tag))
    const searchMatched = matchesSearch([
      merchant.name,
      merchant.zone,
      merchant.source,
      ...tags,
      ...relatedDishes.flatMap((dish) => [
        dish.name,
        ...(dish.tags || []),
        ...(dish.ingredients || []),
      ]),
    ], query)

    return tagMatched && searchMatched
  })

  return [...pool].sort((left, right) => heatMetric(right) - heatMetric(left))
})

const dashboardTags = computed(() => {
  return [...new Set([...allSceneTags.value, ...allDishTags.value])].filter(Boolean)
})

const getMerchantDishes = (merchantId) => {
  return dishes.value.filter((dish) => dish.merchant_id === merchantId)
}

const getVisibleMerchantDishes = (merchantId) => {
  const merchantDishes = getMerchantDishes(merchantId)

  if (!searchQuery.value) {
    return merchantDishes.slice(0, 4)
  }

  const matchedDishes = merchantDishes.filter((dish) => {
    return matchesSearch([
      dish.name,
      ...(dish.tags || []),
      ...(dish.ingredients || []),
    ], searchQuery.value)
  })

  return (matchedDishes.length ? matchedDishes : merchantDishes).slice(0, 4)
}

const orderedMerchants = computed(() => {
  const list = filteredMerchants.value
  const selectedIndex = list.findIndex((merchant) => merchant.id === expandedMerchantId.value)

  if (selectedIndex === -1) {
    return list
  }

  const selectedMerchant = list[selectedIndex]
  const remainingMerchants = list.filter((_, index) => index !== selectedIndex)

  return [selectedMerchant, ...remainingMerchants]
})

watch(filteredMerchants, (list) => {
  if (
    expandedMerchantId.value
    && !list.some((merchant) => merchant.id === expandedMerchantId.value)
  ) {
    expandedMerchantId.value = ''
  }
})

const isMerchantExpanded = (merchantId) => {
  return expandedMerchantId.value === merchantId
}

const toggleMerchant = (merchantId) => {
  expandedMerchantId.value = expandedMerchantId.value === merchantId ? '' : merchantId
}
</script>

<template>
  <section class="dashboard-page">
    <div class="section-heading">
      <p class="section-heading__eyebrow">Meituan Nearby Board · 800m</p>
      <h2>周边推荐看板</h2>
      <p>
        以 {{ schoolMeta.address }} 为中心参考 {{ schoolMeta.radius }} 米范围，融合 Supabase 热度与美团登记榜单。
      </p>
    </div>

    <div class="toolbar">
      <button
        type="button"
        class="steel-button"
        :disabled="isFetchingMeituan"
        @click="loadMeituanNearbyRanking"
      >
        {{ isFetchingMeituan ? '拉取中...' : '拉取美团周边榜单' }}
      </button>
      <p>{{ meituanMessage }}</p>
    </div>

    <label class="search-box">
      <span>搜索店铺 / 菜品 / Tag</span>
      <input
        v-model.trim="searchQuery"
        type="search"
        placeholder="例如：牛肉、面食、轻食、秦味"
      />
      <small>当前匹配 {{ orderedMerchants.length }} 家店铺</small>
    </label>

    <section class="filter-drawer" :class="{ 'filter-drawer--open': isFilterOpen }">
      <button type="button" class="filter-drawer__trigger" @click="isFilterOpen = !isFilterOpen">
        <span>Tag 筛选</span>
        <strong>{{ selectedTags.length ? `${selectedTags.length} 个已选` : '未筛选' }}</strong>
      </button>

      <div v-show="isFilterOpen" class="filter-drawer__body">
        <label
          v-for="tag in dashboardTags"
          :key="tag"
          class="check-chip"
          :class="{ 'check-chip--active': selectedTags.includes(tag) }"
        >
          <input
            type="checkbox"
            :checked="selectedTags.includes(tag)"
            @change="toggleTag(tag)"
          />
          <span>{{ tag }}</span>
        </label>

        <button type="button" class="check-chip check-chip--reset" @click="resetFilters">
          清空筛选
        </button>
      </div>
    </section>

    <TransitionGroup tag="div" name="merchant-list" class="merchant-grid">
      <article
        v-for="merchant in orderedMerchants"
        :key="merchant.id"
        class="merchant-card"
        :class="{ 'merchant-card--expanded': isMerchantExpanded(merchant.id) }"
        @click="toggleMerchant(merchant.id)"
      >
        <div class="merchant-card__shell">
          <div class="merchant-card__topline">
            <span>{{ merchant.source === 'meituan' ? 'MEITUAN' : 'CAMPUS' }}</span>
            <small>{{ merchant.zone }}</small>
          </div>

          <h3>{{ merchant.name }}</h3>
          <p class="merchant-card__hint">
            {{ isMerchantExpanded(merchant.id) ? '点击收起卡片' : '点击展开数据' }}
          </p>

          <transition name="card-detail">
            <div v-if="isMerchantExpanded(merchant.id)" class="merchant-card__details">
              <strong>Heat Metric {{ heatMetric(merchant) }}</strong>

              <dl class="merchant-card__stats">
                <div>
                  <dt>美团评分</dt>
                  <dd>{{ merchant.rating }}</dd>
                </div>
                <div>
                  <dt>月售单量</dt>
                  <dd>{{ merchant.monthly_sales }}</dd>
                </div>
                <div>
                  <dt>协同热度</dt>
                  <dd>{{ merchant.heat }}</dd>
                </div>
              </dl>

              <div class="dish-preview">
                <span>店内菜品</span>
                <div>
                  <small
                    v-for="dish in getVisibleMerchantDishes(merchant.id)"
                    :key="dish.id"
                  >
                    {{ dish.name }}
                  </small>
                </div>
              </div>

              <div class="tag-row">
                <span
                  v-for="tag in [...(merchant.scene_tags || []), ...(merchant.custom_tags || [])]"
                  :key="`${merchant.id}-${tag}`"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </transition>
        </div>
      </article>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.dashboard-page {
  display: grid;
  gap: 24px;
}

.section-heading {
  text-align: left;
}

.section-heading__eyebrow {
  margin: 0 0 8px;
  color: #5d6a64;
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.section-heading h2 {
  margin: 0 0 10px;
  color: #111414;
  font-size: clamp(34px, 5vw, 64px);
  letter-spacing: -0.06em;
}

.section-heading p,
.toolbar p {
  margin: 0;
  color: #627267;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.search-box {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid #dde7df;
  border-radius: 16px;
  background: #f8fbf8;
  color: #365847;
  font-weight: 900;
}

.search-box input {
  width: 100%;
  border: 1px solid #cddbd1;
  border-radius: 10px;
  padding: 12px 13px;
  background: #fff;
  color: #173126;
  font: inherit;
}

.search-box small {
  color: #728077;
  font-weight: 700;
}

.steel-button,
.filter-drawer__trigger,
.check-chip {
  border: 1px solid #cddbd1;
  border-radius: var(--radius-md);
  background: #fff;
  color: #173126;
  font: inherit;
  cursor: pointer;
}

.steel-button {
  padding: 12px 16px;
  background: #111414;
  color: #fff;
  font-weight: 900;
}

.steel-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.filter-drawer {
  border: 1px solid #dde7df;
  border-radius: 16px;
  background: #f8fbf8;
  overflow: hidden;
  transition: border-color 0.24s ease, box-shadow 0.24s ease;
}

.filter-drawer--open {
  border-color: rgba(45, 122, 87, 0.34);
  box-shadow: 0 18px 36px rgba(23, 49, 38, 0.08);
}

.filter-drawer__trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
  border: 0;
  background: transparent;
  text-align: left;
  font-weight: 900;
}

.filter-drawer__trigger strong {
  color: #2d7a57;
}

.filter-drawer__body {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 18px 18px;
}

.check-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 14px;
  padding: 10px 13px;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.check-chip:hover {
  transform: translateY(-1px);
}

.check-chip input {
  accent-color: #111414;
}

.check-chip--active {
  border-color: #111414;
  background: #111414;
  color: #fff;
}

.check-chip--reset {
  color: #6d746f;
  background: #eef3ef;
}

.merchant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  grid-auto-rows: minmax(188px, auto);
  gap: 16px;
  align-items: stretch;
}

.merchant-card {
  min-height: 188px;
  border: 1px solid #dbe8df;
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(17, 20, 20, 0.08), transparent 36%),
    linear-gradient(145deg, #ffffff, #f4faf6);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  will-change: min-height, transform, box-shadow;
  transition:
    min-height 0.82s var(--ease-smooth),
    transform 0.82s var(--ease-smooth),
    border-color 0.3s ease,
    box-shadow 0.82s var(--ease-smooth),
    background 0.3s ease;
}

.merchant-card:hover {
  transform: translateY(-2px);
}

.merchant-card--expanded {
  grid-column: 1 / -1;
  min-height: 330px;
  border-color: #111414;
  box-shadow: 0 26px 55px rgba(17, 20, 20, 0.14);
  transform: translateY(-4px) scale(1.01);
}

.merchant-list-move {
  transition: transform 0.68s var(--ease-smooth);
}

.merchant-card__shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
  transition: padding 0.68s var(--ease-smooth);
}

.merchant-card--expanded .merchant-card__shell {
  padding: 24px;
}

.merchant-card__topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #69746f;
  font-size: 12px;
  letter-spacing: 0.1em;
}

.merchant-card__topline span {
  color: #2d7a57;
  font-weight: 900;
}

.merchant-card h3 {
  max-width: 12em;
  margin: auto 0 0;
  color: #111414;
  font-size: clamp(24px, 3vw, 38px);
  line-height: 1.02;
  letter-spacing: -0.05em;
}

.merchant-card__hint {
  margin: 0;
  color: #7a8580;
  font-size: 14px;
}

.merchant-card__details {
  display: grid;
  gap: 16px;
  margin-top: 6px;
  max-height: 260px;
  overflow: hidden;
}

.merchant-card__details > strong {
  color: #d94f30;
  font-size: 20px;
}

.merchant-card__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 0;
}

.merchant-card__stats div {
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.76);
}

.merchant-card__stats dt {
  color: #748278;
  font-size: 12px;
}

.merchant-card__stats dd {
  margin: 4px 0 0;
  color: #111414;
  font-weight: 900;
}

.dish-preview {
  display: grid;
  gap: 8px;
}

.dish-preview > span {
  color: #748278;
  font-size: 12px;
  font-weight: 900;
}

.dish-preview div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dish-preview small {
  padding: 7px 10px;
  border-radius: 12px;
  background: #fff7e6;
  color: #7a4b15;
  font-weight: 800;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-row span {
  padding: 6px 9px;
  border-radius: 12px;
  background: #edf6f0;
  color: #315c47;
  font-size: 13px;
}

.card-detail-enter-active,
.card-detail-leave-active {
  transition:
    opacity 0.56s ease 0.12s,
    transform 0.64s var(--ease-smooth) 0.08s,
    max-height 0.72s var(--ease-smooth);
}

.card-detail-leave-active {
  transition:
    opacity 0.34s ease,
    transform 0.42s var(--ease-smooth),
    max-height 0.62s var(--ease-smooth);
}

.card-detail-enter-from,
.card-detail-leave-to {
  opacity: 0;
  transform: translateY(10px);
  max-height: 0;
}

.card-detail-enter-to,
.card-detail-leave-from {
  max-height: 260px;
}

@media (max-width: 760px) {
  .merchant-card--expanded {
    grid-column: 1 / -1;
  }

  .merchant-card__stats {
    grid-template-columns: 1fr;
  }
}
</style>
