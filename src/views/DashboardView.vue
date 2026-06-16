<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
  loadCatalog,
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

const getMerchantDishes = (merchantId) => {
  return dishes.value.filter((dish) => dish.merchant_id === merchantId)
}

const getMerchantTags = (merchant) => {
  return [...new Set([...(merchant.scene_tags || []), ...(merchant.custom_tags || [])])]
    .filter((tag) => tag && tag !== '??')
}

const getMerchantOriginBadges = (merchant) => {
  const relatedDishes = getMerchantDishes(merchant.id)
  const dishTags = relatedDishes.flatMap((dish) => dish.tags || [])
  const merchantTags = getMerchantTags(merchant)
  const badges = []
  const isOutside = merchant.source === 'meituan'
    || merchant.zone?.includes('校外')
    || merchantTags.includes('校外')
  const isTakeout = merchantTags.includes('外卖')
    || merchantTags.includes('外卖爆款')
    || dishTags.includes('外卖')
    || dishTags.includes('外卖爆款')

  badges.push(isOutside ? '校园外' : '校园内')

  if (isTakeout) {
    badges.push('外卖')
  }

  return badges
}

const getDishChips = (dish) => {
  return [...new Set([...(dish.tags || []), ...(dish.ingredients || [])])]
    .filter((tag) => tag && tag !== '??')
    .slice(0, 7)
}

const heatMetric = (merchant) => {
  const dishHeatScore = getMerchantDishes(merchant.id)
    .reduce((sum, dish) => sum + Number(dish.heat || 0), 0)
  const tagScore = getMerchantTags(merchant).length * 3

  return Math.round(Number(merchant.heat || 0) + dishHeatScore * 0.28 + tagScore)
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

const getVisibleMerchantDishes = (merchantId) => {
  const merchantDishes = getMerchantDishes(merchantId)

  if (!searchQuery.value) {
    return merchantDishes
  }

  const matchedDishes = merchantDishes.filter((dish) => {
    return matchesSearch([
      dish.name,
      ...(dish.tags || []),
      ...(dish.ingredients || []),
    ], searchQuery.value)
  })

  return matchedDishes.length ? matchedDishes : merchantDishes
}

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

onMounted(() => {
  loadCatalog('dashboard')
})
</script>

<template>
  <section class="dashboard-page">
    <div class="section-heading">
      <p class="section-heading__eyebrow">Nearby Food · 800m</p>
      <h2>校园周边美食</h2>
      <p>
        以 {{ schoolMeta.address }} 为中心参考 {{ schoolMeta.radius }} 米范围，按店铺热度、菜品热度和协同 Tag 综合排序。
      </p>
    </div>

    <label class="search-box">
      <span>搜索店铺 / 菜品 / Tag</span>
      <input
        v-model.trim="searchQuery"
        type="search"
        placeholder="例如：牛肉、面食、轻食、秦味"
      />
      <small>当前匹配 {{ filteredMerchants.length }} 家店铺</small>
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
        v-for="merchant in filteredMerchants"
        :key="merchant.id"
        class="merchant-card"
        :class="{ 'merchant-card--expanded': isMerchantExpanded(merchant.id) }"
        @click="toggleMerchant(merchant.id)"
      >
        <div class="merchant-card__shell">
          <div class="merchant-card__topline">
            <div class="merchant-card__badges">
              <span
                v-for="badge in getMerchantOriginBadges(merchant)"
                :key="`${merchant.id}-${badge}`"
              >
                {{ badge }}
              </span>
            </div>
          </div>

          <h3>{{ merchant.name }}</h3>
          <p class="merchant-card__hint">
            {{ isMerchantExpanded(merchant.id) ? '点击收起详情' : '点击查看菜品' }}
          </p>

          <transition name="card-detail">
            <div v-if="isMerchantExpanded(merchant.id)" class="merchant-card__details">
              <div class="merchant-card__summary">
                <div>
                  <span>综合热度</span>
                  <strong>{{ heatMetric(merchant) }}</strong>
                </div>
                <div>
                  <span>店内菜品</span>
                  <strong>{{ getMerchantDishes(merchant.id).length }}</strong>
                </div>
                <div>
                  <span>协同热度</span>
                  <strong>{{ merchant.heat || 0 }}</strong>
                </div>
              </div>

              <p class="merchant-card__location">
                {{ merchant.zone }}
              </p>

              <div class="dish-preview">
                <div class="dish-preview__head">
                  <span>店家对应菜品</span>
                  <small>点击“新增标签”可以继续补充菜品和 Tag</small>
                </div>

                <div v-if="getVisibleMerchantDishes(merchant.id).length" class="dish-list">
                  <article
                    v-for="dish in getVisibleMerchantDishes(merchant.id)"
                    :key="dish.id"
                    class="dish-card"
                  >
                    <div>
                      <strong>{{ dish.name }}</strong>
                      <span>热度 {{ dish.heat || 0 }}</span>
                    </div>

                    <div class="dish-tags">
                      <small
                        v-for="tag in getDishChips(dish)"
                        :key="`${dish.id}-${tag}`"
                      >
                        {{ tag }}
                      </small>
                    </div>
                  </article>
                </div>

                <p v-else class="empty-dishes">
                  这个店铺还没有录入菜品，可以去“新增标签”模块补充。
                </p>
              </div>

              <div class="tag-row">
                <span
                  v-for="tag in getMerchantTags(merchant)"
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
  position: relative;
  display: grid;
  gap: 22px;
  padding-top: 4px;
}

