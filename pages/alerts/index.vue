<script setup lang="ts">
interface AlertItem {
  id: string
  orderId: string
  ruleCode: string
  severity: 'CRITICAL' | 'WARN' | 'INFO'
  message: string
  status: string
  triggeredAt: string
  order: {
    code: string
    styleVariant: { name: string; style: { code: string } }
  }
}

const { t } = useI18n()
const toast = useToast()
const severityFilter = ref<string[]>([])
const dismissingId = ref<string | null>(null)

const { data, refresh } = await useFetch<{ items: AlertItem[]; total: number }>(
  '/api/alerts',
  {
    query: computed(() => ({
      severity: severityFilter.value.length ? severityFilter.value.join(',') : undefined,
    })),
  },
)

const severityOptions = [
  { value: 'CRITICAL', label: t('alerts.severity.CRITICAL') },
  { value: 'WARN', label: t('alerts.severity.WARN') },
  { value: 'INFO', label: t('alerts.severity.INFO') },
]

function severityColor(sev: string) {
  if (sev === 'CRITICAL') return 'error'
  if (sev === 'WARN') return 'warning'
  return 'neutral'
}

function severityIcon(sev: string) {
  if (sev === 'CRITICAL') return 'i-lucide-alert-circle'
  if (sev === 'WARN') return 'i-lucide-alert-triangle'
  return 'i-lucide-info'
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function dismiss(alert: AlertItem) {
  const reason = prompt(t('alerts.dismissReason')) ?? undefined
  dismissingId.value = alert.id
  try {
    await $fetch(`/api/alerts/${alert.id}/dismiss`, { method: 'POST', body: { reason } })
    toast.add({ title: t('common.messages.updated'), color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    dismissingId.value = null
  }
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-4xl">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl md:text-2xl font-semibold">
          {{ t('alerts.title') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('alerts.subtitle') }}
        </p>
      </div>
      <USelectMenu
        v-model="severityFilter"
        :items="severityOptions"
        value-key="value"
        multiple
        :placeholder="t('alerts.filterSeverity')"
        class="sm:w-48"
      />
    </header>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <ul class="divide-y divide-gray-200 dark:divide-gray-800">
        <li
          v-for="alert in data?.items ?? []"
          :key="alert.id"
          class="flex items-start gap-3 p-4"
        >
          <UIcon
            :name="severityIcon(alert.severity)"
            :class="['w-5 h-5 mt-0.5 shrink-0', {
              'text-red-500': alert.severity === 'CRITICAL',
              'text-yellow-500': alert.severity === 'WARN',
              'text-gray-400': alert.severity === 'INFO',
            }]"
          />

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <UBadge :color="severityColor(alert.severity)" variant="soft" size="xs">
                {{ t(`alerts.severity.${alert.severity}` as never) }}
              </UBadge>
              <NuxtLink
                :to="`/orders/${alert.orderId}`"
                class="font-mono text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                {{ alert.order.code }}
              </NuxtLink>
              <span class="text-xs text-gray-500">{{ alert.order.styleVariant.style.code }} — {{ alert.order.styleVariant.name }}</span>
            </div>
            <p class="text-sm mt-1">
              {{ alert.message }}
            </p>
            <p class="text-xs text-gray-500 mt-0.5">
              {{ formatDateTime(alert.triggeredAt) }}
            </p>
          </div>

          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            :loading="dismissingId === alert.id"
            @click="dismiss(alert)"
          >
            {{ t('alerts.dismissBtn') }}
          </UButton>
        </li>

        <li v-if="!(data?.items ?? []).length" class="p-8 text-center text-sm text-gray-500">
          {{ t('alerts.noAlerts') }}
        </li>
      </ul>
    </UCard>
  </div>
</template>
