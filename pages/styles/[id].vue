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
const { t } = useI18n()
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
    toast.add({ title: t('common.messages.created'), color: 'success' })
    newVariantOpen.value = false
    newVariantForm.name = ''
    newVariantForm.color = ''
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
    toast.add({ title: t('common.messages.uploaded'), color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    input.value = ''
  }
}

async function deleteVariant(variant: Variant) {
  if (!confirm(t('styles.variants.deleteConfirm', { name: variant.name }))) return
  try {
    await $fetch(`/api/variants/${variant.id}`, { method: 'DELETE' })
    toast.add({ title: t('common.messages.deleted'), color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}

async function deleteStyle() {
  if (!confirm(t('styles.deleteHardConfirm', { code: data.value?.style.code ?? '' }))) return
  try {
    await $fetch(`/api/styles/${styleId}`, { method: 'DELETE' })
    toast.add({ title: t('common.messages.deleted'), color: 'success' })
    await navigateTo('/styles')
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } }).data?.error?.message ?? t('common.messages.genericError')
    toast.add({ title: msg, color: 'error' })
  }
}
</script>

<template>
  <div v-if="data?.style" class="p-4 md:p-6 max-w-5xl">
    <UButton
      variant="ghost"
      size="sm"
      icon="i-lucide-arrow-left"
      class="mb-4"
      @click="navigateTo('/styles')"
    >
      {{ t('common.actions.backToList') }}
    </UButton>

    <header class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div class="min-w-0">
        <div class="font-mono text-xs text-gray-500">
          {{ data.style.code }}
        </div>
        <h1 class="text-xl md:text-2xl font-semibold break-words">
          {{ data.style.name }}
        </h1>
        <p v-if="data.style.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {{ data.style.description }}
        </p>
      </div>
      <UButton
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        size="sm"
        class="self-start shrink-0"
        @click="deleteStyle"
      >
        {{ t('styles.deleteStyle') }}
      </UButton>
    </header>

    <section>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base md:text-lg font-medium">
          {{ t('styles.variants.title', { count: data.style.variants.length }) }}
        </h2>
        <UButton size="sm" icon="i-lucide-plus" @click="newVariantOpen = true">
          {{ t('styles.variants.addVariant') }}
        </UButton>
      </div>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <ul class="divide-y divide-gray-200 dark:divide-gray-800">
          <li
            v-for="v in data.style.variants"
            :key="v.id"
            class="flex items-center gap-3 p-3 sm:p-4"
          >
            <div class="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden group">
              <img v-if="v.imageUrl" :src="`/storage/${v.imageUrl}`" class="w-full h-full object-cover" alt="">
              <div v-else class="w-full h-full flex items-center justify-center">
                <UIcon name="i-lucide-image-off" class="w-5 h-5 text-gray-400" />
              </div>
              <label
                class="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
                :title="t('common.actions.uploadImage')"
              >
                <UIcon name="i-lucide-upload" class="w-4 h-4" />
                <input
                  type="file"
                  class="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  @change="uploadImage(v, $event)"
                >
              </label>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">
                {{ v.name }}
              </div>
              <div v-if="v.color" class="text-xs text-gray-500">
                {{ t('styles.variants.colorLabel', { color: v.color }) }}
              </div>
              <UBadge v-if="!v.active" variant="soft" color="neutral" size="xs" class="mt-1">
                {{ t('common.labels.inactive') }}
              </UBadge>
            </div>
            <div class="flex items-center gap-1">
              <label
                class="inline-flex md:hidden items-center justify-center w-8 h-8 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                :title="t('common.actions.uploadImage')"
              >
                <UIcon name="i-lucide-upload" class="w-4 h-4" />
                <input
                  type="file"
                  class="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  @change="uploadImage(v, $event)"
                >
              </label>
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                @click="deleteVariant(v)"
              />
            </div>
          </li>

          <li v-if="!data.style.variants.length" class="p-8 text-center text-sm text-gray-500">
            {{ t('styles.variants.empty') }}.
            <UButton variant="link" @click="newVariantOpen = true">
              {{ t('styles.variants.createFirst') }}
            </UButton>
          </li>
        </ul>
      </UCard>
    </section>

    <UModal v-model:open="newVariantOpen" :title="t('styles.variants.createTitle')">
      <template #body>
        <form class="space-y-4" @submit.prevent="createVariant">
          <UFormField :label="t('styles.variants.fields.name')" required>
            <UInput
              v-model="newVariantForm.name"
              required
              class="w-full"
              :placeholder="t('styles.variants.fields.namePlaceholder')"
            />
          </UFormField>
          <UFormField :label="t('styles.variants.fields.color')">
            <UInput
              v-model="newVariantForm.color"
              class="w-full"
              :placeholder="t('styles.variants.fields.colorPlaceholder')"
            />
          </UFormField>
          <p class="text-xs text-gray-500">
            {{ t('styles.variants.uploadHint') }}
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="newVariantOpen = false">
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
