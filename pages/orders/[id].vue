<script setup lang="ts">
interface OrderTask {
  id: string
  taskId: string | null
  nameSnapshot: string
  descriptionSnapshot: string | null
  position: number
  progressPct: number
  notes: string | null
  startedAt: string | null
  completedAt: string | null
}

interface OrderDetail {
  id: string
  code: string
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  progressPct: number
  orderedAt: string | null
  expectedAt: string | null
  actualAt: string | null
  notes: string | null
  version: number
  styleVariant: {
    id: string
    name: string
    imageUrl: string | null
    style: { id: string, code: string, name: string }
  }
  owner: { id: string, name: string, email: string }
  items: Array<{ id: string, sizeId: string, ratio: number, size: { code: string, label: string } }>
  tasks: OrderTask[]
  batches: unknown[]
}

interface TimelineEntry {
  id: string
  fromStatus: string | null
  toStatus: string | null
  note: string | null
  createdAt: string
  createdBy: { name: string }
  source: string
}

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const orderId = route.params.id as string

const { data, refresh } = await useFetch<{ order: OrderDetail }>(
  `/api/orders/${orderId}`,
)

const { data: timelineData, refresh: refreshTimeline } = await useFetch<{ items: TimelineEntry[] }>(
  `/api/orders/${orderId}/timeline`,
)

const tab = ref<'info' | 'items' | 'tasks' | 'timeline'>('tasks')
const taskPickerOpen = ref(false)

