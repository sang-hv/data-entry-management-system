<script setup lang="ts">
interface TaskOption {
  id: string
  code: string | null
  name: string
  description: string | null
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'pick': [taskIds: string[]]
}>()

const { t } = useI18n()
const search = ref('')
const selected = ref<string[]>([])

const { data, refresh } = await useFetch<{ items: TaskOption[] }>('/api/tasks', {
  query: { activeOnly: 'true' },
})

watch(
  () => props.open,
  (val) => {
    if (val) {
      selected.value = []
      search.value = ''
      refresh()
    }
  },
)

function toggle(id: string) {
  // Allow same task picked multiple times — clicking adds another.
  selected.value = [...selected.value, id]
}

function removeAt(idx: number) {
  selected.value = selected.value.filter((_, i) => i !== idx)
}

function nameFor(id: string) {
  return data.value?.items.find((t) => t.id === id)?.name ?? id
}

function onPick() {
  if (selected.value.length === 0) return
  emit('pick', [...selected.value])
  emit('update:open', false)
}

const filtered = computed(() => {
  if (!data.value?.items) return []
  const q = search.value.trim().toLowerCase()
  if (!q) return data.value.items
  return data.value.items.filter((task) =>
    task.name.toLowerCase().includes(q)
    || task.code?.toLowerCase().includes(q),
  )
})
</script>

<template>
  <UModal
    :open="props.open"
    :title="t('orders.tasks.pickTasks')"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-3">
        <UInput
          v-model="search"
          :placeholder="t('common.actions.search')"
          icon="i-lucide-search"
          class="w-full"
        />

        <div v-if="selected.length" class="flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
          <UBadge
            v-for="(id, idx) in selected"
            :key="`${id}-${idx}`"
            color="primary"
            variant="soft"
            class="cursor-pointer"
            @click="removeAt(idx)"
          >
            {{ idx + 1 }}. {{ nameFor(id) }}
            <UIcon name="i-lucide-x" class="w-3 h-3 ml-1" />
          </UBadge>
        </div>

        <ul class="max-h-72 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded">
          <li
            v-for="task in filtered"
            :key="task.id"
            class="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
            @click="toggle(task.id)"
          >
            <UIcon name="i-lucide-plus" class="w-4 h-4 text-gray-400" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span v-if="task.code" class="font-mono text-xs text-gray-500">{{ task.code }}</span>
                <span class="text-sm font-medium">{{ task.name }}</span>
              </div>
              <div v-if="task.description" class="text-xs text-gray-500 line-clamp-1 mt-0.5">
                {{ task.description }}
              </div>
            </div>
          </li>
          <li v-if="!filtered.length" class="p-4 text-center text-sm text-gray-500">
            {{ t('common.messages.noData') }}
          </li>
        </ul>

        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" @click="emit('update:open', false)">
            {{ t('common.actions.cancel') }}
          </UButton>
          <UButton
            :disabled="selected.length === 0"
            @click="onPick"
          >
            {{ t('orders.tasks.addTasks') }} ({{ selected.length }})
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
