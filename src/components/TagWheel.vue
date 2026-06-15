<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  cooldownSeconds: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['spin-start', 'spin-finished'])

const rotationDeg = ref(0)
const isSpinning = ref(false)
const pointerResult = ref(null)

const wheelColors = [
  '#ff62b2',
  '#ffe14d',
  '#65d9ff',
  '#b8ff3b',
  '#ff9248',
  '#fff7cf',
  '#ff8bd0',
  '#91ebff',
  '#ffd54f',
  '#dcff84',
]

const normalizeDeg = (value) => {
  return ((value % 360) + 360) % 360
}

const getWeight = (item) => {
  return Math.max(1, Number(item.wheelWeight || item.weight || 1))
}

const totalWeight = computed(() => {
  return props.items.reduce((sum, item) => sum + getWeight(item), 0)
})

const sectors = computed(() => {
  if (props.items.length === 0 || totalWeight.value <= 0) {
    return []
  }

  let cursor = 0

  return props.items.map((item, index) => {
    const weight = getWeight(item)
    const degrees = (weight / totalWeight.value) * 360
    const start = cursor
    const end = index === props.items.length - 1 ? 360 : cursor + degrees
    const center = start + (end - start) / 2
    cursor = end

    return {
      item,
      start,
      end,
      center,
      color: wheelColors[index % wheelColors.length],
      probability: (weight / totalWeight.value) * 100,
    }
  })
})

const wheelStyle = computed(() => {
  if (sectors.value.length === 0) {
    return {
      transform: `rotate(${rotationDeg.value}deg)`,
      background: 'conic-gradient(#eef3ef 0deg 360deg)',
    }
  }

  const segments = sectors.value.map((sector) => {
    return `${sector.color} ${sector.start}deg ${sector.end}deg`
  })

  return {
    transform: `rotate(${rotationDeg.value}deg)`,
    background: `conic-gradient(${segments.join(', ')})`,
  }
})

const labels = computed(() => {
  return sectors.value
    .filter((sector) => sector.probability >= 3.8)
    .slice(0, 16)
    .map((sector) => ({
      id: sector.item.id,
      name: sector.item.name,
      style: {
        transform: `rotate(${sector.center}deg) translateY(-188px) rotate(${-sector.center}deg)`,
      },
    }))
})

const spinButtonText = computed(() => {
  if (isSpinning.value) {
    return '锁定中...'
  }

  if (props.cooldownSeconds > 0) {
    return `冷却 ${props.cooldownSeconds}s`
  }

  if (props.items.length === 0) {
    return '候选池为空'
  }

  return '开始盲盒抽签'
})

const canSpin = computed(() => {
  return !props.disabled && !isSpinning.value && props.items.length > 0
})

const pickWeightedSector = () => {
  const random = Math.random() * totalWeight.value
  let cursor = 0

  return sectors.value.find((sector) => {
    cursor += getWeight(sector.item)
    return random <= cursor
  }) || sectors.value.at(-1)
}

const spin = () => {
  if (!canSpin.value) {
    return
  }

  const winnerSector = pickWeightedSector()
  if (!winnerSector) {
    return
  }

  const current = normalizeDeg(rotationDeg.value)
  const settleDelta = normalizeDeg(360 - normalizeDeg(current + winnerSector.center))
  const extraTurns = 360 * (6 + Math.floor(Math.random() * 3))

  pointerResult.value = null
  isSpinning.value = true
  emit('spin-start')
  rotationDeg.value += extraTurns + settleDelta

  window.setTimeout(() => {
    isSpinning.value = false
    pointerResult.value = winnerSector.item
    emit('spin-finished', winnerSector.item)
  }, 3600)
}

watch(() => props.items, () => {
  pointerResult.value = null
})
</script>

<template>
  <div class="wheel-card">
    <div class="wheel-stage">
      <transition name="result-pop" mode="out-in">
        <div
          v-if="pointerResult"
          :key="pointerResult.id"
          class="pointer-result"
        >
          <span>本次结果</span>
          <strong>{{ pointerResult.name }}</strong>
        </div>
        <div v-else-if="isSpinning" key="spinning" class="pointer-result pointer-result--loading">
          <span>吃什么好呢...</span>
          <strong>锁定中</strong>
        </div>
      </transition>

      <div class="wheel-pointer" aria-hidden="true"></div>

      <div class="wheel-disc" :style="wheelStyle">
        <span
          v-for="label in labels"
          :key="label.id"
          class="wheel-label"
          :style="label.style"
        >
          {{ label.name }}
        </span>
        <span class="wheel-disc__center">
          <small>{{ props.items.length }} 道</small>
          <strong>GO</strong>
        </span>
      </div>
    </div>

    <button
      type="button"
      class="wheel-card__spin"
      :disabled="!canSpin"
      @click="spin"
    >
      {{ spinButtonText }}
    </button>

    <p class="wheel-card__hint">
      扇区面积由基础权重 + 热度共同决定，热度越高概率越高，但不会完全吞掉低热度餐品的机会。
    </p>
  </div>
