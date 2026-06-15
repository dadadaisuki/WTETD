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
  '#111414',
  '#2d7a57',
  '#d94f30',
  '#f2a541',
  '#2f6f9f',
  '#77a464',
  '#8f5f3f',
  '#315c47',
  '#c44536',
  '#e5b567',
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
  gap: 18px;
}

.wheel-stage {
  position: relative;
  width: min(540px, 88vw);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}

.pointer-result {
  position: absolute;
  top: -30px;
  z-index: 4;
  min-width: min(320px, 78vw);
  padding: 13px 18px;
  border-radius: 14px;
  background: rgba(17, 20, 20, 0.94);
  color: #f7f5ef;
  text-align: center;
  box-shadow: 0 18px 40px rgba(17, 20, 20, 0.22);
}

.pointer-result span {
  display: block;
  color: #8bd9bc;
  font-size: 12px;
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
  color: #f2d28d;
}

.wheel-pointer {
  position: absolute;
  top: 24px;
  z-index: 3;
  width: 0;
  height: 0;
  border-left: 19px solid transparent;
  border-right: 19px solid transparent;
  border-top: 42px solid #f7f5ef;
  filter: drop-shadow(0 8px 12px rgba(17, 20, 20, 0.32));
}

.wheel-disc {
  position: relative;
  width: 100%;
  height: 100%;
  border: 14px solid #f7f5ef;
  border-radius: 50%;
  box-shadow:
    0 28px 70px rgba(17, 20, 20, 0.22),
    inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  display: grid;
  place-items: center;
  overflow: hidden;
  transition: transform 3.6s cubic-bezier(0.12, 0.74, 0.08, 1);
}

.wheel-disc::after {
  content: "";
  position: absolute;
  inset: 18px;
  border: 1px solid rgba(255, 255, 255, 0.22);
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
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  text-align: center;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(5px);
}

.wheel-disc__center {
  position: relative;
  z-index: 2;
  width: 104px;
  height: 104px;
  border: 1px solid rgba(17, 20, 20, 0.08);
  border-radius: 50%;
  background: #fffdf7;
  color: #111414;
  display: grid;
  place-items: center;
  align-content: center;
  box-shadow:
    0 18px 38px rgba(17, 20, 20, 0.18),
    inset 0 0 0 8px rgba(17, 20, 20, 0.04);
}

.wheel-disc__center small {
  color: #6a756f;
  font-size: 12px;
  font-weight: 800;
}

.wheel-disc__center strong {
  font-size: 28px;
  letter-spacing: -0.08em;
}

.wheel-card__spin {
  border: 0;
  border-radius: 14px;
  padding: 15px 30px;
  background: #111414;
  color: #fff;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.wheel-card__spin:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.wheel-card__hint {
  max-width: 520px;
  margin: 0;
  color: #63746a;
  text-align: center;
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
