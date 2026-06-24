<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TagWheel from '../components/TagWheel.vue'
import { useDiningStore } from '../composables/useDiningStore'

const WHEEL_PREF_KEY = 'wm-diet-wheel-wheel-preferences-v1'
const COOLDOWN_SECONDS = 10
const PINNED_TAGS = ['外卖', '食堂', '校外']

const readWheelPreferences = () => {
  if (typeof window === 'undefined') {
    return { selectedTags: [], selectedIngredients: [], history: [] }
  }

  try {
    return JSON.parse(window.localStorage.getItem(WHEEL_PREF_KEY)) || {
      selectedTags: [],
      selectedIngredients: [],
      history: [],
    }
  } catch (error) {
    console.warn('Wheel preference cache is broken.', error)
    return { selectedTags: [], selectedIngredients: [], history: [] }
  }
}

const {
  allDishTags,
  allDishTagOptions,
  allIngredients,
  allIngredientTagOptions,
  dishes,
  getMerchant,
  getMerchantName,
  incrementDishHeat,
  lastResult,
  loadCatalog,
} = useDiningStore()

const savedPreferences = readWheelPreferences()
const selectedTags = ref(Array.isArray(savedPreferences.selectedTags) ? savedPreferences.selectedTags : [])
const selectedIngredients = ref(
  Array.isArray(savedPreferences.selectedIngredients) ? savedPreferences.selectedIngredients : [],
)
const filterHistory = ref(Array.isArray(savedPreferences.history) ? savedPreferences.history : [])
const openedDrawer = ref('tags')
const searchQuery = ref('')
const pendingResult = ref(null)
const cooldownLocked = ref(false)
const cooldownSeconds = ref(0)
let cooldownCountdownTimer = 0
let cooldownReleaseTimer = 0

const sortTagsWithPriority = (list) => {
  return [...new Set((list || []).filter(Boolean))].sort((left, right) => {
    const leftPriority = PINNED_TAGS.indexOf(left)
    const rightPriority = PINNED_TAGS.indexOf(right)

    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) {
        return 1
      }

      if (rightPriority === -1) {
        return -1
      }

      return leftPriority - rightPriority
    }

    return String(left).localeCompare(String(right), 'zh-Hans-CN')
  })
}

const sortedDishTags = computed(() => {
  return sortTagsWithPriority(allDishTags.value).map((tag) => {
    return allDishTagOptions.value.find((item) => item.value === tag) || {
      key: `normal:${tag}`,
      value: tag,
      label: '一般tag',
    }
  })
})

const sortedIngredientTags = computed(() => {
  return sortTagsWithPriority(allIngredients.value).map((tag) => {
    return allIngredientTagOptions.value.find((item) => item.value === tag) || {
      key: `ingredient:${tag}`,
      value: tag,
      label: '食材tag',
    }
  })
})

const buildHistoryKey = (tags, ingredients) => {
  return [
    [...tags].sort().join('|') || '无Tag',
    [...ingredients].sort().join('|') || '无食材',
  ].join('::')
}

const persistWheelPreferences = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    WHEEL_PREF_KEY,
    JSON.stringify({
      selectedTags: selectedTags.value,
      selectedIngredients: selectedIngredients.value,
      history: filterHistory.value,
    }),
  )
}

const rememberCurrentCombination = () => {
  const tags = [...selectedTags.value]
  const ingredients = [...selectedIngredients.value]

  if (tags.length === 0 && ingredients.length === 0) {
    persistWheelPreferences()
    return
  }

  const key = buildHistoryKey(tags, ingredients)
  const nextItem = {
    key,
    tags,
    ingredients,
    updatedAt: new Date().toISOString(),
  }

  filterHistory.value = [
    nextItem,
    ...filterHistory.value.filter((item) => item.key !== key),
  ].slice(0, 8)

  persistWheelPreferences()
}

watch([selectedTags, selectedIngredients], rememberCurrentCombination, { deep: true })

const toggleFromList = (target, value) => {
  target.value = target.value.includes(value)
    ? target.value.filter((item) => item !== value)
    : [...target.value, value]
}

const toggleTag = (tag) => {
  toggleFromList(selectedTags, tag)
}