</template>

<style scoped>
.wheel-card {
  display: grid;
  place-items: center;
  gap: 20px;
}

.wheel-stage {
  position: relative;
  width: min(540px, 88vw);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}

.wheel-stage::before,
.wheel-stage::after {
  content: "";
  position: absolute;
  border: var(--border-strong);
  box-shadow: var(--shadow-sticker);
  pointer-events: none;
}

.wheel-stage::before {
  top: 2rem;
  left: -1rem;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 14px 14px,
    var(--yellow);
  animation: floatSticker 7s ease-in-out infinite;
}

.wheel-stage::after {
  right: -0.5rem;
  bottom: 2rem;
  width: 110px;
  height: 22px;
  border-radius: 999px;
  background:
    repeating-linear-gradient(90deg, #151515 0 8px, transparent 8px 17px),
    var(--pink);
  animation: wiggleLine 5.5s ease-in-out infinite;
}

.pointer-result {
  position: absolute;
  top: -30px;
  z-index: 4;
  min-width: min(320px, 78vw);
  padding: 14px 18px;
  border: var(--border-strong);
  border-radius: 20px;
  background: var(--paper);
  color: var(--ink);
  text-align: center;
  box-shadow: var(--shadow-sticker-lg);
}

.pointer-result span {
  display: block;
  color: var(--red);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.pointer-result strong {
  display: block;
  margin-top: 2px;
  font-size: clamp(20px, 3vw, 30px);
  letter-spacing: -0.04em;
}

.pointer-result--loading strong {
  color: var(--orange);
}

.wheel-pointer {
  position: absolute;
  top: 24px;
  z-index: 3;
  width: 0;
  height: 0;
  border-left: 22px solid transparent;
  border-right: 22px solid transparent;
  border-top: 44px solid #151515;
  filter: drop-shadow(0 7px 0 var(--yellow));
}

.wheel-disc {
  position: relative;
  width: 100%;
  height: 100%;
  border: 12px solid #151515;
  border-radius: 50%;
  box-shadow: 10px 10px 0 #151515;
  display: grid;
  place-items: center;
  overflow: hidden;
  transition: transform 3.6s cubic-bezier(0.12, 0.74, 0.08, 1);
}

.wheel-disc::before {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(21, 21, 21, 0.18) 0 2px, transparent 2px) 0 0 / 18px 18px;
  mix-blend-mode: multiply;
  pointer-events: none;
}

.wheel-disc::after {
  content: "";
  position: absolute;
  inset: 18px;
  border: 3px dashed #151515;
  border-radius: 50%;
  pointer-events: none;
}

.wheel-label {
  position: absolute;
  left: calc(50% - 52px);
  top: calc(50% - 12px);
  z-index: 1;
  width: 104px;
  padding: 3px 6px;
  border: 2px solid #151515;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  color: #151515;
  font-size: 12px;
  font-weight: 900;
  text-align: center;
  box-shadow: 2px 2px 0 #151515;
}

.wheel-disc__center {
  position: relative;
  z-index: 2;
  width: 104px;
  height: 104px;
  border: var(--border-strong);
  border-radius: 50%;
  background:
    radial-gradient(circle, #151515 0 2px, transparent 2px) 0 0 / 15px 15px,
    var(--paper);
  color: var(--ink);
  display: grid;
  place-items: center;
  align-content: center;
  box-shadow: 6px 6px 0 #151515;
}

.wheel-disc__center small {
  color: #3f3f3f;
  font-size: 12px;
  font-weight: 800;
}

.wheel-disc__center strong {
  font-size: 28px;
  letter-spacing: -0.08em;
}

.wheel-card__spin {
  border: var(--border-strong);
  border-radius: 18px;
  padding: 15px 30px;
  background: var(--lime);
  color: var(--ink);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: var(--shadow-sticker);
  transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
}

.wheel-card__spin:hover:not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 8px 8px 0 #151515;
  background: var(--yellow);
}

.wheel-card__spin:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.wheel-card__hint {
  max-width: 520px;
  margin: 0;
  padding: 14px 16px;
  border: var(--border-strong);
  border-radius: 20px;
  background: var(--paper);
  color: #353535;
  text-align: center;
  font-weight: 700;
  box-shadow: var(--shadow-sticker);
}

.result-pop-enter-active,
.result-pop-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease, filter 0.28s ease;
}

.result-pop-enter-from,
.result-pop-leave-to {
  opacity: 0;
  filter: blur(10px);
  transform: translateY(18px) scale(0.96);
}

@media (max-width: 680px) {
  .wheel-stage {
    width: min(430px, 88vw);
  }

  .wheel-label {
    display: none;
  }
}
</style>
