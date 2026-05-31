<script setup lang="ts">
interface OrderTask {
  id: string
  nameSnapshot: string
  descriptionSnapshot: string | null
  position: number
  progressPct: number
  notes: string | null
  startedAt: string | null
  completedAt: string | null
}

const props = defineProps<{
  tasks: OrderTask[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update-progress': [taskId: string, progressPct: number, notes?: string]
  'remove': [taskId: string]
}>()

const { t } = useI18n()

const editing = ref<{ id: string, value: number, notes: string } | null>(null)

function openEdit(task: OrderTask) {
  if (props.readonly) return
  editing.value = {
    id: task.id,
    value: task.progressPct,
    notes: task.notes ?? '',
  }
}

function applyEdit() {
  if (!editing.value) return
  emit('update-progress', editing.value.id, editing.value.value, editing.value.notes)
  editing.value = null
}

function remove(task: OrderTask) {
  if (props.readonly) return
  if (!confirm(t('orders.tasks.deleteTaskConfirm', { name: task.nameSnapshot }))) return
  emit('remove', task.id)
}

function statusLabel(t: OrderTask) {
  if (t.progressPct >= 100) return 'completed'
  if (t.progressPct > 0) return 'inProgress'
  return 'notStarted'
}
</script>

<template>
  <ol class="space-y-2">
    <li
      v-for="(task, idx) in props.tasks"
      :key="task.id"
      class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-start gap-3"
    >
      <div
        :class="[
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
          task.progressPct >= 100
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : task.progressPct > 0
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
        ]"
      >
        <UIcon v-if="task.progressPct >= 100" name="i-lucide-check" class="w-4 h-4" />
        <span v-else>{{ idx + 1 }}</span>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="font-medium truncate">
              {{ task.nameSnapshot }}
            </div>
            <div v-if="task.descriptionSnapshot" class="text-xs text-gray-500 line-clamp-1 mt-0.5">
              {{ task.descriptionSnapshot }}
            </div>
            <div v-if="task.notes" class="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
              "{{ task.notes }}"
            </div>
          </div>
          <div class="shrink-0 flex items-center gap-1">
            <UBadge
              v-if="task.progressPct >= 100"
              size="xs"
              color="success"
              variant="soft"
            >
              {{ t(`orders.tasks.completed`) }}
            </UBadge>
            <UBadge
              v-else-if="task.progressPct > 0"
              size="xs"
              color="info"
              variant="soft"
            >
              {{ task.progressPct }}%
            </UBadge>
            <UBadge v-else size="xs" color="neutral" variant="soft">
              {{ t(`orders.tasks.${statusLabel(task)}`) }}
            </UBadge>
          </div>
        </div>

        <div class="mt-2">
          <OrdersOrderProgressBar :value="task.progressPct" size="xs" :hide-label="true" />
        </div>

        <div v-if="!props.readonly" class="mt-2 flex items-center gap-1">
          <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEdit(task)">
            {{ t('orders.tasks.updateProgress') }}
          </UButton>
          <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="remove(task)" />
        </div>
      </div>
    </li>

    <li v-if="!props.tasks.length" class="p-6 text-center text-sm text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
      {{ t('orders.tasks.noTasks') }}
    </li>
  </ol>

  <UModal
    :open="!!editing"
    :title="t('orders.tasks.updateProgress')"
    @update:open="(v: boolean) => !v && (editing = null)"
  >
    <template #body>
      <div v-if="editing" class="space-y-4">
        <UFormField :label="t('orders.tasks.progressLabel')">
          <div class="space-y-2">
            <input
              v-model.number="editing.value"
              type="range"
              min="0"
              max="100"
              step="5"
              class="w-full"
            >
            <div class="flex items-center gap-2">
              <UInput
                v-model.number="editing.value"
                type="number"
                min="0"
                max="100"
                class="flex-1"
              />
              <span class="text-sm text-gray-500">%</span>
            </div>
          </div>
        </UFormField>
        <UFormField :label="t('common.labels.description')">
          <UTextarea v-model="editing.notes" :rows="2" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" @click="editing = null">
            {{ t('common.actions.cancel') }}
          </UButton>
          <UButton @click="applyEdit">
            {{ t('common.actions.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