const toggleIngredient = (ingredient) => {
  toggleFromList(selectedIngredients, ingredient)
}

const restoreHistory = (item) => {
  selectedTags.value = [...item.tags]
  selectedIngredients.value = [...item.ingredients]
}

const clearPreferences = () => {
  selectedTags.value = []
  selectedIngredients.value = []
  searchQuery.value = ''
  filterHistory.value = []
  persistWheelPreferences()
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

const candidateDishes = computed(() => {
  return dishes.value.filter((dish) => {
    const tagMatched = selectedTags.value.length === 0
      || selectedTags.value.every((tag) => (dish.tags || []).includes(tag))

    const ingredientMatched = selectedIngredients.value.length === 0
      || selectedIngredients.value.every((ingredient) => (dish.ingredients || []).includes(ingredient))

    const searchMatched = matchesSearch([
      dish.name,
      getMerchantName(dish.merchant_id),
      ...(dish.tags || []),
      ...(dish.ingredients || []),
    ], searchQuery.value)

    return tagMatched && ingredientMatched && searchMatched
  })
})

const calculateDishWeight = (dish) => {
  const baseChance = 10
  const heatBonus = Math.sqrt(Number(dish.heat || 0)) * 2.8
  const tagCoverageBonus = (dish.tags || []).length * 0.35
  return Number((baseChance + heatBonus + tagCoverageBonus).toFixed(2))
}

const weightedDishes = computed(() => {
  const rows = candidateDishes.value.map((dish) => ({
    ...dish,
    wheelWeight: calculateDishWeight(dish),
  }))

  const total = rows.reduce((sum, dish) => sum + dish.wheelWeight, 0)

  return rows
    .map((dish) => ({
      ...dish,
      probability: total > 0 ? (dish.wheelWeight / total) * 100 : 0,
    }))
    .sort((left, right) => right.probability - left.probability)
})

const filterSummary = computed(() => {
  const tags = selectedTags.value.length ? selectedTags.value.join(' / ') : '未限定 Tag'
  const ingredients = selectedIngredients.value.length
    ? selectedIngredients.value.join(' / ')
    : '未限定食材'

  return `${tags} · ${ingredients}`
})

const spotlightDish = computed(() => {
  return pendingResult.value || lastResult.value || null
})

const spotlightMerchant = computed(() => {
  const dish = spotlightDish.value
  return dish ? getMerchant(dish.merchant_id) : null
})

const spotlightMerchantTags = computed(() => {
  if (!spotlightMerchant.value) {
    return []
  }

  return sortTagsWithPriority([
    ...(spotlightMerchant.value.scene_tags || []),
    ...(spotlightMerchant.value.custom_tags || []),
  ])
})

const spotlightMerchantDishes = computed(() => {
  const dish = spotlightDish.value
  if (!dish) {
    return []
  }

  return dishes.value
    .filter((item) => item.merchant_id === dish.merchant_id)
    .sort((left, right) => {
      if (left.id === dish.id) {
        return -1
      }

      if (right.id === dish.id) {
        return 1
      }

      return Number(right.heat || 0) - Number(left.heat || 0)
    })
    .slice(0, 6)
})

const spotlightTitle = computed(() => {
  return pendingResult.value ? '本次命中商家' : '最近一次命中商家'
})

const formatPrice = (value) => {
  const price = Number(value || 0)
  if (!Number.isFinite(price) || price <= 0) {
    return ''
  }

  return Number.isInteger(price) ? String(price) : price.toFixed(1)
}

const getDishMetaLine = (dish) => {
  const meta = [`热度 ${dish.heat || 0}`]

  if (Number(dish.price || 0) > 0) {
    meta.push(`¥${formatPrice(dish.price)}`)
  }

  if (Number(dish.calories || 0) > 0) {
    meta.push(`${dish.calories} kcal`)
  }

  return meta.join(' · ')
}

const isSpinDisabled = computed(() => {
  return cooldownLocked.value || weightedDishes.value.length === 0
})

const visibleCooldownSeconds = computed(() => {
  return cooldownLocked.value ? Math.max(1, cooldownSeconds.value) : 0
})

const vibrateResult = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([80, 40, 140, 50, 220])
  }
}

