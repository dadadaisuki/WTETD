<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import FeedbackBar from '../components/FeedbackBar.vue'
import { useDiningStore } from '../composables/useDiningStore'

const {
  addDish,
  addMerchant,
  addMerchantTag,
  dishes,
  getMerchantName,
  loadCatalog,
  merchants,
  syncMessage,
} = useDiningStore()

const merchantForm = reactive({
  name: '',
  zone: '',
  sceneTagInput: '',
  customTagInput: '',
  sceneTags: ['校外'],
  customTags: [],
})

const form = reactive({
  name: '',
  calories: '',
  price: '',
  merchantId: 'merchant-qin-noodle',
  tagInput: '',
  ingredientInput: '',
  newTagIsIngredient: false,
  tags: [],
  ingredients: [],
})

const tagFeedback = ref({
  type: 'info',
  message: '餐品 Tag 与食材会先在本地即时生效',
})
const formFeedback = ref({ type: 'info', message: '' })
const merchantCreateFeedback = ref({
  type: 'info',
  message: '新增店铺',
})
const merchantTagInput = ref('')
const activeMerchantId = ref('merchant-qin-noodle')
const merchantFeedback = ref({ type: 'info', message: '' })

const activeMerchant = computed(() => {
  return merchants.value.find((merchant) => merchant.id === activeMerchantId.value)
})

watch(merchants, () => {
  if (!merchants.value.some((merchant) => merchant.id === form.merchantId)) {
    form.merchantId = merchants.value[0]?.id || ''
  }

  if (!merchants.value.some((merchant) => merchant.id === activeMerchantId.value)) {
    activeMerchantId.value = merchants.value[0]?.id || ''
  }
}, { immediate: true })

const getFormTagPool = () => {
  return [...form.tags, ...form.ingredients]
}

const validateTag = (value, existingList = []) => {
  const tag = String(value || '').trim()

  if (!tag) {
    return { ok: false, message: 'Tag 不能为空，也不能只输入空格。' }
  }

  if (tag.length > 12) {
    return { ok: false, message: 'Tag 太长了，请控制在 12 个字符以内。' }
  }

  if (existingList.includes(tag)) {
    return { ok: false, message: `“${tag}” 已经存在，不需要重复添加。` }
  }

  return { ok: true, tag }
}

const normalizeCompareText = (value) => String(value || '').trim().toLowerCase()

const hasDuplicateMerchantName = (name) => {
  return merchants.value.some((merchant) => {
    return normalizeCompareText(merchant.name) === normalizeCompareText(name)
  })
}

const hasDuplicateDishNameInMerchant = (merchantId, name) => {
  return dishes.value.some((dish) => {
    return dish.merchant_id === merchantId
      && normalizeCompareText(dish.name) === normalizeCompareText(name)
  })
}

const addMerchantSceneTag = () => {
  const result = validateTag(merchantForm.sceneTagInput, merchantForm.sceneTags)
  if (!result.ok) {
    merchantCreateFeedback.value = { type: 'error', message: result.message }
    return
  }

  merchantForm.sceneTags.push(result.tag)
  merchantForm.sceneTagInput = ''
  merchantCreateFeedback.value = { type: 'success', message: `已加入店铺场景 Tag：${result.tag}` }
}

const addMerchantCustomTag = () => {
  const result = validateTag(merchantForm.customTagInput, merchantForm.customTags)
  if (!result.ok) {
    merchantCreateFeedback.value = { type: 'error', message: result.message }
    return
  }

  merchantForm.customTags.push(result.tag)
  merchantForm.customTagInput = ''
  merchantCreateFeedback.value = { type: 'success', message: `已加入店铺协同 Tag：${result.tag}` }
}

const removeMerchantSceneTag = (tag) => {
  merchantForm.sceneTags = merchantForm.sceneTags.filter((item) => item !== tag)
}

const removeMerchantCustomTag = (tag) => {
  merchantForm.customTags = merchantForm.customTags.filter((item) => item !== tag)
}

const addFormTag = () => {
  const result = validateTag(form.tagInput, getFormTagPool())
  if (!result.ok) {
    tagFeedback.value = { type: 'error', message: result.message }
    return
  }

  if (form.newTagIsIngredient) {
    form.ingredients.push(result.tag)
    tagFeedback.value = { type: 'success', message: `已加入食材：${result.tag}` }
  } else {
    form.tags.push(result.tag)
    tagFeedback.value = { type: 'success', message: `已加入餐品 Tag：${result.tag}` }
  }

  form.tagInput = ''
}

const addFormIngredient = () => {
  const result = validateTag(form.ingredientInput, getFormTagPool())
  if (!result.ok) {
    tagFeedback.value = { type: 'error', message: result.message }
    return
  }

  form.ingredients.push(result.tag)
  form.ingredientInput = ''
  tagFeedback.value = { type: 'success', message: `已加入食材：${result.tag}` }
}

