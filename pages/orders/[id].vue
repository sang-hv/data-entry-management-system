<script setup lang="ts">
interface OrderTask {
  id: string
  taskId: string | null
  nameSnapshot: string
  descriptionSnapshot: string | null
  position: number
  done: boolean
  notes: string | null
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
  items: Array<{ id: string, sizeId: string, ratio: number, size: { id: string, code: string, label: string } }>
  tasks: OrderTask[]
  batches: Array<{
    id: string
    orderId: string
    batchNumber: number
    batchedAt: string
    note: string | null
    deletedAt: string | null
    items: Array<{ id: string, sizeId: string, quantity: number, size: { id: string, code: string, label: string } }>
  }>
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

interface OrderAlert {
  id: string
  ruleCode: string
  severity: 'CRITICAL' | 'WARN' | 'INFO'
  message: string
  status: string
  triggeredAt: string
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
const { data: alertsData, refresh: refreshAlerts } = await useFetch<{ items: OrderAlert[]; total: number }>(
  '/api/alerts',
  { query: { orderId } },
)
const { data: sizesData } = await useFetch<{ items: Array<{ id: string, code: string, label: string }> }>(
  '/api/sizes',
  { query: { activeOnly: 'true' } },
)

const tab = ref<'info' | 'items' | 'tasks' | 'alerts' | 'timeline'>('tasks')
const taskPickerOpen = ref(false)

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Tasks ────────────────────────────────────────────────────────────────────
async function pickTasks(taskIds: string[]) {
  try {
    await $fetch(`/api/orders/${orderId}/tasks`, { method: 'POST', body: { taskIds } })
    toast.add({ title: t('common.messages.created'), color: 'success' })
    await refresh()
    await refreshTimeline()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

async function updateTaskDone(taskId: string, done: boolean, notes?: string) {
  try {
    await $fetch(`/api/order-tasks/${taskId}/done`, { method: 'PATCH', body: { done, notes } })
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
  const remaining = data.value.order.tasks.filter((t) => t.id !== taskId)
  try {
    await $fetch(`/api/orders/${orderId}/tasks`, {
      method: 'PUT',
      body: {
        items: remaining.map((t) => ({
          id: t.id, taskId: t.taskId, nameSnapshot: t.nameSnapshot,
          descriptionSnapshot: t.descriptionSnapshot, done: t.done, notes: t.notes,
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

// ── Items ────────────────────────────────────────────────────────────────────
const itemsLocal = ref<Array<{ sizeId: string, ratio: number }>>([])
const itemsSaving = ref(false)

watch(
  () => data.value?.order.items,
  (items) => { if (items) itemsLocal.value = items.map((i) => ({ sizeId: i.sizeId, ratio: i.ratio })) },
  { immediate: true },
)

async function setItems(items: Array<{ sizeId: string, ratio: number }>) {
  itemsSaving.value = true
  try {
    await $fetch(`/api/orders/${orderId}/items`, { method: 'PUT', body: { items } })
    toast.add({ title: t('common.messages.saved'), color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
  finally { itemsSaving.value = false }
}

// ── Order actions ────────────────────────────────────────────────────────────
const cancellingOrder = ref(false)
const deletingOrder = ref(false)

async function onCancelOrder() {
  if (!data.value) return
  const reason = prompt(t('orders.cancelReason')) ?? undefined
  if (!confirm(t('orders.cancelConfirm', { code: data.value.order.code }))) return
  cancellingOrder.value = true
  try {
    await $fetch(`/api/orders/${orderId}/cancel`, { method: 'POST', body: { version: data.value.order.version, reason } })
    toast.add({ title: t('common.messages.updated'), color: 'success' })
    await refresh()
    await refreshTimeline()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
  finally { cancellingOrder.value = false }
}

async function onDeleteOrder() {
  if (!data.value) return
  if (!confirm(t('orders.deleteConfirm', { code: data.value.order.code }))) return
  deletingOrder.value = true
  try {
    await $fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
    toast.add({ title: t('common.messages.deleted'), color: 'success' })
    await navigateTo('/orders')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
  finally { deletingOrder.value = false }
}

// ── Info edit form ────────────────────────────────────────────────────────────
const infoForm = reactive({
  orderedAt: '',
  expectedAt: '',
  priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
  notes: '',
})
const infoSaving = ref(false)

watch(
  () => data.value?.order,
  (order) => {
    if (!order) return
    infoForm.orderedAt = order.orderedAt ? order.orderedAt.split('T')[0]! : ''
    infoForm.expectedAt = order.expectedAt ? order.expectedAt.split('T')[0]! : ''
    infoForm.priority = order.priority
    infoForm.notes = order.notes ?? ''
  },
  { immediate: true },
)

const priorityOptions = [
  { value: 'LOW', label: t('orders.priority.LOW') },
  { value: 'NORMAL', label: t('orders.priority.NORMAL') },
  { value: 'HIGH', label: t('orders.priority.HIGH') },
  { value: 'URGENT', label: t('orders.priority.URGENT') },
]

async function saveInfo() {
  if (!data.value) return
  infoSaving.value = true
  try {
    await $fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      body: {
        version: data.value.order.version,
        patch: {
          orderedAt: infoForm.orderedAt || null,
          expectedAt: infoForm.expectedAt || null,
          priority: infoForm.priority,
          notes: infoForm.notes || null,
        },
      },
    })
    toast.add({ title: t('common.messages.saved'), color: 'success' })
    await refresh()
    await refreshTimeline()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
  finally { infoSaving.value = false }
}

// ── Alerts ────────────────────────────────────────────────────────────────────
function alertSeverityColor(sev: string) {
  if (sev === 'CRITICAL') return 'error'
  if (sev === 'WARN') return 'warning'
  return 'neutral'
}

async function dismissOrderAlert(alertId: string) {
  try {
    await $fetch(`/api/alerts/${alertId}/dismiss`, { method: 'POST' })
    toast.add({ title: t('common.messages.updated'), color: 'success' })
    await refreshAlerts()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

const tabItems = computed(() => [
  { value: 'tasks', label: t('orders.tabs.tasks'), icon: 'i-lucide-list-checks' },
  { value: 'items', label: t('orders.tabs.items'), icon: 'i-lucide-ruler' },
  { value: 'alerts', label: t('orders.tabs.alerts'), icon: 'i-lucide-bell' },
  { value: 'info', label: t('orders.tabs.info'), icon: 'i-lucide-info' },
  { value: 'timeline', label: t('orders.tabs.timeline'), icon: 'i-lucide-history' },
])
</script>

<template>
  <!-- Loading skeleton -->
  <div v-if="!data?.order" class="p-4 md:p-6 max-w-5xl">
    <div class="animate-pulse space-y-4">
      <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
      <div class="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
      <div class="h-28 bg-gray-200 dark:bg-gray-700 rounded" />
      <div class="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  </div>

  <div v-else class="p-4 md:p-6 max-w-5xl">
    <UButton variant="ghost" size="sm" icon="i-lucide-arrow-left" class="mb-4" @click="navigateTo('/orders')">
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
          :loading="cancellingOrder"
          @click="onCancelOrder"
        >
          {{ t('orders.actions.cancel') }}
        </UButton>
        <UButton
          variant="ghost"
          color="error"
          size="sm"
          icon="i-lucide-trash-2"
          :loading="deletingOrder"
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
        @set-done="updateTaskDone"
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
        <OrdersOrderItemsEditor v-model="itemsLocal" :sizes="sizesData?.items ?? []" />
        <template #footer>
          <div class="flex justify-end">
            <UButton
              size="sm"
              :loading="itemsSaving"
              :disabled="data.order.status === 'CANCELLED'"
              @click="setItems(itemsLocal)"
            >
              {{ t('common.actions.save') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </section>

    <!-- Info tab -->
    <section v-if="tab === 'info'">
      <UCard>
        <template #header>
          <div class="font-medium">
            {{ t('orders.fields.editInfo') }}
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div class="text-xs text-gray-500 mb-0.5">
              {{ t('orders.fields.code') }}
            </div>
            <div class="font-mono text-sm">
              {{ data.order.code }}
            </div>
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-0.5">
              {{ t('orders.fields.owner') }}
            </div>
            <div class="text-sm">
              {{ data.order.owner.name }}
            </div>
          </div>
          <UFormField :label="t('orders.fields.orderedAt')">
            <UInput v-model="infoForm.orderedAt" type="date" class="w-full" :disabled="data.order.status === 'CANCELLED'" />
          </UFormField>
          <UFormField :label="t('orders.fields.expectedAt')">
            <UInput v-model="infoForm.expectedAt" type="date" class="w-full" :disabled="data.order.status === 'CANCELLED'" />
          </UFormField>
          <UFormField :label="t('orders.fields.priority')">
            <USelect v-model="infoForm.priority" :items="priorityOptions" class="w-full" :disabled="data.order.status === 'CANCELLED'" />
          </UFormField>
          <UFormField :label="t('orders.fields.notes')" class="sm:col-span-2">
            <UTextarea v-model="infoForm.notes" :rows="3" class="w-full" :disabled="data.order.status === 'CANCELLED'" />
          </UFormField>
        </div>
        <template #footer>
          <div class="flex justify-end">
            <UButton size="sm" :loading="infoSaving" :disabled="data.order.status === 'CANCELLED'" @click="saveInfo">
              {{ t('common.actions.save') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </section>

    <!-- Alerts tab -->
    <section v-if="tab === 'alerts'">
      <div
        v-if="!(alertsData?.items ?? []).length"
        class="p-6 text-center text-sm text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded"
      >
        {{ t('alerts.noAlerts') }}
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="alert in alertsData?.items ?? []"
          :key="alert.id"
          class="flex items-start gap-3 p-3 rounded border"
          :class="{
            'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20': alert.severity === 'CRITICAL',
            'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20': alert.severity === 'WARN',
            'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/30': alert.severity === 'INFO',
          }"
        >
          <UBadge :color="alertSeverityColor(alert.severity)" variant="soft" size="xs" class="shrink-0 mt-0.5">
            {{ t(`alerts.severity.${alert.severity}` as never) }}
          </UBadge>
          <p class="flex-1 text-sm">
            {{ alert.message }}
          </p>
          <UButton v-if="alert.status === 'OPEN'" size="xs" variant="ghost" @click="dismissOrderAlert(alert.id)">
            {{ t('alerts.dismissBtn') }}
          </UButton>
        </li>
      </ul>
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
