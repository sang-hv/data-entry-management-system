<script setup lang="ts">
interface SizeRow {
  id: string
  code: string
  label: string
  order: number
  active: boolean
}

const toast = useToast()
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
  form.order = data.value?.items.length ? Math.max(...data.value.items.map(s => s.order)) + 10 : 10
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
      toast.add({ title: 'Đã cập nhật size', color: 'success' })
    }
    else {
      await $fetch('/api/sizes', {
        method: 'POST',
        body: { code: form.code, label: form.label, order: form.order },
      })
      toast.add({ title: 'Đã tạo size mới', color: 'success' })
    }
    dialogOpen.value = false
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Có lỗi xảy ra'
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
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Có lỗi xảy ra'
    toast.add({ title: msg, color: 'error' })
  }
}

async function onDelete(row: SizeRow) {
  if (!confirm(`Xóa size "${row.code}"?`)) return
  try {
    await $fetch(`/api/sizes/${row.id}`, { method: 'DELETE' })
    toast.add({ title: 'Đã xóa', color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Có lỗi xảy ra'
    toast.add({ title: msg, color: 'error' })
  }
}
</script>

<template>
  <div class="p-6 max-w-4xl">
    <header class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold">
          Kích cỡ (Sizes)
        </h1>
        <p class="text-sm text-gray-500">
          Master data — kích cỡ áo dùng cho mọi đơn hàng
        </p>
      </div>
      <UButton icon="i-lucide-plus" @click="openCreate">
        Thêm size
      </UButton>
    </header>

    <UCard>
      <table class="w-full text-sm">
        <thead class="text-left border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th class="px-3 py-2 font-medium">
              Mã
            </th>
            <th class="px-3 py-2 font-medium">
              Hiển thị
            </th>
            <th class="px-3 py-2 font-medium w-24 text-right">
              Thứ tự
            </th>
            <th class="px-3 py-2 font-medium w-24">
              Hoạt động
            </th>
            <th class="px-3 py-2 w-32" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.items ?? []" :key="row.id" class="border-b border-gray-100 dark:border-gray-700">
            <td class="px-3 py-2 font-mono">
              {{ row.code }}
            </td>
            <td class="px-3 py-2">
              {{ row.label }}
            </td>
            <td class="px-3 py-2 text-right tabular-nums">
              {{ row.order }}
            </td>
            <td class="px-3 py-2">
              <USwitch :model-value="row.active" @update:model-value="onToggleActive(row)" />
            </td>
            <td class="px-3 py-2 text-right">
              <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEdit(row)" />
              <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="onDelete(row)" />
            </td>
          </tr>
          <tr v-if="!(data?.items ?? []).length">
            <td colspan="5" class="px-3 py-6 text-center text-gray-500">
              Chưa có size nào
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UModal v-model:open="dialogOpen" :title="editing ? 'Sửa size' : 'Thêm size mới'">
      <template #body>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField label="Mã (S, M, L...)" required>
            <UInput v-model="form.code" :disabled="!!editing" required class="w-full" />
          </UFormField>
          <UFormField label="Nhãn hiển thị" required>
            <UInput v-model="form.label" required class="w-full" />
          </UFormField>
          <UFormField label="Thứ tự (số nhỏ = đứng trước)" required>
            <UInput v-model.number="form.order" type="number" min="0" required class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="dialogOpen = false">
              Hủy
            </UButton>
            <UButton type="submit" :loading="submitting">
              {{ editing ? 'Cập nhật' : 'Tạo' }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