const removeFormTag = (tag) => {
  form.tags = form.tags.filter((item) => item !== tag)
}

const removeFormIngredient = (ingredient) => {
  form.ingredients = form.ingredients.filter((item) => item !== ingredient)
}

const addCollaborativeTag = () => {
  const currentTags = activeMerchant.value?.custom_tags || []
  const result = validateTag(merchantTagInput.value, currentTags)

  if (!result.ok) {
    merchantFeedback.value = { type: 'error', message: result.message }
    return
  }

  addMerchantTag(activeMerchantId.value, result.tag)
  merchantTagInput.value = ''
  merchantFeedback.value = {
    type: 'success',
    message: `已为 ${getMerchantName(activeMerchantId.value)} 注入协同 Tag：${result.tag}`,
  }
}

const validateMerchantForm = () => {
  const name = merchantForm.name.trim()
  const zone = merchantForm.zone.trim()

  if (!name) {
    return '店铺名称不能为空。'
  }

  if (name.length > 20) {
    return '店铺名称过长，请控制在 20 个字符以内。'
  }

  if (hasDuplicateMerchantName(name)) {
    return '该店铺已存在，请勿重复添加。'
  }

  if (zone.length > 28) {
    return '店铺位置说明过长，请控制在 28 个字符以内。'
  }

  if (merchantForm.sceneTags.length === 0 && merchantForm.customTags.length === 0) {
    return '请至少给店铺添加 1 个 Tag，方便后续搜索和筛选。'
  }

  return ''
}

const submitMerchant = () => {
  const error = validateMerchantForm()
  if (error) {
    merchantCreateFeedback.value = { type: 'error', message: error }
    return
  }

  try {
    const merchant = addMerchant({
      name: merchantForm.name,
      zone: merchantForm.zone || '手动新增店铺',
      scene_tags: merchantForm.sceneTags,
      custom_tags: merchantForm.customTags,
    })

    merchantForm.name = ''
    merchantForm.zone = ''
    merchantForm.sceneTagInput = ''
    merchantForm.customTagInput = ''
    merchantForm.sceneTags = ['校外']
    merchantForm.customTags = []
    form.merchantId = merchant.id
    activeMerchantId.value = merchant.id
    merchantCreateFeedback.value = {
      type: 'success',
      message: `已新增店铺：${merchant.name}。现在可以继续为它添加菜品。`,
    }
  } catch (submitError) {
    merchantCreateFeedback.value = {
      type: 'error',
      message: submitError instanceof Error ? submitError.message : '新增店铺失败，请稍后重试。',
    }
  }
}

const validateForm = () => {
  const name = form.name.trim()
  const hasCalories = String(form.calories).trim() !== ''
  const calories = Number(form.calories)
  const price = Number(form.price)

  if (!name) {
    return '餐品名称不能为空。'
  }

  if (name.length > 18) {
    return '餐品名称过长，请控制在 18 个字符以内。'
  }

  if (!form.merchantId) {
    return '请选择餐品所属档口。'
  }

  if (hasDuplicateDishNameInMerchant(form.merchantId, name)) {
    return '该店铺下已存在同名菜品，请勿重复添加。'
  }

  if (hasCalories && (!Number.isFinite(calories) || calories <= 0 || calories > 2500)) {
    return '热量必须是 1 到 2500 之间的数字。'
  }

  if (!Number.isFinite(price) || price <= 0 || price > 200) {
    return '价格必须是 1 到 200 之间的数字。'
  }

  if (form.tags.length === 0) {
    return '请至少添加 1 个餐品 Tag。'
  }

  if (form.ingredients.length === 0) {
    return '请至少添加 1 个食材。'
  }

  return ''
}

const submitDish = () => {
  const error = validateForm()
  const hasCalories = String(form.calories).trim() !== ''
  if (error) {
    formFeedback.value = { type: 'error', message: error }
    return
  }

  try {
    const dish = addDish({
      merchant_id: form.merchantId,
      name: form.name,
      calories: hasCalories ? form.calories : 0,
      price: form.price,
      tags: form.tags,
      ingredients: form.ingredients,
    })

    form.name = ''
    form.calories = ''
    form.price = ''
    form.tagInput = ''
    form.ingredientInput = ''
    form.newTagIsIngredient = false
    form.tags = []
    form.ingredients = []
    formFeedback.value = { type: 'success', message: `已录入餐品：${dish.name}` }
  } catch (submitError) {
    formFeedback.value = {
      type: 'error',
      message: submitError instanceof Error ? submitError.message : '新增菜品失败，请稍后重试。',
    }
  }
}

