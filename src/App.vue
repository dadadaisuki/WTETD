<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppModuleNav from './components/AppModuleNav.vue'
import { useDiningStore } from './composables/useDiningStore'
import DashboardView from './views/DashboardView.vue'
import HomeView from './views/HomeView.vue'
import ManageView from './views/ManageView.vue'
import WheelView from './views/WheelView.vue'

const {
  isCloudReady,
  isSyncing,
  loadDiningData,
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
    title: '轮盘抽食',
    caption: '按标签抽一个',
    eyebrow: 'Random Decision Wheel',
    description: '把筛选条件交给轮盘，减少选择压力',
  },
  {
    key: 'manage',
    title: '新增店铺/菜品',
    caption: '补充大家都能看到',
    eyebrow: 'Collaborative Tagging',
    description: '录入店铺、菜品和协同 Tag，同步给所有同学',
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

const handleMenuChange = (nextView) => {
  if (!viewMap[nextView]) {
    return
  }

  currentView.value = nextView
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
  loadDiningData()
  handleWindowScroll()
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleWindowScroll)
})
</script>

<template>
  <main class="app-shell" :class="{ 'app-shell--home': currentView === 'home' }">
    <header class="topbar">
      <button type="button" class="brand-mark" @click="handleMenuChange('home')">
        WMDW
      </button>

      <div class="sync-strip">
        <span class="sync-strip__dot" :class="{ 'sync-strip__dot--live': isCloudReady }"></span>
        <span>{{ isSyncing ? '同步中...' : syncMessage }}</span>
        <button type="button" class="sync-strip__button" @click="refreshFromCloud">
          拉取云端
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
      ↑ 顶部
    </button>
  </main>
</template>

<style scoped>
.app-shell {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0 64px;
}

.app-shell--home {
  width: min(1320px, calc(100% - 28px));
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.brand-mark {
  width: 58px;
  height: 42px;
  border: 1px solid rgba(23, 49, 38, 0.18);
  border-radius: var(--radius-md);
  background: #101312;
  color: #f7f5ef;
  font-weight: 900;
  letter-spacing: -0.08em;
  cursor: pointer;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.brand-mark:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(17, 20, 20, 0.16);
}

.sync-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  max-width: min(760px, 100%);
  padding: 10px 12px;
  border: 1px solid rgba(45, 122, 87, 0.18);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.72);
  color: #355c49;
  font-size: 14px;
  backdrop-filter: blur(18px);
}

.sync-strip__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #e2a23a;
  box-shadow: 0 0 0 5px rgba(226, 162, 58, 0.12);
}

.sync-strip__dot--live {
  background: #2d7a57;
  box-shadow: 0 0 0 5px rgba(45, 122, 87, 0.15);
}

.sync-strip__button {
  border: 0;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: #173126;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

.view-panel {
  margin-top: 18px;
  padding: 28px;
  border: 1px solid #dde6df;
  border-radius: var(--radius-lg);
  background: #fff;
  box-shadow: 0 14px 32px rgba(23, 49, 38, 0.06);
}

.view-panel--home {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  clip-path: none;
}

.back-to-top {
  position: fixed;
  right: max(20px, calc((100vw - 1180px) / 2 + 20px));
  bottom: 24px;
  z-index: 50;
  border: 1px solid rgba(23, 49, 38, 0.16);
  border-radius: 999px;
  padding: 12px 16px;
  background: rgba(17, 20, 20, 0.92);
  color: #fff;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 16px 34px rgba(17, 20, 20, 0.18);
  backdrop-filter: blur(18px);
  transition: transform 0.22s ease, box-shadow 0.22s ease, opacity 0.22s ease;
}

.back-to-top:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 42px rgba(17, 20, 20, 0.22);
}

@media (max-width: 720px) {
  .app-shell,
  .app-shell--home {
    width: min(100% - 18px, 1180px);
    padding: 18px 0 40px;
  }

  .topbar {
    align-items: stretch;
    flex-direction: column;
  }

  .sync-strip__button {
    width: 100%;
  }

  .view-panel {
    padding: 18px;
  }

  .view-panel--home {
    padding: 0;
  }

  .back-to-top {
    right: 14px;
    bottom: 14px;
    padding: 10px 13px;
  }
}
</style>
