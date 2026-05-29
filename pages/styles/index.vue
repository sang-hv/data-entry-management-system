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
const q = ref('')
const dialogOpen = ref(false)
const submitting = ref(false)
const form = reactive({ code: '', name: '', description: '' })

const { data, refresh } = await useFetch<{ items: StyleRow[], total: number }>(
  '/api/styles',
  { query: { q, activeOnly: 'false' } },
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
    toast.add({ title: 'Đã tạo mẫu', color: 'success' })
    dialogOpen.value = false
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Lỗi'
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}

async function onDelete(row: StyleRow) {
  if (!confirm(`Xóa mẫu "${row.code}"?`)) return
  try {
    await $fetch(`/api/styles/${row.id}`, { method: 'DELETE' })
    toast.add({ title: 'Đã xóa', color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Lỗi'
    toast.add({ title: msg, color: 'error' })
  }
}
</script>

<template>
  <div class="p-6 max-w-6xl">
    <header class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold">
          Mẫu áo (Styles)
        </h1>
        <p class="text-sm text-gray-500">
          Master data mẫu áo. Mỗi mẫu có nhiều biến thể (màu / họa tiết).
        </p>
      </div>
      <UButton icon="i-lucide-plus" @click="openCreate">
        Thêm mẫu
      </UButton>
    </header>

    <div class="mb-4">
      <UInput v-model="q" placeholder="Tìm theo mã hoặc tên..." icon="i-lucide-search" class="max-w-md" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard
        v-for="row in data?.items ?? []"
        :key="row.id"
        :ui="{ body: 'p-0' }"
        class="overflow-hidden hover:shadow-md transition cursor-pointer"
        @click="navigateTo(`/styles/${row.id}`)"
      >
        <div class="aspect-square bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <img v-if="row.thumbnailUrl" :src="`/storage/${row.thumbnailUrl}`" class="w-full h-full object-cover" alt="">
          <UIcon v-else name="i-lucide-shirt" class="w-12 h-12 text-gray-400" />
        </div>
        <div class="p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-mono text-xs text-gray-500">
                {{ row.code }}
              </div>
              <div class="font-medium truncate">
                {{ row.name }}
              </div>
            </div>
            <UBadge v-if="!row.active" variant="soft" color="neutral" size="sm">
              Đã ẩn
            </UBadge>
          </div>
          <div class="mt-2 text-sm text-gray-500">
            {{ row.variantCount }} biến thể
          </div>
          <div class="mt-3 flex justify-end">
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              @click.stop="onDelete(row)"
            />
          </div>
        </div>
      </UCard>
      <div v-if="!(data?.items ?? []).length" class="col-span-full text-center text-gray-500 py-12">
        Chưa có mẫu nào. <UButton variant="link" @click="openCreate">
          Tạo mẫu đầu tiên
        </UButton>
      </div>
    </div>

    <UModal v-model:open="dialogOpen" title="Thêm mẫu áo mới">
      <template #body>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField label="Mã (vd: AO083)" required>
            <UInput v-model="form.code" required class="w-full" />
          </UFormField>
          <UFormField label="Tên" required>
            <UInput v-model="form.name" required class="w-full" placeholder="Áo polo cổ bẻ" />
          </UFormField>
          <UFormField label="Mô tả">
            <UTextarea v-model="form.description" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="dialogOpen = false">
              Hủy
            </UButton>
            <UButton type="submit" :loading="submitting">
              Tạo
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
