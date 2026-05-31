<script setup lang="ts">
interface SizeRow {
  id: string
  code: string
  label: string
}

const { t } = useI18n()
const toast = useToast()

const { data: sizesData } = await useFetch<{ items: SizeRow[] }>('/api/sizes', {
  query: { activeOnly: 'true' },
})

const form = reactive({
  code: '',
  styleVariantId: null as string | null,
  orderedAt: '' as string,
  expectedAt: '' as string,
  priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
  notes: '',
  items: [] as Array<{ sizeId: string, ratio: number }>,
})

const submitting = ref(false)

const priorityOptions = [
  { value: 'LOW', label: t('orders.priority.LOW') },
  { value: 'NORMAL', label: t('orders.priority.NORMAL') },
  { value: 'HIGH', label: t('orders.priority.HIGH') },
  { value: 'URGENT', label: t('orders.priority.URGENT') },
]

async function onSubmit() {
  if (!form.styleVariantId) {
    toast.add({ title: t('orders.fields.stylePicker'), color: 'error' })
    return
  }
  submitting.value = true
  try {
    const result = await $fetch<{ order: { id: string, code: string } }>(
      '/api/orders',
      {
        method: 'POST',
        body: {
          code: form.code || undefined,
          styleVariantId: form.styleVariantId,
          orderedAt: form.orderedAt || undefined,
          expectedAt: form.expectedAt || undefined,
          priority: form.priority,
          notes: form.notes || undefined,
          items: form.items.length ? form.items : undefined,
        },
      },
    )
    toast.add({ title: t('common.messages.created'), color: 'success' })
    await navigateTo(`/orders/${result.order.id}`)
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-3xl">
    <UButton
      variant="ghost"
      size="sm"
      icon="i-lucide-arrow-left"
      class="mb-4"
      @click="navigateTo('/orders')"
    >
      {{ t('common.actions.backToList') }}
    </UButton>

    <header class="mb-5">
      <h1 class="text-xl md:text-2xl font-semibold">
        {{ t('orders.newOrder') }}
      </h1>
    </header>

    <form class="space-y-5" @submit.prevent="onSubmit">
      <UCard>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('orders.fields.code')" :hint="t('orders.fields.codeHint')">
            <UInput v-model="form.code" placeholder="TN-20260515-0001" class="w-full" />
          </UFormField>
          <UFormField :label="t('orders.fields.priority')">
            <USelect
              v-model="form.priority"
              :items="priorityOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('orders.fields.styleVariant')" required class="sm:col-span-2">
            <OrdersStylePicker v-model="form.styleVariantId" />
          </UFormField>
          <UFormField :label="t('orders.fields.orderedAt')">
            <UInput v-model="form.orderedAt" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('orders.fields.expectedAt')">
            <UInput v-model="form.expectedAt" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('orders.fields.notes')" class="sm:col-span-2">
            <UTextarea v-model="form.notes" :rows="3" class="w-full" />
          </UFormField>
        </div>
      </UCard>

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
        <OrdersOrderItemsEditor v-model="form.items" :sizes="sizesData?.items ?? []" />
      </UCard>

      <div class="flex justify-end gap-2">
        <UButton variant="ghost" @click="navigateTo('/orders')">
          {{ t('common.actions.cancel') }}
        </UButton>
        <UButton type="submit" :loading="submitting" icon="i-lucide-check">
          {{ t('common.actions.create') }}
        </UButton>
      </div>
    </form>
  </div>
</template>
