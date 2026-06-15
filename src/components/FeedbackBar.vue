<script setup>
defineProps({
  type: {
    type: String,
    default: 'info',
  },
  message: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <p v-if="message" class="feedback-bar" :class="`feedback-bar--${type}`">
    {{ message }}
  </p>
</template>

<style scoped>
.feedback-bar {
  margin: 12px 0 0;
  padding: 12px 14px;
  border: var(--border-strong);
  border-radius: 18px;
  font-weight: 800;
  line-height: 1.5;
  box-shadow: 4px 4px 0 #151515;
}

.feedback-bar--info {
  color: var(--ink);
  background:
    repeating-linear-gradient(135deg, rgba(21, 21, 21, 0.08) 0 8px, transparent 8px 18px),
    var(--sky);
}

.feedback-bar--success {
  color: var(--ink);
  background:
    radial-gradient(circle, rgba(21, 21, 21, 0.18) 0 2px, transparent 2px) 0 0 / 16px 16px,
    var(--lime);
}

.feedback-bar--error {
  color: var(--ink);
  background:
    repeating-linear-gradient(90deg, rgba(21, 21, 21, 0.14) 0 6px, transparent 6px 14px),
    var(--pink);
}
</style>
