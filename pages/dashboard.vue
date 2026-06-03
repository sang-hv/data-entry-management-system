<script setup lang="ts">
interface DashboardStats {
  running: number
  overdue: number
  dueSoon: number
  openAlerts: number
}

interface RecentOrder {
  id: string
  code: string
  status: string
  progressPct: number
  expectedAt: string | null
  styleCode: string
  variantName: string
  imageUrl: string | null
  openAlertCount: number
  topAlerts: Array<{ severity: string; ruleCode: string; message: string }>
}

const { user } = useAuth()
const { t } = useI18n()

const { data, refresh } = await useFetch<{ stats: DashboardStats; recentOrders: RecentOrder[] }>(
  '/api/dashboard/stats',
)

// Refresh every 60s
onMounted(() => {
  const timer = setInterval(() => refresh(), 60_000)
  onUnmounted(() => clearInterval(timer))
})

const statCards = computed(() => {
  const s = data.value?.stats
  return [
    { label: t('dashboard.stats.running'), value: s?.running ?? '—', icon: 'i-lucide-package', color: 'text-blue-600 dark:text-blue-400' },
    { label: t('dashboard.stats.overdue'), value: s?.overdue ?? '—', icon: 'i-lucide-alert-circle', color: 'text-red-600 dark:text-red-400' },
    { label: t('dashboard.stats.dueSoon'), value: s?.dueSoon ?? '—', icon: 'i-lucide-clock', color: 'text-yellow-600 dark:text-yellow-400' },
    { label: t('dashboard.stats.openAlerts'), value: s?.openAlerts ?? '—', icon: 'i-lucide-bell', color: 'text-orange-600 dark:text-orange-400' },
  ]
})

function severityColor(sev: string) {
  if (sev === 'CRITICAL') return 'error'
  if (sev === 'WARN') return 'warning'
  return 'neutral'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isOverdue(order: RecentOrder) {
  if (!order.expectedAt) return false
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return false
  return new Date(order.expectedAt) < new Date()
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl">
    <header class="mb-5">
      <h1 class="text-xl md:text-2xl font-semibold">
        {{ t('nav.dashboard') }}
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('dashboard.greeting', { name: user?.name }) }}
      </p>
    </header>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      <UCard v-for="stat in statCards" :key="stat.label" class="cursor-default">
        <div class="flex items-center gap-3">
          <UIcon :name="stat.icon" :class="['w-8 h-8 shrink-0', stat.color]" />
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ stat.label }}
            </div>
            <div class="text-2xl font-semibold tabular-nums">
              {{ stat.value }}
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Orders needing attention -->
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-base font-medium">
        {{ t('dashboard.needsAttention') }}
      </h2>
      <div class="flex gap-2">
        <UButton size="xs" variant="ghost" icon="i-lucide-bell" @click="navigateTo('/alerts')">
          {{ t('dashboard.viewAllAlerts') }}
        </UButton>
        <UButton size="xs" variant="ghost" icon="i-lucide-package" @click="navigateTo('/orders')">
          {{ t('dashboard.viewAllOrders') }}
        </UButton>
      </div>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div v-if="!(data?.recentOrders ?? []).length" class="p-8 text-center text-sm text-gray-500">
        {{ t('dashboard.noAttentionNeeded') }}
      </div>
      <ul v-else class="divide-y divide-gray-200 dark:divide-gray-800">
        <li
          v-for="order in data?.recentOrders ?? []"
          :key="order.id"
          class="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
          @click="navigateTo(`/orders/${order.id}`)"
        >
          <!-- Thumbnail -->
          <div class="w-10 h-10 shrink-0 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
            <img v-if="order.imageUrl" :src="`/storage/${order.imageUrl}`" class="w-full h-full object-cover" alt="">
            <UIcon v-else name="i-lucide-shirt" class="w-4 h-4 text-gray-400" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center flex-wrap gap-1.5">
              <span class="font-mono text-xs text-gray-500">{{ order.code }}</span>
              <span class="text-sm font-medium truncate">{{ order.styleCode }} — {{ order.variantName }}</span>
              <UBadge v-if="isOverdue(order)" color="error" variant="soft" size="xs">Trễ</UBadge>
            </div>
            <!-- Top alerts -->
            <div class="flex flex-wrap gap-1 mt-1">
              <UBadge
                v-for="alert in order.topAlerts"
                :key="alert.ruleCode"
                :color="severityColor(alert.severity)"
                variant="soft"
                size="xs"
              >
                {{ t(`alerts.rules.${alert.ruleCode}` as never, alert.ruleCode) }}
              </UBadge>
            </div>
          </div>

          <div class="shrink-0 text-right text-xs text-gray-500">
            <div>{{ formatDate(order.expectedAt) }}</div>
            <div class="mt-1 tabular-nums font-medium">{{ order.progressPct }}%</div>
          </div>
        </li>
      </ul>
    </UCard>
  </div>
</template>
