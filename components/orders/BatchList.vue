<script setup lang="ts">
interface SizeOption {
  id: string
  code: string
  label: string
}

interface BatchItemRow {
  id: string
  sizeId: string
  quantity: number
  size: { id: string; code: string; label: string }
}

interface Batch {
  id: string
  orderId: string
  batchNumber: number
  batchedAt: string
  note: string | null
  deletedAt: string | null
  items: BatchItemRow[]
}

interface OrderItemRatio {
  sizeId: string
  ratio: number
  size: { code: string; label: string }
}

const props = defineProps<{
  orderId: string
  batches: Batch[]
  orderItems: OrderItemRatio[]
  sizes: SizeOption[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()
const toast = useToast()

// Expansion state per batch
const expandedIds = ref<Set<string>>(new Set())
function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else expandedIds.value.add(id)
  // Trigger reactivity
  expandedIds.value = new Set(expandedIds.value)
}

// Inline editing state
const editingId = ref<string | null>(null)
const editingItems = ref<Array<{ sizeId: string; quantity: number }>>([])
const editingNote = ref('')
const editingBatchedAt = ref('')

// Dialog state
const applyRatioOpen = ref(false)
const applyRatioForBatchNumber = ref<number | undefined>(undefined)

// New batch dialog (manual)
const newBatchOpen = ref(false)
const newBatchItems = ref<Array<{ sizeId: string; quantity: number }>>([])
const newBatchNote = ref('')
const newBatchBatchedAt = ref('')
const newBatchLoading = ref(false)

// Computed totals
function batchTotal(batch: Batch) {
  return batch.items.reduce((s, i) => s + i.quantity, 0)
}

const orderTotal = computed(() =>
  props.batches.reduce((s, b) => s + batchTotal(b), 0),
)

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function startEdit(batch: Batch) {
  editingId.value = batch.id
  editingItems.value = batch.items.map((i) => ({ sizeId: i.sizeId, quantity: i.quantity }))
  editingNote.value = batch.note ?? ''
  editingBatchedAt.value = batch.batchedAt.split('T')[0] ?? ''
  if (!expandedIds.value.has(batch.id)) toggleExpand(batch.id)
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(batch: Batch) {
  try {
    await $fetch(`/api/batches/${batch.id}/items`, {
      method: 'PUT',
      body: { items: editingItems.value },
    })
    if (editingNote.value !== batch.note || editingBatchedAt.value) {
      await $fetch(`/api/batches/${batch.id}`, {
        method: 'PATCH',
        body: {
          patch: {
            note: editingNote.value || null,
            batchedAt: editingBatchedAt.value ? new Date(editingBatchedAt.value) : undefined,
          },
        },
      })
    }
    toast.add({ title: t('common.messages.saved'), color: 'success' })
    editingId.value = null
    emit('refresh')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

async function deleteBatch(batch: Batch) {
  if (!confirm(t('orders.batches.deleteConfirm', { number: batch.batchNumber }))) return
  try {
    await $fetch(`/api/batches/${batch.id}`, { method: 'DELETE' })
    toast.add({ title: t('common.messages.deleted'), color: 'success' })
    emit('refresh')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

function openApplyRatio(batchNumber?: number) {
  applyRatioForBatchNumber.value = batchNumber
  applyRatioOpen.value = true
}

async function handleApplyRatio(payload: {
  multiplier: number
  batchedAt?: Date
  note?: string
  batchNumber?: number
}) {
  try {
    await $fetch(`/api/orders/${props.orderId}/apply-ratio`, {
      method: 'POST',
      body: {
        multiplier: payload.multiplier,
        batchedAt: payload.batchedAt,
        note: payload.note,
        batchNumber: payload.batchNumber,
      },
    })
    toast.add({ title: t('common.messages.saved'), color: 'success' })
    emit('refresh')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

function openNewBatch() {
  newBatchItems.value = []
  newBatchNote.value = ''
  newBatchBatchedAt.value = ''
  newBatchOpen.value = true
}

async function createBatch() {
  if (newBatchItems.value.length === 0) return
  newBatchLoading.value = true
  try {
    await $fetch(`/api/orders/${props.orderId}/batches`, {
      method: 'POST',
      body: {
        items: newBatchItems.value,
        note: newBatchNote.value || null,
        batchedAt: newBatchBatchedAt.value ? new Date(newBatchBatchedAt.value) : undefined,
      },
    })
    toast.add({ title: t('common.messages.created'), color: 'success' })
    newBatchOpen.value = false
    emit('refresh')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    newBatchLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Toolbar -->
    <div v-if="!readonly" class="flex flex-wrap items-center gap-2">
      <UButton size="sm" icon="i-lucide-plus" @click="openNewBatch">
        {{ t('orders.batches.addBatch') }}
      </UButton>
      <UButton size="sm" variant="outline" icon="i-lucide-calculator" @click="openApplyRatio()">
        {{ t('orders.batches.generateBatch') }}
      </UButton>
    </div>

    <!-- Empty state -->
    <div
      v-if="!batches.length"
      class="p-6 text-center text-sm text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded"
    >
      {{ t('orders.batches.noBatches') }}
    </div>

    <!-- Batch cards -->
    <UCard
      v-for="batch in batches"
      :key="batch.id"
      class="overflow-hidden"
    >
      <!-- Batch header -->
      <div class="flex items-center justify-between gap-2 cursor-pointer select-none" @click="toggleExpand(batch.id)">
        <div class="flex items-center gap-3">
          <UIcon
            :name="expandedIds.has(batch.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-right'"
            class="w-4 h-4 text-gray-400 shrink-0"
          />
          <div>
            <div class="font-medium text-sm">
              {{ t('orders.batches.batchNumber', { number: batch.batchNumber }) }}
            </div>
            <div class="text-xs text-gray-500">
              {{ formatDate(batch.batchedAt) }}<span v-if="batch.note"> · {{ batch.note }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-sm font-semibold tabular-nums text-primary-600 dark:text-primary-400">
            {{ batchTotal(batch) }}
          </div>
          <template v-if="!readonly">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-calculator"
              :title="t('orders.batches.generateBatch')"
              @click.stop="openApplyRatio(batch.batchNumber)"
            />
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-pencil"
              @click.stop="startEdit(batch)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              @click.stop="deleteBatch(batch)"
            />
          </template>
        </div>
      </div>

      <!-- Expanded: batch items -->
      <div v-if="expandedIds.has(batch.id)" class="mt-3 border-t border-gray-200 dark:border-gray-800 pt-3">
        <template v-if="editingId === batch.id">
          <!-- Edit mode -->
          <BatchEditor v-model="editingItems" :sizes="sizes" />
          <UFormField :label="t('orders.batches.batchedAt')" class="mt-3">
            <UInput v-model="editingBatchedAt" type="date" class="w-48" />
          </UFormField>
          <UFormField :label="t('orders.batches.note')" class="mt-2">
            <UInput v-model="editingNote" />
          </UFormField>
          <div class="flex justify-end gap-2 mt-3">
            <UButton size="sm" variant="ghost" @click="cancelEdit">
              {{ t('common.actions.cancel') }}
            </UButton>
            <UButton size="sm" @click="saveEdit(batch)">
              {{ t('common.actions.save') }}
            </UButton>
          </div>
        </template>
        <template v-else>
          <!-- View mode -->
          <div class="space-y-1">
            <div
              v-for="item in batch.items"
              :key="item.sizeId"
              class="flex items-center justify-between text-sm tabular-nums"
            >
              <span class="text-gray-700 dark:text-gray-300">{{ item.size.label }}</span>
              <span class="font-medium">{{ item.quantity }}</span>
            </div>
            <div
              v-if="!batch.items.length"
              class="text-sm text-gray-400"
            >
              {{ t('orders.batches.noItems') }}
            </div>
          </div>
        </template>
      </div>
    </UCard>

    <!-- Order total -->
    <div
      v-if="batches.length"
      class="flex items-center justify-between px-1 pt-1 text-sm font-semibold border-t border-gray-200 dark:border-gray-800"
    >
      <span>{{ t('orders.batches.totalOrder') }}</span>
      <span class="tabular-nums text-primary-600 dark:text-primary-400">{{ orderTotal }}</span>
    </div>

    <!-- Apply Ratio Dialog -->
    <OrdersApplyRatioDialog
      v-model:open="applyRatioOpen"
      :order-items="orderItems"
      :batch-number="applyRatioForBatchNumber"
      @apply="handleApplyRatio"
    />

    <!-- New Batch Dialog -->
    <UModal v-model:open="newBatchOpen" :title="t('orders.batches.addBatch')">
      <template #body>
        <div class="space-y-4">
          <OrdersBatchEditor
            v-model="newBatchItems"
            :sizes="sizes"
          />
          <UFormField :label="t('orders.batches.batchedAt')">
            <UInput v-model="newBatchBatchedAt" type="date" class="w-48" />
          </UFormField>
          <UFormField :label="t('orders.batches.note')">
            <UInput v-model="newBatchNote" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="newBatchOpen = false">
              {{ t('common.actions.cancel') }}
            </UButton>
            <UButton
              :disabled="newBatchItems.length === 0"
              :loading="newBatchLoading"
              @click="createBatch"
            >
              {{ t('common.actions.create') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
