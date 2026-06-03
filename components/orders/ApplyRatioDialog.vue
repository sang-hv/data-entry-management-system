<script setup lang="ts">
interface OrderItemRatio {
  sizeId: string
  ratio: number
  size: { code: string; label: string }
}

interface Preview {
  sizeId: string
  sizeLabel: string
  ratio: number
  quantity: number
}

const props = defineProps<{
  open: boolean
  orderItems: OrderItemRatio[]
  /** If provided, the dialog will update this batch instead of creating a new one */
  batchNumber?: number
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  apply: [payload: {
    multiplier: number
    batchedAt?: Date
    note?: string
    batchNumber?: number
  }]
}>()

const { t } = useI18n()

const multiplier = ref<number>(1)
const batchedAt = ref<string>('')
const note = ref<string>('')
const loading = ref(false)

const ratioItems = computed(() => props.orderItems.filter((i) => i.ratio > 0))
const hasRatio = computed(() => ratioItems.value.length > 0)

const preview = computed<Preview[]>(() => {
  if (!multiplier.value || multiplier.value < 1) return []
  return ratioItems.value.map((i) => ({
    sizeId: i.sizeId,
    sizeLabel: i.size.label,
    ratio: i.ratio,
    quantity: i.ratio * multiplier.value,
  }))
})

const previewTotal = computed(() =>
  preview.value.reduce((s, p) => s + p.quantity, 0),
)

// Reset on open
watch(() => props.open, (v) => {
  if (v) {
    multiplier.value = 1
    batchedAt.value = ''
    note.value = ''
    loading.value = false
  }
})

async function onApply() {
  if (!hasRatio.value || multiplier.value < 1) return
  loading.value = true
  try {
    await emit('apply', {
      multiplier: multiplier.value,
      batchedAt: batchedAt.value ? new Date(batchedAt.value) : undefined,
      note: note.value || undefined,
      batchNumber: props.batchNumber,
    })
    emit('update:open', false)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('orders.batches.applyRatio.title')"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('orders.batches.applyRatio.subtitle') }}
        </p>

        <!-- No ratio warning -->
        <UAlert
          v-if="!hasRatio"
          color="warning"
          variant="soft"
          icon="i-lucide-alert-circle"
          :description="t('orders.batches.applyRatio.noRatioWarning')"
        />

        <template v-else>
          <!-- Multiplier -->
          <UFormField :label="t('orders.batches.applyRatio.multiplierLabel')" required>
            <UInput
              v-model="multiplier"
              type="number"
              min="1"
              max="100000"
              :placeholder="t('orders.batches.applyRatio.multiplierPlaceholder')"
              class="w-40"
            />
          </UFormField>

          <!-- Preview -->
          <div v-if="preview.length" class="bg-gray-50 dark:bg-gray-800/50 rounded p-3 space-y-1">
            <div class="text-xs font-medium text-gray-500 mb-2">
              {{ t('orders.batches.applyRatio.previewTitle') }}
            </div>
            <div
              v-for="row in preview"
              :key="row.sizeId"
              class="flex items-center justify-between text-sm tabular-nums"
            >
              <span>{{ row.sizeLabel }}</span>
              <span class="text-gray-500">{{ row.ratio }} × {{ multiplier }} =</span>
              <span class="font-medium">{{ row.quantity }}</span>
            </div>
            <div class="flex items-center justify-between text-sm font-semibold border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <span>{{ t('orders.batches.applyRatio.total') }}</span>
              <span class="text-primary-600 dark:text-primary-400">{{ previewTotal }}</span>
            </div>
          </div>

          <!-- Optional metadata -->
          <UFormField :label="t('orders.batches.applyRatio.batchedAt')">
            <UInput v-model="batchedAt" type="date" class="w-48" />
          </UFormField>

          <UFormField :label="t('orders.batches.applyRatio.note')">
            <UTextarea v-model="note" rows="2" />
          </UFormField>
        </template>

        <!-- Footer actions -->
        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" @click="emit('update:open', false)">
            {{ t('common.actions.cancel') }}
          </UButton>
          <UButton
            :disabled="!hasRatio || multiplier < 1"
            :loading="loading"
            @click="onApply"
          >
            {{ batchNumber
              ? t('orders.batches.applyRatio.updateBatch', { number: batchNumber })
              : t('orders.batches.applyRatio.createNew') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
