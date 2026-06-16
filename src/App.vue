<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppModuleNav from './components/AppModuleNav.vue'
import { useDiningStore } from './composables/useDiningStore'
import DashboardView from './views/DashboardView.vue'
import HomeView from './views/HomeView.vue'
import ManageView from './views/ManageView.vue'
import WheelView from './views/WheelView.vue'

const {
  homeSnapshot,
  isCloudReady,
  isSyncing,
  loadCatalog,
  refreshFromCloud,
  syncMessage,
} = useDiningStore()

const currentView = ref('home')
const showBackToTop = ref(false)

const entryModules = [
  {
    key: 'dashboard',
    title: '周边推荐',
    caption: '浏览店铺和菜品',
    eyebrow: 'Nearby Choices',
    description: '按热度、菜品和 Tag 快速找到附近可选项',
  },
  {
    key: 'wheel',
    title: '转盘抽签',
    caption: '按标签抽一个',
    eyebrow: 'Random Decision Wheel',
    description: '把筛选条件交给轮盘，减少选择压力',
  },
  {
    key: 'manage',
    title: '新增店铺 / 菜品',
    caption: '补充大家都能看到的数据',
    eyebrow: 'Collaborative Tagging',
    description: '录入店铺、菜品和协同 Tag，并同步给所有同学',
  },
]

const viewMap = {
  home: HomeView,
  dashboard: DashboardView,
  wheel: WheelView,
  manage: ManageView,
}

const currentViewComponent = computed(() => {
  return viewMap[currentView.value] ?? HomeView
})

const getScopeByView = (viewKey) => {
  return viewKey === 'home' ? 'home' : viewKey
}

const handleMenuChange = (nextView) => {
  if (!viewMap[nextView]) {
    return
  }

  currentView.value = nextView
}

const ensureViewData = async (viewKey) => {
  await loadCatalog(getScopeByView(viewKey))
}

const handleWindowScroll = () => {
  showBackToTop.value = window.scrollY > 420
}

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

onMounted(() => {
  ensureViewData(currentView.value)
  handleWindowScroll()
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
})

watch(currentView, (nextView) => {
  ensureViewData(nextView)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleWindowScroll)
})
</script>

<template>
  <main class="app-shell" :class="{ 'app-shell--home': currentView === 'home' }">
    <div class="app-shell__decals" aria-hidden="true">
      <span class="app-shell__decal app-shell__decal--circle"></span>
      <span class="app-shell__decal app-shell__decal--square"></span>
      <span class="app-shell__decal app-shell__decal--line"></span>
    </div>

    <header class="topbar">
      <button type="button" class="brand-mark" @click="handleMenuChange('home')">
        首页
      </button>

      <div class="sync-strip">
        <span class="sync-strip__dot" :class="{ 'sync-strip__dot--live': isCloudReady }"></span>
        <span>{{ isSyncing ? '同步中...' : syncMessage }}</span>
        <button
          type="button"
          class="sync-strip__button"
          @click="refreshFromCloud(getScopeByView(currentView))"
        >
          刷新云端
        </button>
      </div>
    </header>

    <AppModuleNav
      v-if="currentView !== 'home'"
      :current-view="currentView"
      @menu-change="handleMenuChange"
    />

    <section class="view-panel" :class="{ 'view-panel--home': currentView === 'home' }">
      <component
        :is="currentViewComponent"
        :home-snapshot="homeSnapshot"
        :modules="entryModules"
        @choose-module="handleMenuChange"
      />
    </section>

    <button
      v-show="showBackToTop"
      type="button"
      class="back-to-top"
      aria-label="回到页面顶部"
      @click="scrollToTop"
    >
      回到顶部
    </button>
  </main>
</template>

<style scoped>
.app-shell {
  position: relative;
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 26px 0 70px;
}

.app-shell--home {
  width: min(1320px, calc(100% - 28px));
}

.app-shell__decals {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.app-shell__decal {
  position: absolute;
  border: var(--border-strong);
  box-shadow: var(--shadow-sticker);
}

.app-shell__decal--circle {
  top: 5.5rem;
  right: 4%;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 3px, transparent 3px) 0 0 / 18px 18px,
    var(--lime);
  animation: floatSticker 7s ease-in-out infinite;
}