const startCooldown = () => {
  window.clearInterval(cooldownCountdownTimer)
  window.clearTimeout(cooldownReleaseTimer)

  cooldownLocked.value = true
  cooldownSeconds.value = COOLDOWN_SECONDS

  cooldownCountdownTimer = window.setInterval(() => {
    cooldownSeconds.value = Math.max(1, cooldownSeconds.value - 1)
  }, 1000)

  cooldownReleaseTimer = window.setTimeout(() => {
    cooldownLocked.value = false
    cooldownSeconds.value = 0
    pendingResult.value = null
    window.clearInterval(cooldownCountdownTimer)
  }, COOLDOWN_SECONDS * 1000)
}

const handleSpinFinished = (dish) => {
  pendingResult.value = dish
  vibrateResult()
}

const confirmResult = () => {
  const result = pendingResult.value

  if (!result || cooldownLocked.value) {
    return
  }

  pendingResult.value = null
  startCooldown()
  const updatedDish = incrementDishHeat(result.id)
  lastResult.value = updatedDish || result
}

onBeforeUnmount(() => {
  window.clearInterval(cooldownCountdownTimer)
  window.clearTimeout(cooldownReleaseTimer)
})

onMounted(() => {
  loadCatalog('wheel')
})
</script>

<template>
  <section class="wheel-page">
    <div class="section-heading">
      <p class="section-heading__eyebrow">Random Wheel · Preference Memory</p>
      <h2>轮盘抽食</h2>
      <p>
        当前组合：{{ filterSummary }}。
      </p>
    </div>

    <label class="wheel-search">
      <span>搜索菜品 / 店铺 / Tag / 食材</span>
      <input
        v-model.trim="searchQuery"
        type="search"
        placeholder="例如：牛肉、鸡胸肉、秦味、减脂"
      />
      <small>当前候选 {{ weightedDishes.length }} 道餐品</small>
    </label>

    <div class="wheel-layout">
      <aside class="filter-panel">
        <button
          type="button"
          class="drawer-trigger"
          @click="openedDrawer = openedDrawer === 'tags' ? '' : 'tags'"
        >
          <span>按 Tag 过滤</span>
          <strong>{{ selectedTags.length }} 个</strong>
        </button>
        <div v-show="openedDrawer === 'tags'" class="drawer-body">
          <label
            v-for="tag in sortedDishTags"
            :key="tag.key"
            class="check-chip"
            :class="{ 'check-chip--active': selectedTags.includes(tag.value) }"
          >
            <input
              type="checkbox"
              :checked="selectedTags.includes(tag.value)"
              @change="toggleTag(tag.value)"
            />
            <span>{{ tag.value }}</span>
            <small>{{ tag.label }}</small>
          </label>
        </div>

        <button
          type="button"
          class="drawer-trigger"
          @click="openedDrawer = openedDrawer === 'ingredients' ? '' : 'ingredients'"
        >
          <span>按食材过滤</span>
          <strong>{{ selectedIngredients.length }} 个</strong>
        </button>
        <div v-show="openedDrawer === 'ingredients'" class="drawer-body">
          <label
            v-for="ingredient in sortedIngredientTags"
            :key="ingredient.key"
            class="check-chip"
            :class="{ 'check-chip--active': selectedIngredients.includes(ingredient.value) }"
          >
            <input
              type="checkbox"
              :checked="selectedIngredients.includes(ingredient.value)"
              @change="toggleIngredient(ingredient.value)"
            />
            <span>{{ ingredient.value }}</span>
            <small>{{ ingredient.label }}</small>
          </label>
        </div>

        <section class="history-box">
          <div class="history-box__top">
            <h3>筛选历史</h3>
            <button type="button" @click="clearPreferences">清空</button>
          </div>

          <article
            v-for="item in filterHistory"
            :key="item.key"
            class="history-item"
          >
            <div class="history-item__copy">
            <strong>{{ item.tags.length ? item.tags.join(' / ') : '无 Tag' }}</strong>
            <span>{{ item.ingredients.length ? item.ingredients.join(' / ') : '无食材' }}</span>
            </div>
            <button
              type="button"
              class="history-item__apply"
              @click="restoreHistory(item)"
            >
              应用
            </button>
          </article>

          <p v-if="filterHistory.length === 0" class="empty-note">
            勾选 Tag 或食材后，这里会自动记录你的个性化组合。
          </p>
        </section>
      </aside>

      <main class="wheel-main">
        <TagWheel
          :items="weightedDishes"
          :disabled="isSpinDisabled"
          :cooldown-seconds="visibleCooldownSeconds"
          @spin-start="pendingResult = null"
          @spin-finished="handleSpinFinished"
        />

        <div class="confirm-stack">
          <div v-if="cooldownLocked" class="confirm-panel confirm-panel--muted">
            <span>冷却保护</span>
            <strong>{{ visibleCooldownSeconds }} 秒后可再次转盘</strong>
            <p>这个节流保护可以防止连续刷热度，让公共热度更可信。</p>
          </div>

          <div v-else-if="pendingResult" class="confirm-panel">
            <span>箭头已定格</span>
            <strong>{{ pendingResult.name }}</strong>
            <p>
              来自 {{ getMerchantName(pendingResult.merchant_id) }}。点击“就它了”后，该餐品热度 +1，并进入 10 秒冷却。
            </p>
            <button type="button" @click="confirmResult">就它了</button>
          </div>

          <div v-else-if="lastResult" class="confirm-panel confirm-panel--muted">
            <span>上次确认</span>
            <strong>{{ lastResult.name }}</strong>
            <p>{{ getMerchantName(lastResult.merchant_id) }} · 当前热度 {{ lastResult.heat }}</p>
          </div>
        </div>

        <transition name="merchant-spotlight">
          <section
            v-if="spotlightMerchant && spotlightDish"
            class="merchant-spotlight"
          >
            <div class="merchant-spotlight__head">
              <div>
                <span>{{ spotlightTitle }}</span>
                <h3>{{ spotlightMerchant.name }}</h3>
              </div>
              <strong>{{ spotlightDish.name }}</strong>
            </div>

            <p class="merchant-spotlight__location">
              {{ spotlightMerchant.zone }}
            </p>

            <div v-if="spotlightMerchantTags.length" class="merchant-spotlight__tags">
              <small
                v-for="tag in spotlightMerchantTags"
                :key="`${spotlightMerchant.id}-${tag}`"
              >
                {{ tag }}
              </small>
            </div>

            <div class="merchant-spotlight__dishes">
              <article
                v-for="dish in spotlightMerchantDishes"
                :key="dish.id"
                class="merchant-spotlight__dish"
                :class="{ 'merchant-spotlight__dish--active': dish.id === spotlightDish.id }"
              >
                <div>
                  <strong>{{ dish.name }}</strong>
                  <span>{{ dish.id === spotlightDish.id ? '本次抽中' : '同店菜品' }}</span>
                </div>
                <p>{{ getDishMetaLine(dish) }}</p>
              </article>
            </div>

            <p v-if="spotlightMerchantDishes.length === 1" class="merchant-spotlight__empty">
              这个商家目前只录入了这一道菜，后面还可以继续补充更多菜品。
            </p>
          </section>
        </transition>
      </main>
    </div>

    <section class="candidate-panel">
      <div class="candidate-panel__head">
        <h3>当前候选池</h3>
        <span>{{ weightedDishes.length }} 道餐品</span>
      </div>

      <div class="candidate-grid">
        <article v-for="dish in weightedDishes" :key="dish.id" class="candidate-card">
          <strong>{{ dish.name }}</strong>
          <span>{{ getMerchantName(dish.merchant_id) }}</span>
          <p>热度 {{ dish.heat }} · 抽中概率 {{ dish.probability.toFixed(1) }}%</p>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.wheel-page {
  position: relative;
  display: grid;
  gap: 26px;
}