onMounted(() => {
  loadCatalog('manage')
})
</script>

<template>
  <section class="manage-page">
    <div class="section-heading">
      <p class="section-heading__eyebrow">Collaborative Tagging · Defensive Form</p>
      <h2>新增tag</h2>
      <p>
        为你喜欢的菜品，商铺设置筛选条件，让大家更好选中
      </p>
    </div>

    <div class="manage-layout">
      <form class="form-card" @submit.prevent="submitMerchant">
        <h3>新增店铺</h3>

        <label>
          店铺名称
          <input v-model.trim="merchantForm.name" type="text" placeholder="例：小碗菜" />
        </label>

        <label>
          位置说明
          <input v-model.trim="merchantForm.zone" type="text" placeholder="例如：北门左转 / 大食堂1楼" />
        </label>

        <div class="inline-input">
          <label>
            店铺场景 Tag
            <input v-model.trim="merchantForm.sceneTagInput" type="text" placeholder="必填：至少填入食堂/校外/外卖" />
          </label>
          <button type="button" @click="addMerchantSceneTag">添加场景</button>
        </div>

        <div class="inline-input">
          <label>
            店铺特色 Tag
            <input v-model.trim="merchantForm.customTagInput" type="text" placeholder="例：出餐快/性价比" />
          </label>
          <button type="button" @click="addMerchantCustomTag">添加 Tag</button>
        </div>

        <div class="tag-preview">
          <button
            v-for="tag in merchantForm.sceneTags"
            :key="`merchant-scene-${tag}`"
            type="button"
            @click="removeMerchantSceneTag(tag)"
          >
            {{ tag }} ×
          </button>
          <button
            v-for="tag in merchantForm.customTags"
            :key="`merchant-custom-${tag}`"
            type="button"
            @click="removeMerchantCustomTag(tag)"
          >
            {{ tag }} ×
          </button>
        </div>

        <button type="submit" class="primary-button">保存店铺并同步</button>
        <FeedbackBar :type="merchantCreateFeedback.type" :message="merchantCreateFeedback.message" />
      </form>

      <form class="form-card" @submit.prevent="submitDish">
        <h3>新增餐品</h3>

        <label>
          餐品名称
          <input v-model.trim="form.name" type="text" placeholder="例如：番茄牛肉拉面" />
        </label>

        <label>
          先选择所属店铺
          <select v-model="form.merchantId">
            <option
              v-for="merchant in merchants"
              :key="merchant.id"
              :value="merchant.id"
            >
              {{ merchant.name }} · {{ merchant.zone }}
            </option>
          </select>
        </label>

        <div class="field-grid">
          <label>
            热量 kcal
            <input v-model.trim="form.calories" type="number" min="1" max="2500" placeholder="选填，可通过小程序拍照计算" />
          </label>
          <label>
            价格 RMB
            <input v-model.trim="form.price" type="number" min="1" max="200" step="0.1" placeholder="18" />
          </label>
        </div>

        <div class="inline-input">
          <label>
            餐品 Tag
            <input v-model.trim="form.tagInput" type="text" placeholder="减脂 / 面食 / 高性价比" />
          </label>
          <button type="button" @click="addFormTag">添加 Tag</button>
        </div>

        <label class="inline-checkbox">
          <input v-model="form.newTagIsIngredient" type="checkbox" />
          <span>这个新增 Tag 归类为食材 tag</span>
        </label>

        <div class="inline-input">
          <label>
            食材
            <input v-model.trim="form.ingredientInput" type="text" placeholder="牛肉 / 胡萝卜 / 米饭" />
          </label>
          <button type="button" @click="addFormIngredient">添加食材</button>
        </div>

        <p class="tag-tips" :class="`tag-tips--${tagFeedback.type}`">
          tips：{{ tagFeedback.message }}
        </p>

        <div class="tag-preview">
          <button
            v-for="tag in form.tags"
            :key="`tag-${tag}`"
            type="button"
            @click="removeFormTag(tag)"
          >
            {{ tag }} ×
          </button>
          <button
            v-for="ingredient in form.ingredients"
            :key="`ingredient-${ingredient}`"
            type="button"
            @click="removeFormIngredient(ingredient)"
          >
            {{ ingredient }} ×
          </button>
        </div>

        <button type="submit" class="primary-button">保存餐品并同步</button>
        <FeedbackBar :type="formFeedback.type" :message="formFeedback.message" />
      </form>

      <section class="form-card">
        <h3>公共档口协同 Tag</h3>
        <label>
          选择档口
          <select v-model="activeMerchantId">
            <option
              v-for="merchant in merchants"
              :key="merchant.id"
              :value="merchant.id"
            >
              {{ merchant.name }}
            </option>
          </select>
        </label>

        <div class="inline-input">
          <label>
            新协同 Tag
            <input v-model.trim="merchantTagInput" type="text" placeholder="例如：下课冲 / 少油可备注" />
          </label>
          <button type="button" @click="addCollaborativeTag">注入云端 Tag</button>
        </div>

        <FeedbackBar :type="merchantFeedback.type" :message="merchantFeedback.message" />

        <div v-if="activeMerchant" class="merchant-summary">
          <strong>{{ activeMerchant.name }}</strong>
          <p>{{ activeMerchant.zone }} · 热度 {{ activeMerchant.heat }}</p>
          <div class="tag-preview">
            <span
              v-for="tag in [...(activeMerchant.scene_tags || []), ...(activeMerchant.custom_tags || [])]"
              :key="tag"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <FeedbackBar type="info" :message="syncMessage" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.manage-page {
  position: relative;
  display: grid;
  gap: 24px;
}