.app-shell__decal--square {
  top: 11.5rem;
  left: -0.5rem;
  width: 74px;
  height: 74px;
  border-radius: 20px;
  background:
    linear-gradient(135deg, transparent 0 38%, #151515 38% 42%, transparent 42% 58%, #151515 58% 62%, transparent 62%),
    var(--pink);
  transform: rotate(-14deg);
  animation: driftTilt 8s ease-in-out infinite;
}

.app-shell__decal--line {
  right: 18%;
  bottom: 5rem;
  width: 132px;
  height: 24px;
  border-radius: 999px;
  background:
    repeating-linear-gradient(90deg, #151515 0 8px, transparent 8px 18px),
    var(--yellow);
  animation: wiggleLine 5s ease-in-out infinite;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 20px;
}

.brand-mark {
  position: relative;
  min-width: 92px;
  height: 54px;
  border: var(--border-strong);
  border-radius: 18px;
  background: var(--pink);
  color: var(--ink);
  font-weight: 900;
  font-size: 18px;
  letter-spacing: -0.08em;
  cursor: pointer;
  box-shadow: var(--shadow-sticker);
  transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
}

.brand-mark:hover {
  transform: translate(-2px, -2px);
  box-shadow: 8px 8px 0 #151515;
  background: var(--yellow);
}

.sync-strip {
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  max-width: min(760px, 100%);
  padding: 13px 16px;
  border: var(--border-strong);
  border-radius: 22px;
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 18px 18px,
    var(--paper);
  color: var(--ink);
  font-size: 14px;
  font-weight: 700;
  box-shadow: var(--shadow-sticker);
}

.sync-strip__dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid #151515;
  background: var(--orange);
  box-shadow: 4px 4px 0 #151515;
}

.sync-strip__dot--live {
  background: var(--lime);
}

.sync-strip__button {
  margin-left: auto;
  border: var(--border-strong);
  padding: 9px 14px;
  border-radius: 16px;
  background: var(--sky);
  color: var(--ink);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 4px 4px 0 #151515;
  transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
}

.sync-strip__button:hover {
  transform: translate(-1px, -1px);
  box-shadow: 6px 6px 0 #151515;
  background: var(--yellow);
}

.view-panel {
  position: relative;
  margin-top: 18px;
  padding: 32px;
  border: var(--border-strong);
  border-radius: 34px;
  background:
    linear-gradient(0deg, transparent 0 23px, rgba(21, 21, 21, 0.1) 23px 24px, transparent 24px),
    linear-gradient(90deg, transparent 0 23px, rgba(21, 21, 21, 0.1) 23px 24px, transparent 24px),
    var(--paper);
  background-size: 24px 24px, 24px 24px, auto;
  box-shadow: var(--shadow-sticker-lg);
  overflow: hidden;
}

.view-panel::before,
.view-panel::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.view-panel::before {
  top: 18px;
  right: 22px;
  width: 118px;
  height: 18px;
  border-radius: 999px;
  background:
    repeating-linear-gradient(90deg, #151515 0 7px, transparent 7px 16px),
    var(--yellow);
  border: var(--border-strong);
  animation: wiggleLine 6s ease-in-out infinite;
}

.view-panel::after {
  bottom: 18px;
  left: 26px;
  width: 92px;
  height: 92px;
  border: var(--border-strong);
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 16px 16px,
    var(--paper-alt);
  animation: floatSticker 7s ease-in-out infinite;
}

.view-panel--home {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  clip-path: none;
}

.view-panel--home::before,
.view-panel--home::after {
  display: none;
}

.back-to-top {
  position: fixed;
  right: max(20px, calc((100vw - 1180px) / 2 + 20px));
  bottom: 24px;
  z-index: 50;
  border: var(--border-strong);
  border-radius: 999px;
  padding: 12px 18px;
  background:
    linear-gradient(135deg, transparent 0 30%, rgba(21, 21, 21, 0.16) 30% 35%, transparent 35% 100%),
    var(--yellow);
  color: var(--ink);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: var(--shadow-sticker);
  transition: transform 0.22s ease, box-shadow 0.22s ease, opacity 0.22s ease;
}

.back-to-top:hover {
  transform: translate(-2px, -2px);
  box-shadow: 8px 8px 0 #151515;
}

@media (max-width: 720px) {
  .app-shell,
  .app-shell--home {
    width: min(100% - 18px, 1180px);
    padding: 18px 0 42px;
  }

  .topbar {
    align-items: stretch;
    flex-direction: column;
  }

  .sync-strip {
    max-width: none;
  }

  .sync-strip__button {
    width: 100%;
    margin-left: 0;
  }

  .view-panel {
    padding: 20px;
  }

  .view-panel--home {
    padding: 0;
  }

  .app-shell__decal--circle,
  .app-shell__decal--square {
    display: none;
  }

  .back-to-top {
    right: 14px;
    bottom: 14px;
    padding: 10px 13px;
  }
}
</style>