.wheel-page::before,
.wheel-page::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.wheel-page::before {
  top: 0.6rem;
  right: 1.8rem;
  width: 94px;
  height: 94px;
  border: var(--border-strong);
  border-radius: 28px;
  background:
    linear-gradient(135deg, transparent 0 38%, #151515 38% 44%, transparent 44% 56%, #151515 56% 62%, transparent 62% 100%),
    var(--pink);
  box-shadow: var(--shadow-sticker);
  transform: rotate(14deg);
  animation: driftTilt 8s ease-in-out infinite;
}

.wheel-page::after {
  right: 1.6rem;
  bottom: 12rem;
  width: 118px;
  height: 24px;
  border: var(--border-strong);
  border-radius: 999px;
  background:
    repeating-linear-gradient(90deg, #151515 0 8px, transparent 8px 18px),
    var(--yellow);
  box-shadow: var(--shadow-sticker);
  animation: wiggleLine 5s ease-in-out infinite;
}

.section-heading {
  text-align: left;
}

.section-heading__eyebrow {
  display: inline-block;
  margin: 0 0 14px;
  padding: 8px 12px;
  border: var(--border-strong);
  border-radius: 999px;
  background: var(--sky);
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
  font-size: clamp(34px, 5vw, 64px);
  letter-spacing: -0.06em;
  text-shadow: 3px 3px 0 var(--paper), 6px 6px 0 var(--yellow);
}

.section-heading p {
  margin: 0;
  color: #373737;
  font-weight: 700;
}

.wheel-search {
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
  text-align: left;
  box-shadow: var(--shadow-sticker);
}

.wheel-search input {
  width: 100%;
  border: var(--border-strong);
  border-radius: 16px;
  padding: 12px 13px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  box-shadow: 4px 4px 0 #151515;
}

.wheel-search small {
  color: #414141;
  font-weight: 700;
}

.wheel-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.72fr) minmax(360px, 1.28fr);
  gap: 24px;
  align-items: start;
}

