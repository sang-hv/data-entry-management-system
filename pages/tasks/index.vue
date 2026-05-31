<script setup lang="ts">
interface TaskRow {
  id: string
  code: string | null
  name: string
  description: string | null
  active: boolean
}

const toast = useToast()
const { t } = useI18n()
const q = ref('')
const dialogOpen = ref(false)
const editing = ref<TaskRow | null>(null)
const form = reactive({ code: '', name: '', description: '' })
const submitting = ref(false)

const { data, refresh } = await useFetch<{ items: TaskRow[] }>('/api/tasks', {
  query: { q, activeOnly: 'false' },
})

function openCreate() {
  editing.value = null
  form.code = ''
  form.name = ''
  form.description = ''
  dialogOpen.value = true
}

function openEdit(row: TaskRow) {
  editing.value = row
  form.code = row.code ?? ''
  form.name = row.name
  form.description = row.description ?? ''
  dialogOpen.value = true
}

async function onSubmit() {
  submitting.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/tasks/${editing.value.id}`, {
        method: 'PATCH',
        body: { patch: { name: form.name, description: form.description || null } },
      })
      toast.add({ title: t('common.messages.updated'), color: 'success' })
    }
    else {
      await $fetch('/api/tasks', {
        method: 'POST',
        body: {
          code: form.code || undefined,
          name: form.name,
          description: form.description || undefined,
        },
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

async function onToggleActive(row: TaskRow) {
  try {
    await $fetch(`/api/tasks/${row.id}`, {
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

async function onDelete(row: TaskRow) {
  if (!confirm(t('tasks.deleteConfirm', { name: row.name }))) return
  try {
    await $fetch(`/api/tasks/${row.id}`, { method: 'DELETE' })
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
          {{ t('tasks.title') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('tasks.subtitle') }}
        </p>
      </div>
      <UButton icon="i-lucide-plus" class="self-start" @click="openCreate">
        {{ t('tasks.addTask') }}
      </UButton>
    </header>

    <div class="mb-4">
      <UInput
        v-model="q"
        :placeholder="t('common.actions.search')"
        icon="i-lucide-search"
        class="w-full sm:max-w-md"
      />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Mobile -->
      <ul class="md:hidden divide-y divide-gray-200 dark:divide-gray-800">
        <li v-for="row in data?.items ?? []" :key="row.id" class="flex items-center gap-3 p-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span v-if="row.code" class="font-mono text-xs text-gray-500">{{ row.code }}</span>
              <span class="text-sm font-medium truncate">{{ row.name }}</span>
            </div>
            <div v-if="row.description" class="text-xs text-gray-500 mt-0.5 line-clamp-1">
              {{ row.description }}
            </div>
          </div>
          <USwitch :model-value="row.active" @update:model-value="onToggleActive(row)" />
          <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEdit(row)" />
          <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="onDelete(row)" />
        </li>
        <li v-if="!(data?.items ?? []).length" class="p-8 text-center text-sm text-gray-500">
          {{ t('tasks.empty') }}
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
              <th class="px-4 py-2 font-medium w-64">
                {{ t('common.labels.name') }}
              </th>
              <th class="px-4 py-2 font-medium">
                {{ t('common.labels.description') }}
              </th>
              <th class="px-4 py-2 font-medium w-28">
                {{ t('common.labels.active') }}
              </th>
              <th class="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            <tr v-for="row in data?.items ?? []" :key="row.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td class="px-4 py-2 font-mono text-xs">
                {{ row.code ?? '—' }}
              </td>
              <td class="px-4 py-2 font-medium">
                {{ row.name }}
              </td>
              <td class="px-4 py-2 text-gray-600 dark:text-gray-400 max-w-md truncate">
                {{ row.description ?? '' }}
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
                {{ t('tasks.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal v-model:open="dialogOpen" :title="editing ? t('tasks.editTitle') : t('tasks.createTitle')">
      <template #body>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField :label="t('tasks.fields.code')">
            <UInput v-model="form.code" :disabled="!!editing" class="w-full" placeholder="CUT" />
          </UFormField>
          <UFormField :label="t('tasks.fields.name')" required>
            <UInput
              v-model="form.name"
              required
              class="w-full"
              :placeholder="t('tasks.fields.namePlaceholder')"
            />
          </UFormField>
          <UFormField :label="t('tasks.fields.description')">
            <UTextarea v-model="form.description" :rows="3" class="w-full" />
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
