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
  border-radius: 10px;
  font-weight: 700;
  line-height: 1.5;
}

.feedback-bar--info {
  color: #244d3b;
  background: linear-gradient(135deg, #eef8f0, #dff0e4);
}

.feedback-bar--success {
  color: #164f34;
  background: linear-gradient(135deg, #e8f8ec, #cdeed6);
}

.feedback-bar--error {
  color: #7a2319;
  background: linear-gradient(135deg, #fff0e8, #ffd8cf);
}
</style>