.filter-panel {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: var(--border-strong);
  border-radius: 28px;
  background:
    radial-gradient(circle, rgba(21, 21, 21, 0.14) 0 2px, transparent 2px) 0 0 / 18px 18px,
    var(--paper-alt);
  text-align: left;
  box-shadow: var(--shadow-sticker);
}

.drawer-trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: var(--border-strong);
  border-radius: 18px;
  padding: 13px 14px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 4px 4px 0 #151515;
}

.drawer-trigger strong {
  color: var(--red);
}

.drawer-body {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  padding: 8px 0 4px;
}

.check-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: var(--border-strong);
  border-radius: 999px;
  padding: 9px 11px;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  box-shadow: 3px 3px 0 #151515;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.check-chip input {
  accent-color: var(--ink);
}

.check-chip:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #151515;
}

.check-chip small {
  color: #4e4e4e;
  font-size: 11px;
  font-weight: 800;
}

.check-chip--active {
  background: var(--lime);
}

.history-box {
  display: grid;
  gap: 9px;
  margin-top: 10px;
  padding-top: 16px;
  border-top: 3px dashed #151515;
}

.history-box__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.history-box h3 {
  margin: 0;
  color: var(--ink);
}

.history-box__top button {
  border: var(--border-strong);
  border-radius: 14px;
  padding: 8px 12px;
  background: var(--pink);
  color: var(--ink);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 4px 4px 0 #151515;
}

.history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border: var(--border-strong);
  border-radius: 18px;
  padding: 10px 12px;
  background: #fff;
  color: var(--ink);
  text-align: left;
  box-shadow: 4px 4px 0 #151515;
}

.history-item__copy {
  display: grid;
  gap: 4px;
}

.history-item__copy span,
.empty-note {
  color: #424242;
  font-size: 13px;
  font-weight: 700;
}

.history-item__apply {
  border: var(--border-strong);
  border-radius: 14px;
  padding: 8px 12px;
  background: var(--yellow);
  color: var(--ink);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 4px 4px 0 #151515;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.history-item__apply:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #151515;
  background: var(--sky);
}

.empty-note {
  margin: 0;
}

.wheel-main {
  display: grid;
  justify-items: center;
  gap: 18px;
}

.confirm-stack {
  width: min(560px, 100%);
}

.confirm-panel {
  width: 100%;
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 20px;
  border: var(--border-strong);
  border-radius: 24px;
  background: var(--paper);
  color: var(--ink);
  text-align: center;
  box-shadow: var(--shadow-sticker);
}