.dashboard-page::before,
.dashboard-page::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.dashboard-page::before {
  top: 1.2rem;
  right: 1.5rem;
  width: 112px;
  height: 112px;
  border: var(--border-strong);
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 16px 16px,
    var(--sky);
  box-shadow: var(--shadow-sticker);
  animation: floatSticker 7s ease-in-out infinite;
}

.dashboard-page::after {
  left: 1rem;
  top: 11rem;
  width: 126px;
  height: 24px;
  border: var(--border-strong);
  border-radius: 999px;
  background:
    repeating-linear-gradient(90deg, #151515 0 8px, transparent 8px 18px),
    var(--pink);
  box-shadow: var(--shadow-sticker);
  animation: wiggleLine 5s ease-in-out infinite;
}

.section-heading {
  position: relative;
  text-align: left;
  z-index: 1;
}

.section-heading__eyebrow {
  display: inline-block;
  margin: 0 0 14px;
  padding: 8px 12px;
  border: var(--border-strong);
  border-radius: 999px;
  background: var(--yellow);
  color: var(--ink);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  box-shadow: 4px 4px 0 #151515;
}

.section-heading h2 {
  margin: 0 0 10px;
  color: var(--ink);
  font-size: clamp(34px, 4.4vw, 56px);
  letter-spacing: -0.05em;
  text-shadow: 3px 3px 0 var(--paper), 6px 6px 0 var(--lime);
}

.section-heading p {
  margin: 0;
  color: #383838;
  font-weight: 700;
}

.search-box {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: var(--border-strong);
  border-radius: 24px;
  background:
    linear-gradient(135deg, transparent 0 34%, rgba(21, 21, 21, 0.1) 34% 38%, transparent 38% 100%),
    var(--paper);
  color: var(--ink);
  font-weight: 900;
  box-shadow: var(--shadow-sticker);
}

.search-box input {
  width: 100%;
  border: var(--border-strong);
  border-radius: 16px;
  padding: 13px 14px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  box-shadow: 4px 4px 0 #151515;
}

.search-box small {
  color: #404040;
  font-weight: 700;
}

.filter-drawer__trigger,
.check-chip {
  border: var(--border-strong);
  border-radius: 18px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.filter-drawer {
  border: var(--border-strong);
  border-radius: 24px;
  background: var(--paper-alt);
  overflow: hidden;
  box-shadow: var(--shadow-sticker);
  transition: transform 0.24s ease, box-shadow 0.24s ease, background 0.24s ease;
}

.filter-drawer--open {
  transform: translate(-2px, -2px);
  box-shadow: 8px 8px 0 #151515;
  background: #fff8d9;
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
  color: var(--red);
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
  border-radius: 999px;
  padding: 10px 13px;
  background: #fff;
  box-shadow: 3px 3px 0 #151515;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.check-chip:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #151515;
}

.check-chip input {
  accent-color: var(--ink);
}

.check-chip--active {
  background: var(--lime);
  color: var(--ink);
}

.check-chip--reset {
  background: var(--pink);
  color: var(--ink);
}

.merchant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  grid-auto-rows: minmax(188px, auto);
  gap: 16px;
  align-items: stretch;
}

.merchant-card {
  position: relative;
  min-height: 188px;
  border: var(--border-strong);
  border-radius: 24px;
  background: var(--paper);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  will-change: min-height, transform, box-shadow;
  transition:
    min-height 0.92s var(--ease-smooth),
    transform 0.32s ease,
    box-shadow 0.92s var(--ease-smooth),
    background 0.3s ease;
  box-shadow: var(--shadow-sticker);
}

.merchant-card::before,
.merchant-card::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.merchant-card::before {
  top: 16px;
  right: 16px;
  width: 58px;
  height: 58px;
  border: var(--border-strong);
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 12px 12px,
    rgba(255, 255, 255, 0.7);
  animation: pulseDots 4.6s ease-in-out infinite;
}

.merchant-card::after {
  bottom: 16px;
  right: 18px;
  width: 92px;
  height: 16px;
  border-radius: 999px;
  background:
    repeating-linear-gradient(90deg, #151515 0 8px, transparent 8px 16px),
    rgba(255, 255, 255, 0.72);
  animation: wiggleLine 4.8s ease-in-out infinite;
}

.merchant-card:nth-child(4n + 1) {
  background: #fff5fb;
}

.merchant-card:nth-child(4n + 2) {
  background: #fffbe2;
}

.merchant-card:nth-child(4n + 3) {
  background: #eefbff;
}

.merchant-card:nth-child(4n + 4) {
  background: #f4ffe9;
}

.merchant-card:hover {
  transform: translate(-3px, -3px) rotate(-1deg);
  box-shadow: 9px 9px 0 #151515;
}

.merchant-card--expanded {
  grid-column: 1 / -1;
  min-height: 410px;
  background:
    linear-gradient(0deg, transparent 0 19px, rgba(21, 21, 21, 0.08) 19px 20px, transparent 20px),
    linear-gradient(90deg, transparent 0 19px, rgba(21, 21, 21, 0.08) 19px 20px, transparent 20px),
    var(--paper);
  background-size: 20px 20px, 20px 20px, auto;
  box-shadow: 10px 10px 0 #151515;
  transform: none;
}

.merchant-list-move {
  transition: transform 0.68s var(--ease-smooth);
}

.merchant-card__shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 22px;
  transition: padding 0.72s var(--ease-smooth);
}

.merchant-card--expanded .merchant-card__shell {
  padding: 24px;
}

.merchant-card__topline {
  display: flex;
  justify-content: flex-start;
  gap: 12px;
}

.merchant-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.merchant-card__badges span {
  padding: 5px 9px;
  border-radius: 999px;
  border: 2px solid #151515;
  background: var(--yellow);
  color: var(--ink);
  font-weight: 900;
  letter-spacing: 0;
}

.merchant-card__badges span:nth-child(2n) {
  background: var(--sky);
}

.merchant-card__badges span:nth-child(3n) {
  background: var(--lime);
}

.merchant-card h3 {
  max-width: 12em;
  margin: auto 0 0;
  color: var(--ink);
  font-size: clamp(23px, 2.6vw, 34px);
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.merchant-card__hint {
  margin: 0;
  color: #3b3b3b;
  font-size: 14px;
  font-weight: 700;
}

.merchant-card__location {
  margin: 0;
  color: #3f3f3f;
  font-size: 14px;
  font-weight: 800;
}

.merchant-card__details {
  display: grid;
  gap: 18px;
  margin-top: 6px;
  max-height: 900px;
  overflow: hidden;
}

.merchant-card__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.merchant-card__summary div {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: var(--border-strong);
  border-radius: 18px;
  background: #fff;
  box-shadow: 4px 4px 0 #151515;
}

.merchant-card__summary span {
  color: #444;
  font-size: 12px;
  font-weight: 800;
}

.merchant-card__summary strong {
  color: var(--ink);
  font-size: 24px;
  font-weight: 900;
}

.dish-preview {
  display: grid;
  gap: 12px;
}

.dish-preview__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.dish-preview__head > span {
  color: #3f3f3f;
  font-size: 12px;
  font-weight: 900;
}

.dish-preview__head small,
.empty-dishes {
  color: #4a4a4a;
  font-size: 13px;
  font-weight: 700;
}

.dish-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.dish-card {
  display: grid;
  gap: 10px;
  padding: 13px;
  border: var(--border-strong);
  border-radius: 18px;
  background: #fff;
  box-shadow: 4px 4px 0 #151515;
}

.dish-card > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dish-card strong {
  color: var(--ink);
}

.dish-card > div:first-child span {
  flex: 0 0 auto;
  color: #474747;
  font-size: 12px;
  font-weight: 700;
}

.dish-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.dish-tags small {
  padding: 6px 9px;
  border-radius: 999px;
  border: 2px solid #151515;
  background: var(--yellow);
  color: var(--ink);
  font-weight: 800;
}

.empty-dishes {
  margin: 0;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-row span {
  padding: 7px 10px;
  border-radius: 999px;
  border: 2px solid #151515;
  background: var(--sky);
  color: var(--ink);
  font-size: 13px;
  font-weight: 800;
}

.card-detail-enter-active,
.card-detail-leave-active {
  transition:
    opacity 0.56s ease 0.12s,
    transform 0.7s var(--ease-smooth) 0.08s,
    max-height 0.95s var(--ease-smooth);
}

.card-detail-leave-active {
  transition:
    opacity 0.34s ease,
    transform 0.5s var(--ease-smooth),
    max-height 0.72s var(--ease-smooth);
}

.card-detail-enter-from,
.card-detail-leave-to {
  opacity: 0;
  transform: translateY(10px);
  max-height: 0;
}

.card-detail-enter-to,
.card-detail-leave-from {
  max-height: 900px;
}

@media (max-width: 760px) {
  .merchant-card--expanded {
    grid-column: 1 / -1;
  }

  .merchant-card__summary {
    grid-template-columns: 1fr;
  }
}
</style>
