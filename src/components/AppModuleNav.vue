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
  gap: 14px;
  margin-top: 20px;
}

.module-nav__button {
  border: var(--border-strong);
  border-radius: 18px;
  background: var(--paper);
  color: var(--ink);
  padding: 12px 18px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 4px 4px 0 #151515;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.module-nav__button:nth-child(4n + 1) {
  background: var(--sky);
}

.module-nav__button:nth-child(4n + 2) {
  background: var(--yellow);
}

.module-nav__button:nth-child(4n + 3) {
  background: var(--pink);
}

.module-nav__button:nth-child(4n + 4) {
  background: var(--lime);
}

.module-nav__button:hover {
  transform: translate(-2px, -2px) rotate(-1deg);
  box-shadow: 7px 7px 0 #151515;
}

.module-nav__button--active {
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 16px 16px,
    var(--orange);
  transform: translate(-2px, -2px) rotate(-1deg);
  box-shadow: 7px 7px 0 #151515;
}

@media (max-width: 640px) {
  .module-nav__button {
    width: 100%;
  }
}
</style>