.manage-page::before,
.manage-page::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.manage-page::before {
  top: 0.8rem;
  right: 1.8rem;
  width: 104px;
  height: 104px;
  border: var(--border-strong);
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 15px 15px,
    var(--lime);
  box-shadow: var(--shadow-sticker);
  animation: floatSticker 7s ease-in-out infinite;
}

.manage-page::after {
  right: 1.4rem;
  bottom: 2.4rem;
  width: 108px;
  height: 24px;
  border: var(--border-strong);
  border-radius: 999px;
  background:
    repeating-linear-gradient(90deg, #151515 0 8px, transparent 8px 18px),
    var(--sky);
  box-shadow: var(--shadow-sticker);
  animation: wiggleLine 5.2s ease-in-out infinite;
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
  background: var(--pink);
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
  text-shadow: 3px 3px 0 var(--paper), 6px 6px 0 var(--sky);
}

.section-heading p {
  margin: 0;
  color: #3b3b3b;
  font-weight: 700;
}

.manage-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
  gap: 22px;
  align-items: start;
}

.form-card {
  display: grid;
  gap: 16px;
  padding: 22px;
  border: var(--border-strong);
  border-radius: 28px;
  background: var(--paper);
  text-align: left;
  box-shadow: var(--shadow-sticker);
  position: relative;
  overflow: hidden;
}

.form-card::before {
  content: "";
  position: absolute;
  top: 18px;
  right: 18px;
  width: 62px;
  height: 62px;
  border: var(--border-strong);
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 12px 12px,
    rgba(255, 255, 255, 0.74);
  pointer-events: none;
  animation: pulseDots 4.8s ease-in-out infinite;
}

.form-card:nth-child(1) {
  background: #fff5fb;
}

.form-card:nth-child(2) {
  background: #fffbe2;
}

.form-card:nth-child(3) {
  background: #eefbff;
}

.form-card h3 {
  margin: 0;
  color: var(--ink);
  font-size: 24px;
  letter-spacing: -0.04em;
}

label {
  display: grid;
  gap: 8px;
  color: #313131;
  font-weight: 800;
}

input,
select {
  width: 100%;
  box-sizing: border-box;
  border: var(--border-strong);
  border-radius: 16px;
  padding: 12px 13px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  box-shadow: 4px 4px 0 #151515;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.inline-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
}

.inline-checkbox input {
  width: 18px;
  height: 18px;
  margin: 0;
  box-shadow: none;
}

.inline-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.inline-input button,
.primary-button {
  border: var(--border-strong);
  border-radius: 18px;
  padding: 12px 16px;
  background: var(--yellow);
  color: var(--ink);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 4px 4px 0 #151515;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.primary-button {
  margin-top: 4px;
}

.inline-input button:hover,
.primary-button:hover {
  transform: translate(-2px, -2px);
  box-shadow: 7px 7px 0 #151515;
  background: var(--lime);
}

.tag-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-tips {
  margin: -4px 0 0;
  color: #404040;
  font-size: 12px;
  font-weight: 700;
}

.tag-tips--error {
  color: #b42318;
}

.tag-tips--success {
  color: #157347;
}

.tag-preview span,
.tag-preview button {
  border: var(--border-strong);
  border-radius: 999px;
  padding: 7px 10px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  box-shadow: 3px 3px 0 #151515;
}

.tag-preview button {
  cursor: pointer;
}

.merchant-summary {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: var(--border-strong);
  border-radius: 20px;
  background: #fff;
  box-shadow: 4px 4px 0 #151515;
}

.merchant-summary strong {
  color: var(--ink);
  font-size: 22px;
}

.merchant-summary p {
  margin: 0;
  color: #3d3d3d;
  font-weight: 700;
}

@media (max-width: 820px) {
  .manage-layout,
  .field-grid,
  .inline-input {
    grid-template-columns: 1fr;
  }
}
</style>