const { data: sizesData } = await useFetch<{ items: Array<{ id: string, code: string, label: string }> }>(
  '/api/sizes',
  { query: { activeOnly: 'true' } },
)

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function pickTasks(taskIds: string[]) {
  try {
    await $fetch(`/api/orders/${orderId}/tasks`, {
      method: 'POST',
      body: { taskIds },
    })
    toast.add({ title: t('common.messages.created'), color: 'success' })
    await refresh()
    await refreshTimeline()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

async function updateTaskProgress(taskId: string, progressPct: number, notes?: string) {
  try {
    await $fetch(`/api/order-tasks/${taskId}/progress`, {
      method: 'PATCH',
      body: { progressPct, notes },
    })
    toast.add({ title: t('common.messages.updated'), color: 'success' })
    await refresh()
    await refreshTimeline()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

async function removeTask(taskId: string) {
  if (!data.value) return
  // Use setOrderTasks with the taskId removed.
  const remaining = data.value.order.tasks.filter((t) => t.id !== taskId)
  try {
    await $fetch(`/api/orders/${orderId}/tasks`, {
      method: 'PUT',
      body: {
        items: remaining.map((t) => ({
          id: t.id,
          taskId: t.taskId,
          nameSnapshot: t.nameSnapshot,
          descriptionSnapshot: t.descriptionSnapshot,
          progressPct: t.progressPct,
          notes: t.notes,
        })),
      },
    })
    toast.add({ title: t('common.messages.deleted'), color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

async function setItems(items: Array<{ sizeId: string, ratio: number }>) {
  try {
    await $fetch(`/api/orders/${orderId}/items`, {
      method: 'PUT',
      body: { items },
    })
    toast.add({ title: t('common.messages.saved'), color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

const itemsLocal = ref<Array<{ sizeId: string, ratio: number }>>([])
watch(
  () => data.value?.order.items,
  (items) => {
    if (items) {
      itemsLocal.value = items.map((i) => ({ sizeId: i.sizeId, ratio: i.ratio }))
    }
  },
  { immediate: true },
)

async function onCancelOrder() {
  if (!data.value) return
  const reason = prompt(t('orders.cancelReason')) ?? undefined
  if (!confirm(t('orders.cancelConfirm', { code: data.value.order.code }))) return
  try {
    await $fetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      body: { version: data.value.order.version, reason },
    })
    toast.add({ title: t('common.messages.updated'), color: 'success' })
    await refresh()
    await refreshTimeline()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

async function onDeleteOrder() {
  if (!data.value) return
  if (!confirm(t('orders.deleteConfirm', { code: data.value.order.code }))) return
  try {
    await $fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
    toast.add({ title: t('common.messages.deleted'), color: 'success' })
    await navigateTo('/orders')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

const tabItems = computed(() => [
  { value: 'tasks', label: t('orders.tabs.tasks'), icon: 'i-lucide-list-checks' },
  { value: 'items', label: t('orders.tabs.items'), icon: 'i-lucide-ruler' },
  { value: 'info', label: t('orders.tabs.info'), icon: 'i-lucide-info' },
  { value: 'timeline', label: t('orders.tabs.timeline'), icon: 'i-lucide-history' },
])
</script>

<template>
  <div v-if="data?.order" class="p-4 md:p-6 max-w-5xl">
    <UButton
      variant="ghost"
      size="sm"
      icon="i-lucide-arrow-left"
      class="mb-4"
      @click="navigateTo('/orders')"
    >
      {{ t('common.actions.backToList') }}
    </UButton>

    <!-- Header -->
    <header class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div class="min-w-0 flex items-start gap-3">
        <div class="w-14 h-14 shrink-0 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
          <img v-if="data.order.styleVariant.imageUrl" :src="`/storage/${data.order.styleVariant.imageUrl}`" class="w-full h-full object-cover" alt="">
          <UIcon v-else name="i-lucide-shirt" class="w-6 h-6 text-gray-400" />
        </div>
        <div class="min-w-0">
          <div class="font-mono text-xs text-gray-500">
            {{ data.order.code }}
          </div>
          <h1 class="text-xl md:text-2xl font-semibold break-words">
            {{ data.order.styleVariant.style.code }} — {{ data.order.styleVariant.name }}
          </h1>
          <div class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {{ data.order.styleVariant.style.name }}
          </div>
          <div class="flex items-center gap-2 mt-2">
            <OrdersOrderStatusBadge :status="data.order.status" />
            <UBadge v-if="data.order.priority !== 'NORMAL'" color="warning" variant="soft" size="sm">
              {{ t(`orders.priority.${data.order.priority}`) }}
            </UBadge>
          </div>
        </div>
      </div>
      <div class="shrink-0 flex items-center gap-1">
        <UButton
          v-if="data.order.status !== 'CANCELLED' && data.order.status !== 'COMPLETED'"
          variant="outline"
          color="warning"
          size="sm"
          icon="i-lucide-x-circle"
          @click="onCancelOrder"
        >
          {{ t('orders.actions.cancel') }}
        </UButton>
        <UButton
          variant="ghost"
          color="error"
          size="sm"
          icon="i-lucide-trash-2"
          @click="onDeleteOrder"
        />
      </div>
    </header>

    <!-- Progress overview -->
    <UCard class="mb-5">
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <div class="flex-1">
          <div class="text-xs text-gray-500 mb-1">
            {{ t('orders.fields.totalProgress') }}
          </div>
          <OrdersOrderProgressBar :value="data.order.progressPct" size="md" />
        </div>
        <div class="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div class="text-xs text-gray-500">
              {{ t('orders.fields.orderedAt') }}
            </div>
            <div class="tabular-nums">
              {{ formatDate(data.order.orderedAt) }}
            </div>
          </div>
          <div>
            <div class="text-xs text-gray-500">
              {{ t('orders.fields.expectedAt') }}
            </div>
            <div class="tabular-nums">
              {{ formatDate(data.order.expectedAt) }}
            </div>
          </div>
          <div>
            <div class="text-xs text-gray-500">
              {{ t('orders.fields.actualAt') }}
            </div>
            <div class="tabular-nums">
              {{ formatDate(data.order.actualAt) }}
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Tabs -->
    <UTabs v-model="tab" :items="tabItems" class="mb-4" />

    <!-- Tasks tab -->
    <section v-if="tab === 'tasks'">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base md:text-lg font-medium">
          {{ t('orders.tasks.title') }} ({{ data.order.tasks.length }})
        </h2>
        <UButton
          v-if="data.order.status !== 'CANCELLED'"
          size="sm"
          icon="i-lucide-plus"
          @click="taskPickerOpen = true"
        >
          {{ t('orders.tasks.pickTasks') }}
        </UButton>
      </div>

      <OrdersOrderTaskStepper
        :tasks="data.order.tasks"
        :readonly="data.order.status === 'CANCELLED'"
        @update-progress="updateTaskProgress"
        @remove="removeTask"
      />

      <OrdersTaskPicker v-model:open="taskPickerOpen" @pick="pickTasks" />
    </section>

    <!-- Items tab -->
    <section v-if="tab === 'items'">
      <UCard>
        <template #header>
          <div>
            <div class="font-medium">
              {{ t('orders.items.title') }}
            </div>
            <div class="text-xs text-gray-500">
              {{ t('orders.items.subtitle') }}
            </div>
          </div>
        </template>

        <OrdersOrderItemsEditor
          v-model="itemsLocal"
          :sizes="sizesData?.items ?? []"
        />

        <template #footer>
          <div class="flex justify-end">
            <UButton size="sm" :disabled="data.order.status === 'CANCELLED'" @click="setItems(itemsLocal)">
              {{ t('common.actions.save') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </section>

    <!-- Info tab -->
    <section v-if="tab === 'info'">
      <UCard>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt class="text-xs text-gray-500">
              {{ t('orders.fields.code') }}
            </dt>
            <dd class="font-mono">
              {{ data.order.code }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500">
              {{ t('orders.fields.owner') }}
            </dt>
            <dd>
              {{ data.order.owner.name }} ({{ data.order.owner.email }})
            </dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-xs text-gray-500">
              {{ t('orders.fields.notes') }}
            </dt>
            <dd class="whitespace-pre-line">
              {{ data.order.notes ?? '—' }}
            </dd>
          </div>
        </dl>
      </UCard>
    </section>

    <!-- Timeline tab -->
    <section v-if="tab === 'timeline'">
      <UCard>
        <ol class="space-y-3">
          <li
            v-for="entry in timelineData?.items ?? []"
            :key="entry.id"
            class="flex items-start gap-3 pb-3 border-b last:border-0 border-gray-200 dark:border-gray-800"
          >
            <UIcon name="i-lucide-circle" class="w-3 h-3 mt-1 text-blue-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-sm">
                <span v-if="entry.fromStatus && entry.toStatus" class="font-medium">
                  {{ t(`orders.status.${entry.fromStatus}` as never) }} → {{ t(`orders.status.${entry.toStatus}` as never) }}
                </span>
                <span v-else class="font-medium">{{ t(`orders.status.${entry.toStatus}` as never) }}</span>
              </div>
              <div v-if="entry.note" class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {{ entry.note }}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ entry.createdBy.name }} · {{ formatDateTime(entry.createdAt) }}
              </div>
            </div>
          </li>
          <li v-if="!timelineData?.items.length" class="text-center text-sm text-gray-500 py-6">
            {{ t('orders.timeline.noEntries') }}
          </li>
        </ol>
      </UCard>
    </section>
  </div>
</template>
