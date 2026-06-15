<script setup>
const props = defineProps({
  currentView: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['menu-change'])

const menus = [
  { key: 'home', label: '返回主页' },
  { key: 'dashboard', label: '周边推荐' },
  { key: 'wheel', label: '轮盘抽签' },
  { key: 'manage', label: '新增tag' },
]

const changeMenu = (nextView) => {
  emit('menu-change', nextView)
}
</script>

<template>
  <nav class="module-nav" aria-label="导航">
    <button
      v-for="menu in menus"
      :key="menu.key"
      type="button"
      class="module-nav__button"
      :class="{ 'module-nav__button--active': props.currentView === menu.key }"
      @click="changeMenu(menu.key)"
    >
      {{ menu.label }}
    </button>
  </nav>
</template>

<style scoped>
.module-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.module-nav__button {
  border: 1px solid #c8d8cc;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  color: #234435;
  padding: 11px 16px;
  font: inherit;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.module-nav__button:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(31, 66, 50, 0.1);
}

.module-nav__button--active {
  border-color: #111414;
  background: #111414;
  color: #fff;
}

@media (max-width: 640px) {
  .module-nav__button {
    width: 100%;
  }
}
</style>
