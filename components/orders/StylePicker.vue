<script setup lang="ts">
interface VariantOption {
  id: string
  styleCode: string
  styleName: string
  variantName: string
  imageUrl: string | null
}

const props = defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { t } = useI18n()
const search = ref('')
const open = ref(false)

const { data } = await useFetch<{ items: VariantOption[] }>('/api/variants')

const filtered = computed(() => {
  if (!data.value) return []
  const q = search.value.trim().toLowerCase()
  if (!q) return data.value.items
  return data.value.items.filter((opt) =>
    opt.styleCode.toLowerCase().includes(q)
    || opt.styleName.toLowerCase().includes(q)
    || opt.variantName.toLowerCase().includes(q),
  )
})

const selected = computed(() =>
  data.value?.items.find((o) => o.id === props.modelValue) ?? null,
)

function pick(opt: VariantOption) {
  emit('update:modelValue', opt.id)
  open.value = false
  search.value = ''
}
</script>

<template>
  <UPopover v-model:open="open">
    <UButton variant="outline" color="neutral" class="w-full justify-start" :ui="{ leadingIcon: 'shrink-0' }">
      <template v-if="selected">
        <div class="flex items-center gap-2 min-w-0 w-full">
          <div class="w-8 h-8 rounded shrink-0 bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
            <img v-if="selected.imageUrl" :src="`/storage/${selected.imageUrl}`" class="w-full h-full object-cover" alt="">
            <UIcon v-else name="i-lucide-shirt" class="w-3 h-3 text-gray-400" />
          </div>
          <div class="text-left flex-1 min-w-0">
            <div class="text-xs font-mono text-gray-500">
              {{ selected.styleCode }}
            </div>
            <div class="text-sm truncate">
              {{ selected.styleName }} — {{ selected.variantName }}
            </div>
          </div>
        </div>
      </template>
      <span v-else class="text-gray-500">{{ t('orders.fields.stylePicker') }}</span>
    </UButton>

    <template #content>
      <div class="p-2 w-[min(28rem,90vw)]">
        <UInput
          v-model="search"
          :placeholder="t('common.actions.search')"
          icon="i-lucide-search"
          class="mb-2 w-full"
          autofocus
        />
        <ul class="max-h-72 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
          <li
            v-for="opt in filtered"
            :key="opt.id"
            class="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded"
            @click="pick(opt)"
          >
            <div class="w-10 h-10 rounded shrink-0 bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
              <img v-if="opt.imageUrl" :src="`/storage/${opt.imageUrl}`" class="w-full h-full object-cover" alt="">
              <UIcon v-else name="i-lucide-shirt" class="w-4 h-4 text-gray-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-mono text-gray-500">
                {{ opt.styleCode }}
              </div>
              <div class="text-sm truncate">
                {{ opt.styleName }}
              </div>
              <div class="text-xs text-gray-500 truncate">
                {{ opt.variantName }}
              </div>
            </div>
          </li>
          <li v-if="!filtered.length" class="p-4 text-center text-sm text-gray-500">
            {{ t('common.messages.noData') }}
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>
