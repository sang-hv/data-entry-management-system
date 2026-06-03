<script setup lang="ts">
interface OrderRow {
  id: string
  code: string
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  progressPct: number
  orderedAt: string | null
  expectedAt: string | null
  styleCode: string
  styleName: string
  variantName: string
  thumbnailUrl: string | null
  taskCount: number
  itemCount: number
  updatedAt: string
}

const { t } = useI18n()
const q = ref('')
const debouncedQ = useDebouncedRef(q, 350)
const statusFilter = ref<string[]>([])

const { data, pending } = await useFetch<{ items: OrderRow[], total: number }>(
  '/api/orders',
  {
    query: computed(() => {
      // 'OVERDUE' is a pseudo-value — maps to overdue=true query param, not a real status
      const hasOverdue = statusFilter.value.includes('OVERDUE')
      const realStatuses = statusFilter.value.filter((s) => s !== 'OVERDUE')
      return {
        q: debouncedQ.value || undefined,
        status: realStatuses.length ? realStatuses.join(',') : undefined,
        overdue: hasOverdue ? 'true' : undefined,
      }
    }),
  },
)

const statusOptions = [
  { value: 'DRAFT', label: t('orders.status.DRAFT') },
  { value: 'ACTIVE', label: t('orders.status.ACTIVE') },
  { value: 'COMPLETED', label: t('orders.status.COMPLETED') },
  { value: 'CANCELLED', label: t('orders.status.CANCELLED') },
  { value: 'OVERDUE', label: t('orders.status.OVERDUE') },
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function isOverdue(row: OrderRow) {
  if (!row.expectedAt) return false
  if (row.status === 'COMPLETED' || row.status === 'CANCELLED') return false
  return new Date(row.expectedAt) < new Date()
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-7xl">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl md:text-2xl font-semibold">
          {{ t('orders.title') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('orders.subtitle') }}
        </p>
      </div>
      <UButton icon="i-lucide-plus" class="self-start" @click="navigateTo('/orders/new')">
        {{ t('orders.addOrder') }}
      </UButton>
    </header>

    <div class="flex flex-col sm:flex-row gap-2 mb-4">
      <UInput
        v-model="q"
        :placeholder="t('orders.searchPlaceholder')"
        icon="i-lucide-search"
        class="flex-1 sm:max-w-md"
      />
      <USelectMenu
        v-model="statusFilter"
        :items="statusOptions"
        value-key="value"
        multiple
        :placeholder="t('common.labels.status')"
        class="sm:w-48"
      />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Loading skeleton -->
      <div v-if="pending" class="p-6 flex justify-center">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-gray-400" />
      </div>

      <template v-else>
      <!-- Mobile -->
      <div class="md:hidden divide-y divide-gray-200 dark:divide-gray-800">
        <NuxtLink
          v-for="row in data?.items ?? []"
          :key="row.id"
          :to="`/orders/${row.id}`"
          class="block p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 shrink-0 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
              <img v-if="row.thumbnailUrl" :src="`/storage/${row.thumbnailUrl}`" class="w-full h-full object-cover" alt="">
              <UIcon v-else name="i-lucide-shirt" class="w-5 h-5 text-gray-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs text-gray-500">{{ row.code }}</span>
                <OrdersOrderStatusBadge :status="row.status" size="xs" />
                <UBadge v-if="isOverdue(row)" color="error" variant="soft" size="xs">
                  Trễ
                </UBadge>
              </div>
              <div class="font-medium truncate text-sm">
                {{ row.styleCode }} — {{ row.variantName }}
              </div>
              <div class="text-xs text-gray-500 truncate">
                {{ row.styleName }}
              </div>
              <div class="mt-2">
                <OrdersOrderProgressBar :value="row.progressPct" size="xs" />
              </div>
              <div class="text-xs text-gray-500 mt-1 flex justify-between">
                <span>{{ row.taskCount }} công đoạn · {{ row.itemCount }} size</span>
                <span>{{ formatDate(row.expectedAt) }}</span>
              </div>
            </div>
          </div>
        </NuxtLink>
        <div v-if="!(data?.items ?? []).length" class="p-8 text-center text-sm text-gray-500">
          {{ t('orders.empty') }}
        </div>
      </div>

      <!-- Desktop -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-4 py-2 font-medium w-12" />
              <th class="px-4 py-2 font-medium w-36">
                {{ t('orders.table.code') }}
              </th>
              <th class="px-4 py-2 font-medium">
                {{ t('orders.table.style') }}
              </th>
              <th class="px-4 py-2 font-medium w-28">
                {{ t('orders.table.status') }}
              </th>
              <th class="px-4 py-2 font-medium w-44">
                {{ t('orders.table.progress') }}
              </th>
              <th class="px-4 py-2 font-medium w-28">
                {{ t('orders.table.deadline') }}
              </th>
              <th class="px-4 py-2 font-medium w-20 text-center">
                {{ t('orders.table.tasks') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            <tr
              v-for="row in data?.items ?? []"
              :key="row.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
              @click="navigateTo(`/orders/${row.id}`)"
            >
              <td class="px-4 py-2">
                <div class="w-9 h-9 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
                  <img v-if="row.thumbnailUrl" :src="`/storage/${row.thumbnailUrl}`" class="w-full h-full object-cover" alt="">
                  <UIcon v-else name="i-lucide-shirt" class="w-4 h-4 text-gray-400" />
                </div>
              </td>
              <td class="px-4 py-2 font-mono text-xs">
                {{ row.code }}
              </td>
              <td class="px-4 py-2">
                <div class="font-medium truncate">
                  {{ row.styleCode }} — {{ row.variantName }}
                </div>
                <div class="text-xs text-gray-500 truncate">
                  {{ row.styleName }}
                </div>
              </td>
              <td class="px-4 py-2">
                <OrdersOrderStatusBadge :status="row.status" size="sm" />
                <UBadge v-if="isOverdue(row)" color="error" variant="soft" size="xs" class="ml-1">
                  Trễ
                </UBadge>
              </td>
              <td class="px-4 py-2">
                <OrdersOrderProgressBar :value="row.progressPct" size="sm" />
              </td>
              <td class="px-4 py-2 text-xs text-gray-500 tabular-nums">
                {{ formatDate(row.expectedAt) }}
              </td>
              <td class="px-4 py-2 text-center text-xs tabular-nums">
                {{ row.taskCount }}
              </td>
            </tr>
            <tr v-if="!(data?.items ?? []).length">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-gray-500">
                {{ t('orders.empty') }}.
                <UButton variant="link" @click="navigateTo('/orders/new')">
                  {{ t('orders.createFirst') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </template>
    </UCard>
  </div>
</template>
