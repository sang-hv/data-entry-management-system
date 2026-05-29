<script setup lang="ts">
interface Variant {
  id: string
  name: string
  color: string | null
  imageUrl: string | null
  active: boolean
}

interface StyleDetail {
  id: string
  code: string
  name: string
  description: string | null
  active: boolean
  variants: Variant[]
}

const route = useRoute()
const toast = useToast()
const styleId = route.params.id as string

const { data, refresh } = await useFetch<{ style: StyleDetail }>(
  `/api/styles/${styleId}`,
)

const newVariantOpen = ref(false)
const newVariantForm = reactive({ name: '', color: '' })
const submitting = ref(false)

async function createVariant() {
  submitting.value = true
  try {
    await $fetch(`/api/styles/${styleId}/variants`, {
      method: 'POST',
      body: {
        name: newVariantForm.name,
        color: newVariantForm.color || undefined,
      },
    })
    toast.add({ title: 'Đã tạo biến thể', color: 'success' })
    newVariantOpen.value = false
    newVariantForm.name = ''
    newVariantForm.color = ''
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

async function uploadImage(variant: Variant, ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const fd = new FormData()
  fd.append('file', file)

  try {
    await $fetch(`/api/variants/${variant.id}/image`, {
      method: 'POST',
      body: fd,
    })
    toast.add({ title: 'Đã upload ảnh', color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Lỗi'
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    input.value = ''
  }
}

async function deleteVariant(variant: Variant) {
  if (!confirm(`Xóa biến thể "${variant.name}"?`)) return
  try {
    await $fetch(`/api/variants/${variant.id}`, { method: 'DELETE' })
    toast.add({ title: 'Đã xóa', color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Lỗi'
    toast.add({ title: msg, color: 'error' })
  }
}

async function deleteStyle() {
  if (!confirm(`Xóa hẳn mẫu "${data.value?.style.code}"?`)) return
  try {
    await $fetch(`/api/styles/${styleId}`, { method: 'DELETE' })
    toast.add({ title: 'Đã xóa', color: 'success' })
    await navigateTo('/styles')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Lỗi'
    toast.add({ title: msg, color: 'error' })
  }
}
</script>

<template>
  <div v-if="data?.style" class="p-6 max-w-5xl">
    <UButton variant="ghost" size="sm" icon="i-lucide-arrow-left" class="mb-4" @click="navigateTo('/styles')">
      Quay lại
    </UButton>

    <header class="flex items-start justify-between mb-6">
      <div>
        <div class="font-mono text-sm text-gray-500">
          {{ data.style.code }}
        </div>
        <h1 class="text-2xl font-semibold">
          {{ data.style.name }}
        </h1>
        <p v-if="data.style.description" class="text-sm text-gray-600 mt-1">
          {{ data.style.description }}
        </p>
      </div>
      <UButton variant="ghost" color="error" icon="i-lucide-trash-2" @click="deleteStyle">
        Xóa mẫu
      </UButton>
    </header>

    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-medium">
          Biến thể (Variants)
        </h2>
        <UButton size="sm" icon="i-lucide-plus" @click="newVariantOpen = true">
          Thêm biến thể
        </UButton>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard
          v-for="v in data.style.variants"
          :key="v.id"
          :ui="{ body: 'p-0' }"
          class="overflow-hidden"
        >
          <div class="aspect-square bg-gray-100 dark:bg-gray-700 relative group">
            <img v-if="v.imageUrl" :src="`/storage/${v.imageUrl}`" class="w-full h-full object-cover" alt="">
            <div v-else class="w-full h-full flex items-center justify-center">
              <UIcon name="i-lucide-image-off" class="w-10 h-10 text-gray-400" />
            </div>
            <label class="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer">
              <UIcon name="i-lucide-upload" class="w-6 h-6 mr-2" />
              <span class="text-sm">Đổi ảnh</span>
              <input type="file" class="hidden" accept="image/png,image/jpeg,image/webp" @change="uploadImage(v, $event)">
            </label>
          </div>
          <div class="p-3">
            <div class="font-medium truncate">
              {{ v.name }}
            </div>
            <div v-if="v.color" class="text-xs text-gray-500">
              Màu: {{ v.color }}
            </div>
            <div class="mt-2 flex justify-end">
              <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="deleteVariant(v)" />
            </div>
          </div>
        </UCard>

        <div v-if="!data.style.variants.length" class="col-span-full text-center text-gray-500 py-12">
          Chưa có biến thể nào. <UButton variant="link" @click="newVariantOpen = true">
            Thêm biến thể đầu tiên
          </UButton>
        </div>
      </div>
    </section>

    <UModal v-model:open="newVariantOpen" title="Thêm biến thể">
      <template #body>
        <form class="space-y-4" @submit.prevent="createVariant">
          <UFormField label="Tên biến thể" required>
            <UInput v-model="newVariantForm.name" required class="w-full" placeholder="TRANG KE XANH" />
          </UFormField>
          <UFormField label="Màu (tùy chọn)">
            <UInput v-model="newVariantForm.color" class="w-full" placeholder="BLUE" />
          </UFormField>
          <p class="text-xs text-gray-500">
            Ảnh mẫu có thể upload sau khi tạo bằng cách hover vào thẻ biến thể.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="newVariantOpen = false">
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