.confirm-panel span {
  color: var(--red);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.confirm-panel strong {
  font-size: clamp(28px, 4vw, 44px);
  letter-spacing: -0.06em;
}

.confirm-panel p {
  max-width: 440px;
  margin: 0;
  color: #3f3f3f;
  font-weight: 700;
}

.confirm-panel button {
  margin-top: 10px;
  border: var(--border-strong);
  padding: 13px 24px;
  border-radius: 18px;
  background: var(--pink);
  color: var(--ink);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 4px 4px 0 #151515;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.confirm-panel button:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #151515;
  background: var(--yellow);
}

.confirm-panel--muted {
  background: #eefbff;
  color: var(--ink);
}

.confirm-panel--muted p {
  color: #414141;
}

.merchant-spotlight {
  width: min(760px, 100%);
  display: grid;
  gap: 14px;
  padding: 22px;
  border: var(--border-strong);
  border-radius: 28px;
  background:
    linear-gradient(135deg, transparent 0 28%, rgba(21, 21, 21, 0.08) 28% 32%, transparent 32% 100%),
    #fffef0;
  color: var(--ink);
  text-align: left;
  box-shadow: var(--shadow-sticker);
}

.merchant-spotlight__head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}

.merchant-spotlight__head span {
  display: block;
  color: var(--red);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.merchant-spotlight__head h3 {
  margin: 6px 0 0;
  font-size: clamp(26px, 4vw, 36px);
  letter-spacing: -0.05em;
}

.merchant-spotlight__head > strong {
  flex: 0 0 auto;
  padding: 10px 14px;
  border: var(--border-strong);
  border-radius: 18px;
  background: var(--lime);
  font-size: 15px;
  box-shadow: 4px 4px 0 #151515;
}

.merchant-spotlight__location,
.merchant-spotlight__empty {
  margin: 0;
  color: #424242;
  font-weight: 700;
}

.merchant-spotlight__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.merchant-spotlight__tags small {
  padding: 6px 10px;
  border: 2px solid #151515;
  border-radius: 999px;
  background: var(--sky);
  color: var(--ink);
  font-size: 12px;
  font-weight: 900;
}

.merchant-spotlight__dishes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.merchant-spotlight__dish {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: var(--border-strong);
  border-radius: 20px;
  background: #fff;
  box-shadow: 4px 4px 0 #151515;
}

.merchant-spotlight__dish--active {
  background: #f4ffe9;
}

.merchant-spotlight__dish > div {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
}

.merchant-spotlight__dish strong {
  color: var(--ink);
}

.merchant-spotlight__dish span,
.merchant-spotlight__dish p {
  margin: 0;
  color: #454545;
  font-size: 12px;
  font-weight: 700;
}

.merchant-spotlight-enter-active,
.merchant-spotlight-leave-active {
  transition: opacity 0.26s ease, transform 0.32s ease;
}

.merchant-spotlight-enter-from,
.merchant-spotlight-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

.candidate-panel {
  display: grid;
  gap: 14px;
  padding-top: 6px;
  text-align: left;
}

.candidate-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.candidate-panel h3 {
  margin: 0;
  color: var(--ink);
}

.candidate-panel__head span {
  color: #414141;
  font-weight: 700;
}

.candidate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}

.candidate-card {
  display: grid;
  gap: 4px;
  border: var(--border-strong);
  border-radius: 18px;
  padding: 14px;
  background: #fff;
  box-shadow: 4px 4px 0 #151515;
}

.candidate-card:nth-child(4n + 1) {
  background: #fff5fb;
}

.candidate-card:nth-child(4n + 2) {
  background: #fffbe2;
}

.candidate-card:nth-child(4n + 3) {
  background: #eefbff;
}

.candidate-card:nth-child(4n + 4) {
  background: #f5ffe7;
}

.candidate-card strong {
  color: var(--ink);
}

.candidate-card span,
.candidate-card p {
  margin: 0;
  color: #404040;
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 980px) {
  .wheel-layout {
    grid-template-columns: 1fr;
  }

  .merchant-spotlight__head {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
