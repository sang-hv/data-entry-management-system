<script setup lang="ts">
interface SizeRow {
  id: string
  code: string
  label: string
  order: number
  active: boolean
}

const toast = useToast()
const { t } = useI18n()
const { data, refresh } = await useFetch<{ items: SizeRow[] }>('/api/sizes', {
  query: { activeOnly: 'false' },
})

const dialogOpen = ref(false)
const editing = ref<SizeRow | null>(null)
const form = reactive({ code: '', label: '', order: 0 })
const submitting = ref(false)

function openCreate() {
  editing.value = null
  form.code = ''
  form.label = ''
  form.order = data.value?.items.length ? Math.max(...data.value.items.map((s) => s.order)) + 10 : 10
  dialogOpen.value = true
}

function openEdit(row: SizeRow) {
  editing.value = row
  form.code = row.code
  form.label = row.label
  form.order = row.order
  dialogOpen.value = true
}

async function onSubmit() {
  submitting.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/sizes/${editing.value.id}`, {
        method: 'PATCH',
        body: { patch: { label: form.label, order: form.order } },
      })
      toast.add({ title: t('common.messages.updated'), color: 'success' })
    }
    else {
      await $fetch('/api/sizes', {
        method: 'POST',
        body: { code: form.code, label: form.label, order: form.order },
      })
      toast.add({ title: t('common.messages.created'), color: 'success' })
    }
    dialogOpen.value = false
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}

async function onToggleActive(row: SizeRow) {
  try {
    await $fetch(`/api/sizes/${row.id}`, {
      method: 'PATCH',
      body: { patch: { active: !row.active } },
    })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

async function onDelete(row: SizeRow) {
  if (!confirm(t('sizes.deleteConfirm', { code: row.code }))) return
  try {
    await $fetch(`/api/sizes/${row.id}`, { method: 'DELETE' })
    toast.add({ title: t('common.messages.deleted'), color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-4xl">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl md:text-2xl font-semibold">
          {{ t('sizes.title') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('sizes.subtitle') }}
        </p>
      </div>
      <UButton icon="i-lucide-plus" class="self-start" @click="openCreate">
        {{ t('sizes.addSize') }}
      </UButton>
    </header>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Mobile -->
      <ul class="md:hidden divide-y divide-gray-200 dark:divide-gray-800">
        <li v-for="row in data?.items ?? []" :key="row.id" class="flex items-center gap-3 p-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm font-medium">{{ row.code }}</span>
              <span class="text-sm text-gray-600 dark:text-gray-400 truncate">{{ row.label }}</span>
            </div>
            <div class="text-xs text-gray-500 mt-0.5">
              {{ t('sizes.fields.orderShort') }}: {{ row.order }}
            </div>
          </div>
          <USwitch :model-value="row.active" @update:model-value="onToggleActive(row)" />
          <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEdit(row)" />
          <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="onDelete(row)" />
        </li>
        <li v-if="!(data?.items ?? []).length" class="p-8 text-center text-sm text-gray-500">
          {{ t('sizes.empty') }}
        </li>
      </ul>

      <!-- Desktop -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-4 py-2 font-medium w-32">
                {{ t('common.labels.code') }}
              </th>
              <th class="px-4 py-2 font-medium">
                {{ t('common.labels.displayLabel') }}
              </th>
              <th class="px-4 py-2 font-medium w-24 text-right">
                {{ t('common.labels.order') }}
              </th>
              <th class="px-4 py-2 font-medium w-28">
                {{ t('common.labels.active') }}
              </th>
              <th class="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            <tr v-for="row in data?.items ?? []" :key="row.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td class="px-4 py-2 font-mono">
                {{ row.code }}
              </td>
              <td class="px-4 py-2">
                {{ row.label }}
              </td>
              <td class="px-4 py-2 text-right tabular-nums">
                {{ row.order }}
              </td>
              <td class="px-4 py-2">
                <USwitch :model-value="row.active" @update:model-value="onToggleActive(row)" />
              </td>
              <td class="px-4 py-2 text-right">
                <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEdit(row)" />
                <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="onDelete(row)" />
              </td>
            </tr>
            <tr v-if="!(data?.items ?? []).length">
              <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500">
                {{ t('sizes.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal v-model:open="dialogOpen" :title="editing ? t('sizes.editTitle') : t('sizes.createTitle')">
      <template #body>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField :label="t('sizes.fields.code')" required>
            <UInput v-model="form.code" :disabled="!!editing" required class="w-full" />
          </UFormField>
          <UFormField :label="t('sizes.fields.label')" required>
            <UInput v-model="form.label" required class="w-full" />
          </UFormField>
          <UFormField :label="t('sizes.fields.order')" required>
            <UInput v-model.number="form.order" type="number" min="0" required class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="dialogOpen = false">
              {{ t('common.actions.cancel') }}
            </UButton>
            <UButton type="submit" :loading="submitting">
              {{ editing ? t('common.actions.update') : t('common.actions.create') }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
