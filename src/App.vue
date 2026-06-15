<script setup>
import { computed, onMounted, ref } from 'vue'
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

const entryModules = [
  {
    key: 'dashboard',
    title: '周边推荐',
    caption: '看看都有啥吃的',
    eyebrow: 'Whats Nearby ',
    description: '商家总览和同学严选',
  },
  {
    key: 'wheel',
    title: '轮盘抽食',
    caption: '随机看看',
    eyebrow: 'Random Decision Wheel',
    description: '适合选择困难症候群',
  },
  {
    key: 'manage',
    title: '新增标签',
    caption: '添加你觉得好吃的菜',
    eyebrow: 'Collaborative Tagging',
    description: '添加成功所有人都能吃上',
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

onMounted(() => {
  loadDiningData()
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
}
</style>
