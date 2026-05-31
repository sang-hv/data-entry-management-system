<script setup lang="ts">
const props = defineProps<{
  value: number
  size?: 'xs' | 'sm' | 'md'
  hideLabel?: boolean
}>()

const pct = computed(() => Math.max(0, Math.min(100, props.value)))
const color = computed(() => {
  if (pct.value >= 100) return 'bg-green-500'
  if (pct.value >= 50) return 'bg-blue-500'
  if (pct.value > 0) return 'bg-yellow-500'
  return 'bg-gray-300 dark:bg-gray-700'
})
const heightClass = computed(() => {
  if (props.size === 'xs') return 'h-1'
  if (props.size === 'md') return 'h-3'
  return 'h-2'
})
</script>

<template>
  <div class="flex items-center gap-2">
    <div :class="['flex-1 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden', heightClass]">
      <div :class="['h-full rounded-full transition-all', color]" :style="{ width: `${pct}%` }" />
    </div>
    <span v-if="!props.hideLabel" class="text-xs tabular-nums text-gray-600 dark:text-gray-400 min-w-[2.5rem] text-right">
      {{ pct }}%
    </span>
  </div>
</template>
