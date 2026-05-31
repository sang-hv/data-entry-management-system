<script setup lang="ts">
interface SizeOption {
  id: string
  code: string
  label: string
}

interface Item {
  sizeId: string
  ratio: number
}

const props = defineProps<{
  modelValue: Item[]
  sizes: SizeOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [items: Item[]]
}>()

const { t } = useI18n()

const items = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const availableSizes = computed(() => {
  const usedIds = new Set(items.value.map((i) => i.sizeId))
  return props.sizes.filter((s) => !usedIds.has(s.id))
})

function addItem() {
  if (availableSizes.value.length === 0) return
  items.value = [
    ...items.value,
    { sizeId: availableSizes.value[0]!.id, ratio: 0 },
  ]
}

function removeItem(idx: number) {
  items.value = items.value.filter((_, i) => i !== idx)
}

function updateRatio(idx: number, ratio: number) {
  items.value = items.value.map((it, i) => (i === idx ? { ...it, ratio } : it))
}

function updateSizeId(idx: number, sizeId: string) {
  items.value = items.value.map((it, i) => (i === idx ? { ...it, sizeId } : it))
}

function sizeLabel(id: string) {
  return props.sizes.find((s) => s.id === id)?.label ?? id
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="!items.length" class="p-4 text-center text-sm text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded">
      {{ t('orders.items.noItems') }}
    </div>
    <div
      v-for="(item, idx) in items"
      :key="idx"
      class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded"
    >
      <USelect
        :model-value="item.sizeId"
        :items="[
          { label: sizeLabel(item.sizeId), value: item.sizeId },
          ...availableSizes.map((s) => ({ label: s.label, value: s.id })),
        ]"
        class="w-32"
        @update:model-value="(v) => updateSizeId(idx, v as string)"
      />
      <UInput
        :model-value="item.ratio"
        type="number"
        min="0"
        :placeholder="t('orders.items.ratio')"
        class="flex-1"
        @update:model-value="(v) => updateRatio(idx, Number(v))"
      />
      <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeItem(idx)" />
    </div>
    <UButton
      size="sm"
      variant="outline"
      icon="i-lucide-plus"
      :disabled="availableSizes.length === 0"
      @click="addItem"
    >
      {{ t('orders.items.addItem') }}
    </UButton>
  </div>
</template>
