<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import TagWheel from '../components/TagWheel.vue'
import { useDiningStore } from '../composables/useDiningStore'

const WHEEL_PREF_KEY = 'wm-diet-wheel-wheel-preferences-v1'
const COOLDOWN_SECONDS = 10

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
  allIngredients,
  dishes,
  getMerchantName,
  incrementDishHeat,
  lastResult,
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

const isSpinDisabled = computed(() => {
  return cooldownLocked.value || weightedDishes.value.length === 0
})

const visibleCooldownSeconds = computed(() => {
  return cooldownLocked.value ? Math.max(1, cooldownSeconds.value) : 0
})

const speakResult = (dish) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return
  }

  const utterance = new SpeechSynthesisUtterance(
    `今天推荐 ${dish.name}，来自 ${getMerchantName(dish.merchant_id)}。`,
  )

  utterance.lang = 'zh-CN'
  utterance.rate = 0.95
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

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
  speakResult(dish)
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
            v-for="tag in allDishTags"
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
            v-for="ingredient in allIngredients"
            :key="ingredient"
            class="check-chip"
            :class="{ 'check-chip--active': selectedIngredients.includes(ingredient) }"
          >
            <input
              type="checkbox"
              :checked="selectedIngredients.includes(ingredient)"
              @change="toggleIngredient(ingredient)"
            />
            <span>{{ ingredient }}</span>
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
  display: grid;
  gap: 26px;
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

.section-heading p {
  margin: 0;
  color: #627267;
}

.wheel-search {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid #dde7df;
  border-radius: 16px;
  background: #f8fbf8;
  color: #365847;
  font-weight: 900;
  text-align: left;
}

.wheel-search input {
  width: 100%;
  border: 1px solid #cddbd1;
  border-radius: 10px;
  padding: 12px 13px;
  background: #fff;
  color: #173126;
  font: inherit;
}

.wheel-search small {
  color: #728077;
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
  gap: 12px;
  padding: 18px;
  border: 1px solid #dce7df;
  border-radius: 16px;
  background: #f8fbf8;
  text-align: left;
}

.drawer-trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #cddbd1;
  border-radius: 10px;
  padding: 13px 14px;
  background: #fff;
  color: #111414;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.drawer-trigger strong {
  color: #2d7a57;
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
  border: 1px solid #cddbd1;
  border-radius: 12px;
  padding: 9px 11px;
  background: #fff;
  color: #244d3b;
  cursor: pointer;
}

.check-chip input {
  accent-color: #111414;
}

.check-chip--active {
  border-color: #111414;
  background: #111414;
  color: #fff;
}

.history-box {
  display: grid;
  gap: 9px;
  margin-top: 10px;
  padding-top: 16px;
  border-top: 1px solid #dce7df;
}

.history-box__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.history-box h3 {
  margin: 0;
  color: #111414;
}

.history-box__top button {
  border: 0;
  background: transparent;
  color: #d94f30;
  font: inherit;
  cursor: pointer;
}

.history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border: 1px solid #dce7df;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
  color: #173126;
  text-align: left;
}

.history-item__copy {
  display: grid;
  gap: 4px;
}

.history-item__copy span,
.empty-note {
  color: #728077;
  font-size: 13px;
}

.history-item__apply {
  border: 0;
  border-radius: 10px;
  padding: 8px 12px;
  background: #111414;
  color: #fff;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.history-item__apply:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(17, 20, 20, 0.14);
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
  border-radius: 16px;
  background: #111414;
  color: #f7f5ef;
  text-align: center;
}

.confirm-panel span {
  color: #8bd9bc;
  font-size: 12px;
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
  color: #c4cec8;
}

.confirm-panel button {
  margin-top: 10px;
  border: 0;
  padding: 13px 24px;
  border-radius: 12px;
  background: #f7f5ef;
  color: #111414;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.confirm-panel--muted {
  background: #eef3ef;
  color: #173126;
}

.confirm-panel--muted p {
  color: #60746a;
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
  color: #111414;
}

.candidate-panel__head span {
  color: #627267;
}

.candidate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}

.candidate-card {
  display: grid;
  gap: 4px;
  border: 1px solid #dce7df;
  border-radius: 12px;
  padding: 14px;
  background: #fffdf7;
}

.candidate-card strong {
  color: #111414;
}

.candidate-card span,
.candidate-card p {
  margin: 0;
  color: #64766b;
  font-size: 13px;
}

@media (max-width: 980px) {
  .wheel-layout {
    grid-template-columns: 1fr;
  }
}
</style>
