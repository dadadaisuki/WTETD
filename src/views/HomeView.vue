<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  homeSnapshot: {
    type: Object,
    default: () => ({
      counts: {},
      highlights: {
        topTags: [],
        updatedAt: null,
      },
    }),
  },
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
    <div class="home-collage" aria-hidden="true">
      <span class="home-collage__shape home-collage__shape--dot"></span>
      <span class="home-collage__shape home-collage__shape--triangle"></span>
      <span class="home-collage__shape home-collage__shape--stripe"></span>
      <span class="home-collage__shape home-collage__shape--blob"></span>
    </div>

    <div class="hero-copy">
      <p class="hero-copy__overline">Campus Food Decision System</p>
      <h1 class="hero-copy__title">今天吃什么</h1>
      <p class="hero-copy__subtitle">
        先选一个入口：看周边、转转盘，或者把你发现的好店补充进去。
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
        <div v-if="props.homeSnapshot?.highlights?.topTags?.length" class="module-spec__tags">
          <small
            v-for="item in props.homeSnapshot.highlights.topTags"
            :key="item.tag"
          >
            {{ item.tag }} · {{ item.score }}
          </small>
        </div>
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
  gap: 30px;
  overflow: hidden;
  padding: clamp(42px, 8vw, 92px);
  border: var(--border-strong);
  border-radius: clamp(24px, 4vw, var(--radius-xl));
  background:
    linear-gradient(0deg, transparent 0 23px, rgba(21, 21, 21, 0.12) 23px 24px, transparent 24px),
    linear-gradient(90deg, transparent 0 23px, rgba(21, 21, 21, 0.12) 23px 24px, transparent 24px),
    linear-gradient(135deg, #fffdf7 0 48%, #fff0f7 48% 100%);
  background-size: 24px 24px, 24px 24px, auto;
  color: var(--ink);
  box-shadow: var(--shadow-sticker-lg);
}

.home-collage {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.home-collage__shape {
  position: absolute;
  border: var(--border-strong);
  box-shadow: var(--shadow-sticker);
}

.home-collage__shape--dot {
  top: 4.5rem;
  right: 5%;
  width: 162px;
  height: 162px;
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 3px, transparent 3px) 0 0 / 16px 16px,
    var(--sky);
  animation: floatSticker 7s ease-in-out infinite;
}

