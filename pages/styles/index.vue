<script setup lang="ts">
interface StyleRow {
  id: string
  code: string
  name: string
  description: string | null
  active: boolean
  variantCount: number
  thumbnailUrl: string | null
  updatedAt: string
}

const toast = useToast()
const { t } = useI18n()
const q = ref('')
const debouncedQ = useDebouncedRef(q, 350)
const dialogOpen = ref(false)
const submitting = ref(false)
const form = reactive({ code: '', name: '', description: '' })

const { data, refresh } = await useFetch<{ items: StyleRow[], total: number }>(
  '/api/styles',
  { query: { q: debouncedQ, activeOnly: 'false' } },
)

function openCreate() {
  form.code = ''
  form.name = ''
  form.description = ''
  dialogOpen.value = true
}

async function onSubmit() {
  submitting.value = true
  try {
    await $fetch('/api/styles', {
      method: 'POST',
      body: { code: form.code, name: form.name, description: form.description || undefined },
    })
    toast.add({ title: t('common.messages.created'), color: 'success' })
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

async function onDelete(row: StyleRow) {
  if (!confirm(t('styles.deleteConfirm', { code: row.code }))) return
  try {
    await $fetch(`/api/styles/${row.id}`, { method: 'DELETE' })
    toast.add({ title: t('common.messages.deleted'), color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl md:text-2xl font-semibold">
          {{ t('styles.title') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('styles.subtitle') }}
        </p>
      </div>
      <UButton icon="i-lucide-plus" class="self-start" @click="openCreate">
        {{ t('styles.addStyle') }}
      </UButton>
    </header>

    <div class="mb-4">
      <UInput
        v-model="q"
        :placeholder="t('styles.searchPlaceholder')"
        icon="i-lucide-search"
        class="w-full sm:max-w-md"
      />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Mobile -->
      <div class="md:hidden divide-y divide-gray-200 dark:divide-gray-800">
        <NuxtLink
          v-for="row in data?.items ?? []"
          :key="row.id"
          :to="`/styles/${row.id}`"
          class="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <div class="w-12 h-12 shrink-0 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
            <img v-if="row.thumbnailUrl" :src="`/storage/${row.thumbnailUrl}`" class="w-full h-full object-cover" alt="">
            <UIcon v-else name="i-lucide-shirt" class="w-5 h-5 text-gray-400" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs text-gray-500">{{ row.code }}</span>
              <UBadge v-if="!row.active" variant="soft" color="neutral" size="xs">
                {{ t('common.labels.inactive') }}
              </UBadge>
            </div>
            <div class="font-medium truncate">
              {{ row.name }}
            </div>
            <div class="text-xs text-gray-500 mt-0.5">
              {{ row.variantCount }} {{ t('styles.table.variantCount').toLowerCase() }}
            </div>
          </div>
          <UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-gray-400" />
        </NuxtLink>
        <div v-if="!(data?.items ?? []).length" class="p-8 text-center text-sm text-gray-500">
          {{ t('styles.empty') }}
        </div>
      </div>

      <!-- Desktop -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-4 py-2 font-medium w-16">
                {{ t('common.labels.image') }}
              </th>
              <th class="px-4 py-2 font-medium w-32">
                {{ t('common.labels.code') }}
              </th>
              <th class="px-4 py-2 font-medium">
                {{ t('common.labels.name') }}
              </th>
              <th class="px-4 py-2 font-medium w-28 text-center">
                {{ t('styles.table.variantCount') }}
              </th>
              <th class="px-4 py-2 font-medium w-24">
                {{ t('common.labels.status') }}
              </th>
              <th class="px-4 py-2 font-medium w-28">
                {{ t('common.labels.updatedAt') }}
              </th>
              <th class="px-4 py-2 w-20" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            <tr
              v-for="row in data?.items ?? []"
              :key="row.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
              @click="navigateTo(`/styles/${row.id}`)"
            >
              <td class="px-4 py-2">
                <div class="w-10 h-10 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
                  <img v-if="row.thumbnailUrl" :src="`/storage/${row.thumbnailUrl}`" class="w-full h-full object-cover" alt="">
                  <UIcon v-else name="i-lucide-shirt" class="w-4 h-4 text-gray-400" />
                </div>
              </td>
              <td class="px-4 py-2 font-mono text-xs">
                {{ row.code }}
              </td>
              <td class="px-4 py-2">
                <div class="font-medium">
                  {{ row.name }}
                </div>
                <div v-if="row.description" class="text-xs text-gray-500 truncate max-w-md">
                  {{ row.description }}
                </div>
              </td>
              <td class="px-4 py-2 text-center tabular-nums">
                {{ row.variantCount }}
              </td>
              <td class="px-4 py-2">
                <UBadge v-if="row.active" variant="soft" color="success" size="sm">
                  {{ t('common.labels.active') }}
                </UBadge>
                <UBadge v-else variant="soft" color="neutral" size="sm">
                  {{ t('common.labels.inactive') }}
                </UBadge>
              </td>
              <td class="px-4 py-2 text-xs text-gray-500 tabular-nums">
                {{ formatDate(row.updatedAt) }}
              </td>
              <td class="px-4 py-2 text-right">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  @click.stop="onDelete(row)"
                />
              </td>
            </tr>
            <tr v-if="!(data?.items ?? []).length">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-gray-500">
                {{ t('styles.empty') }}.
                <UButton variant="link" @click="openCreate">
                  {{ t('styles.createFirst') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal v-model:open="dialogOpen" :title="t('styles.createTitle')">
      <template #body>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField :label="t('styles.fields.code')" required>
            <UInput v-model="form.code" required class="w-full" />
          </UFormField>
          <UFormField :label="t('styles.fields.name')" required>
            <UInput v-model="form.name" required class="w-full" :placeholder="t('styles.fields.namePlaceholder')" />
          </UFormField>
          <UFormField :label="t('styles.fields.description')">
            <UTextarea v-model="form.description" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="dialogOpen = false">
              {{ t('common.actions.cancel') }}
            </UButton>
            <UButton type="submit" :loading="submitting">
              {{ t('common.actions.create') }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
