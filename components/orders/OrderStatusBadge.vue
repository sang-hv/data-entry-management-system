<script setup lang="ts">
type Status = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

const props = defineProps<{
  status: Status
  size?: 'xs' | 'sm' | 'md'
}>()

const { t } = useI18n()

const colorMap: Record<Status, 'neutral' | 'info' | 'success' | 'error'> = {
  DRAFT: 'neutral',
  ACTIVE: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
}
</script>

<template>
  <UBadge :color="colorMap[props.status]" :size="props.size ?? 'sm'" variant="soft">
    {{ t(`orders.status.${props.status}`) }}
  </UBadge>
</template>