.home-collage__shape--triangle {
  left: 4%;
  bottom: 8rem;
  width: 0;
  height: 0;
  border: 0;
  border-top: 0;
  border-right: 78px solid transparent;
  border-bottom: 128px solid var(--yellow);
  border-left: 78px solid transparent;
  box-shadow: none;
  filter: drop-shadow(8px 8px 0 #151515);
  animation: driftTilt 9s ease-in-out infinite;
}

.home-collage__shape--stripe {
  right: 18%;
  bottom: 3.2rem;
  width: 168px;
  height: 34px;
  border-radius: 999px;
  background:
    repeating-linear-gradient(90deg, #151515 0 8px, transparent 8px 18px),
    var(--pink);
  animation: wiggleLine 5.5s ease-in-out infinite;
}

.home-collage__shape--blob {
  top: 10.5rem;
  left: 8%;
  width: 110px;
  height: 110px;
  border-radius: 38% 62% 48% 52%;
  background:
    linear-gradient(135deg, transparent 0 42%, #151515 42% 48%, transparent 48% 100%),
    var(--lime);
  transform: rotate(-18deg);
  animation: bobFloat 8s ease-in-out infinite;
}

.hero-copy {
  position: relative;
  align-self: center;
  max-width: 980px;
  margin: 0 auto;
  text-align: center;
}

.hero-copy__overline {
  display: inline-block;
  margin: 0 0 22px;
  padding: 8px 14px;
  border: var(--border-strong);
  border-radius: 999px;
  background: var(--yellow);
  color: var(--ink);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  box-shadow: 4px 4px 0 #151515;
  animation: riseIn 0.8s ease both;
}

.hero-copy__title {
  margin: 0;
  font-family: "Trebuchet MS", "Avenir Next Condensed", "PingFang SC", sans-serif;
  font-size: clamp(72px, 14vw, 170px);
  font-weight: 900;
  letter-spacing: -0.08em;
  line-height: 0.9;
  color: var(--ink);
  text-shadow:
    3px 3px 0 var(--paper),
    7px 7px 0 var(--pink);
  animation: keynoteTitle 1.05s var(--ease-smooth) both;
}

.hero-copy__subtitle {
  max-width: 680px;
  margin: 28px auto 0;
  padding: 16px 20px;
  border: var(--border-strong);
  border-radius: 22px;
  background: var(--paper);
  color: var(--ink);
  font-size: clamp(17px, 2vw, 22px);
  box-shadow: var(--shadow-sticker);
  animation: riseIn 0.9s 0.18s ease both;
}

.launch-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.launch-card {
  position: relative;
  min-height: 172px;
  padding: 24px;
  border: var(--border-strong);
  border-radius: 24px;
  background: var(--paper);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  box-shadow: var(--shadow-sticker);
  transform: translateY(18px);
  opacity: 0;
  animation: cardRise 0.75s var(--delay) cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  transition: transform 0.24s ease, box-shadow 0.24s ease, background 0.24s ease;
  overflow: hidden;
}

.launch-card::before,
.launch-card::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.launch-card::before {
  top: 16px;
  right: 16px;
  width: 56px;
  height: 56px;
  border: var(--border-strong);
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 12px 12px,
    rgba(255, 255, 255, 0.46);
  animation: pulseDots 4s ease-in-out infinite;
}

.launch-card::after {
  left: 20px;
  bottom: 16px;
  width: 86px;
  height: 14px;
  border-radius: 999px;
  background:
    repeating-linear-gradient(90deg, #151515 0 8px, transparent 8px 16px),
    rgba(255, 255, 255, 0.6);
  animation: wiggleLine 4.8s ease-in-out infinite;
}

.launch-card:nth-child(3n + 1) {
  background: #fff6fe;
}

.launch-card:nth-child(3n + 1)::before {
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 12px 12px,
    var(--sky);
}

.launch-card:nth-child(3n + 2) {
  background: #fffbdf;
}

.launch-card:nth-child(3n + 2)::before {
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 12px 12px,
    var(--pink);
}

.launch-card:nth-child(3n + 3) {
  background: #f4ffe5;
}

.launch-card:nth-child(3n + 3)::before {
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 12px 12px,
    var(--yellow);
}

.launch-card:hover,
.launch-card:focus-visible,
.launch-card--active {
  transform: translate(-4px, -4px) rotate(-1deg);
  box-shadow: 10px 10px 0 #151515;
  outline: none;
}

.launch-card__index {
  display: inline-block;
  margin-bottom: 28px;
  padding: 4px 10px;
  border: var(--border-strong);
  border-radius: 999px;
  background: var(--ink);
  color: var(--paper);
  box-shadow: 3px 3px 0 var(--pink);
  font-weight: 900;
}

.launch-card strong {
  display: block;
  position: relative;
  z-index: 1;
  font-size: 24px;
  line-height: 1.18;
}

.launch-card small {
  display: block;
  margin-top: 12px;
  position: relative;
  z-index: 1;
  color: #373737;
  font-size: 14px;
  font-weight: 700;
}

.module-spec {
  position: relative;
  max-width: 760px;
  padding: 22px 24px;
  border: var(--border-strong);
  border-radius: 26px;
  background:
    linear-gradient(135deg, transparent 0 30%, rgba(21, 21, 21, 0.12) 30% 34%, transparent 34% 100%),
    var(--paper);
  color: var(--ink);
  text-align: left;
  box-shadow: var(--shadow-sticker);
}

.module-spec span {
  display: inline-block;
  padding: 6px 10px;
  border: var(--border-strong);
  border-radius: 999px;
  background: var(--lime);
  color: var(--ink);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.module-spec h2 {
  margin: 14px 0 8px;
  color: var(--ink);
  font-size: clamp(26px, 4vw, 42px);
  letter-spacing: -0.05em;
}

.module-spec p {
  margin: 0;
  color: #363636;
  font-weight: 700;
}

.module-spec__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.module-spec__tags small {
  padding: 6px 10px;
  border: var(--border-strong);
  border-radius: 999px;
  background: var(--yellow);
  color: var(--ink);
  font-size: 12px;
  font-weight: 900;
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
    transform: translateY(42px) scale(0.94) rotate(-2deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0deg);
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

@media (max-width: 860px) {
  .home-view {
    min-height: auto;
    padding: 40px 22px;
  }

  .home-collage__shape--triangle,
  .home-collage__shape--stripe {
    display: none;
  }

  .launch-grid {
    grid-template-columns: 1fr;
  }
}
</style>
