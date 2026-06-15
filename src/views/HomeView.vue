<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modules: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['choose-module'])

const activeKey = ref(props.modules[0]?.key || 'dashboard')

const activeModule = computed(() => {
  return props.modules.find((module) => module.key === activeKey.value) || props.modules[0]
})

const chooseModule = (key) => {
  emit('choose-module', key)
}
</script>

<template>
  <section class="home-view">
    <div class="home-glow" aria-hidden="true"></div>

    <div class="hero-copy">
      <p class="hero-copy__overline">Campus Food Decision System</p>
      <h1 class="hero-copy__title">今天吃什么</h1>
      <p class="hero-copy__subtitle">
        是啊，吃什么
      </p>
    </div>

    <div class="launch-grid">
      <button
        v-for="(module, index) in props.modules"
        :key="module.key"
        type="button"
        class="launch-card"
        :class="{ 'launch-card--active': activeKey === module.key }"
        :style="{ '--delay': `${index * 120}ms` }"
        @mouseenter="activeKey = module.key"
        @focus="activeKey = module.key"
        @click="chooseModule(module.key)"
      >
        <span class="launch-card__index">0{{ index + 1 }}</span>
        <strong>{{ module.title }}</strong>
        <small>{{ module.caption }}</small>
      </button>
    </div>

    <transition name="spec-panel" mode="out-in">
      <aside v-if="activeModule" :key="activeModule.key" class="module-spec">
        <span>{{ activeModule.eyebrow }}</span>
        <h2>{{ activeModule.title }}</h2>
        <p>{{ activeModule.description }}</p>
      </aside>
    </transition>
  </section>
</template>

<style scoped>
.home-view {
  position: relative;
  min-height: min(760px, calc(100vh - 110px));
  display: grid;
  grid-template-rows: 1fr auto auto;
  gap: 34px;
  overflow: hidden;
  padding: clamp(42px, 8vw, 92px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: clamp(18px, 3vw, var(--radius-xl));
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 28%),
    linear-gradient(180deg, #111414 0%, #050606 100%);
  color: #f7f5ef;
}

.home-glow {
  position: absolute;
  inset: 8% 7% auto auto;
  width: min(520px, 70vw);
  aspect-ratio: 1;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.46), transparent 8%),
    radial-gradient(circle, rgba(89, 255, 196, 0.22), transparent 52%);
  filter: blur(10px);
  opacity: 0.8;
  animation: floatGlow 5.5s ease-in-out infinite alternate;
}

.hero-copy {
  position: relative;
  align-self: center;
  max-width: 980px;
  margin: 0 auto;
  text-align: center;
}

.hero-copy__overline {
  margin: 0 0 18px;
  color: #9ea7a1;
  font-size: 13px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  animation: riseIn 0.8s ease both;
}

.hero-copy__title {
  margin: 0;
  font-family: "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: clamp(70px, 14vw, 176px);
  font-weight: 900;
  letter-spacing: -0.09em;
  line-height: 0.88;
  background: linear-gradient(180deg, #ffffff 0%, #dce4df 44%, #68716c 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 28px 80px rgba(255, 255, 255, 0.16);
  animation: keynoteTitle 1.05s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.hero-copy__subtitle {
  max-width: 680px;
  margin: 28px auto 0;
  color: #b7c0bb;
  font-size: clamp(17px, 2vw, 22px);
  animation: riseIn 0.9s 0.18s ease both;
}

.launch-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.launch-card {
  min-height: 172px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.055);
  color: #f5f3ed;
  text-align: left;
  cursor: pointer;
  backdrop-filter: blur(24px);
  transform: translateY(18px);
  opacity: 0;
  animation: cardRise 0.75s var(--delay) cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  transition: transform 0.24s ease, background 0.24s ease, border-color 0.24s ease;
}

.launch-card:hover,
.launch-card:focus-visible,
.launch-card--active {
  transform: translateY(-6px);
  border-color: rgba(255, 255, 255, 0.42);
  background: rgba(255, 255, 255, 0.13);
  outline: none;
}

.launch-card__index {
  display: inline-block;
  margin-bottom: 34px;
  color: #8bd9bc;
  font-weight: 900;
}

.launch-card strong {
  display: block;
  font-size: 23px;
  line-height: 1.18;
}

.launch-card small {
  display: block;
  margin-top: 12px;
  color: #aeb8b2;
  font-size: 14px;
}

.module-spec {
  position: relative;
  max-width: 760px;
  padding-left: 18px;
  border-left: 2px solid #8bd9bc;
  color: #c8d0cb;
  text-align: left;
}

.module-spec span {
  color: #8bd9bc;
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.module-spec h2 {
  margin: 8px 0;
  color: #fff;
  font-size: clamp(26px, 4vw, 42px);
}

.module-spec p {
  margin: 0;
}

.spec-panel-enter-active,
.spec-panel-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.spec-panel-enter-from,
.spec-panel-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@keyframes keynoteTitle {
  from {
    opacity: 0;
    filter: blur(18px);
    transform: translateY(42px) scale(0.96);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: translateY(0) scale(1);
  }
}

@keyframes riseIn {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes cardRise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes floatGlow {
  to {
    transform: translate3d(-32px, 28px, 0) scale(1.08);
  }
}

@media (max-width: 860px) {
  .home-view {
    min-height: auto;
    padding: 40px 22px;
  }

  .launch-grid {
    grid-template-columns: 1fr;
  }
}
</style>
