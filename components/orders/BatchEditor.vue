<script setup lang="ts">
interface SizeOption {
  id: string
  code: string
  label: string
}

interface BatchItemRow {
  sizeId: string
  quantity: number
}

const props = defineProps<{
  modelValue: BatchItemRow[]
  sizes: SizeOption[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [items: BatchItemRow[]]
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

const total = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))

function sizeLabel(id: string) {
  return props.sizes.find((s) => s.id === id)?.label ?? id
}

function addItem() {
  if (availableSizes.value.length === 0 || props.readonly) return
  items.value = [...items.value, { sizeId: availableSizes.value[0]!.id, quantity: 0 }]
}

function removeItem(idx: number) {
  if (props.readonly) return
  items.value = items.value.filter((_, i) => i !== idx)
}

function updateQty(idx: number, quantity: number) {
  items.value = items.value.map((it, i) => (i === idx ? { ...it, quantity } : it))
}

function updateSizeId(idx: number, sizeId: string) {
  items.value = items.value.map((it, i) => (i === idx ? { ...it, sizeId } : it))
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="!items.length"
      class="p-4 text-center text-sm text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded"
    >
      {{ t('orders.batches.noItems') }}
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
        :disabled="readonly"
        class="w-32"
        @update:model-value="(v) => updateSizeId(idx, v as string)"
      />
      <UInput
        :model-value="item.quantity"
        type="number"
        min="0"
        :placeholder="t('orders.batches.quantity')"
        :disabled="readonly"
        class="flex-1"
        @update:model-value="(v) => updateQty(idx, Number(v))"
      />
      <UButton
        v-if="!readonly"
        size="xs"
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        @click="removeItem(idx)"
      />
    </div>

    <div class="flex items-center justify-between pt-1">
      <UButton
        v-if="!readonly"
        size="sm"
        variant="outline"
        icon="i-lucide-plus"
        :disabled="availableSizes.length === 0"
        @click="addItem"
      >
        {{ t('orders.batches.addItem') }}
      </UButton>
      <div class="text-sm font-medium tabular-nums ml-auto">
        {{ t('orders.batches.totalBatch') }}: <span class="text-primary-600 dark:text-primary-400">{{ total }}</span>
      </div>
    </div>
  </div>
</template>
