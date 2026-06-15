<script setup>
import { computed, reactive, ref, watch } from 'vue'
import FeedbackBar from '../components/FeedbackBar.vue'
import { useDiningStore } from '../composables/useDiningStore'

const {
  addDish,
  addMerchant,
  addMerchantTag,
  getMerchantName,
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
  const result = validateTag(form.tagInput, form.tags)
  if (!result.ok) {
    tagFeedback.value = { type: 'error', message: result.message }
    return
  }

  form.tags.push(result.tag)
  form.tagInput = ''
  tagFeedback.value = { type: 'success', message: `已加入餐品 Tag：${result.tag}` }
}

const addFormIngredient = () => {
  const result = validateTag(form.ingredientInput, form.ingredients)
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
}

const validateForm = () => {
  const name = form.name.trim()
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

  if (!Number.isFinite(calories) || calories <= 0 || calories > 2500) {
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
  if (error) {
    formFeedback.value = { type: 'error', message: error }
    return
  }

  const dish = addDish({
    merchant_id: form.merchantId,
    name: form.name,
    calories: form.calories,
    price: form.price,
    tags: form.tags,
    ingredients: form.ingredients,
  })

  form.name = ''
  form.calories = ''
  form.price = ''
  form.tagInput = ''
  form.ingredientInput = ''
  form.tags = []
  form.ingredients = []
  formFeedback.value = { type: 'success', message: `已录入餐品：${dish.name}` }
}
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
          <input v-model.trim="merchantForm.name" type="text" placeholder="" />
        </label>

        <label>
          位置说明
          <input v-model.trim="merchantForm.zone" type="text" placeholder="例如：北门左转 / 弘德苑一楼" />
        </label>

        <div class="inline-input">
          <label>
            店铺场景 Tag
            <input v-model.trim="merchantForm.sceneTagInput" type="text" placeholder="例:面/自选/少油" />
          </label>
          <button type="button" @click="addMerchantSceneTag">添加场景</button>
        </div>

        <div class="inline-input">
          <label>
            店铺协同 Tag
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
            <input v-model.trim="form.calories" type="number" min="1" max="2500" placeholder="420" />
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

        <div class="inline-input">
          <label>
            食材
            <input v-model.trim="form.ingredientInput" type="text" placeholder="牛肉 / 胡萝卜 / 米饭" />
          </label>
          <button type="button" @click="addFormIngredient">添加食材</button>
        </div>

        <FeedbackBar :type="tagFeedback.type" :message="tagFeedback.message" />

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

.section-heading p {
  margin: 0;
  color: #627267;
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
  border: 1px solid #dce9df;
  border-radius: 16px;
  background: #f8fbf8;
  text-align: left;
}

.form-card h3 {
  margin: 0;
  color: #111414;
}

label {
  display: grid;
  gap: 8px;
  color: #365847;
  font-weight: 800;
}

input,
select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cddbd1;
  border-radius: 10px;
  padding: 12px 13px;
  background: #fff;
  color: #173126;
  font: inherit;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.inline-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.inline-input button,
.primary-button {
  border: 0;
  border-radius: 12px;
  padding: 12px 16px;
  background: #111414;
  color: #fff;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.primary-button {
  margin-top: 4px;
}

.tag-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-preview span,
.tag-preview button {
  border: 0;
  border-radius: 12px;
  padding: 7px 10px;
  background: #eaf5ee;
  color: #315c47;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
}

.tag-preview button {
  cursor: pointer;
}

.merchant-summary {
  display: grid;
  gap: 10px;
  padding: 18px;
  border-radius: 14px;
  background: #fff;
}

.merchant-summary strong {
  color: #173126;
  font-size: 22px;
}

.merchant-summary p {
  margin: 0;
  color: #60766b;
}

@media (max-width: 820px) {
  .manage-layout,
  .field-grid,
  .inline-input {
    grid-template-columns: 1fr;
  }
}
</style>
