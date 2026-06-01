<script setup lang="ts">
interface OrderTask {
  id: string
  nameSnapshot: string
  descriptionSnapshot: string | null
  position: number
  done: boolean
  notes: string | null
  completedAt: string | null
}

const props = defineProps<{
  tasks: OrderTask[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  'set-done': [taskId: string, done: boolean, notes?: string]
  'remove': [taskId: string]
}>()

const { t } = useI18n()

const editing = ref<{ id: string, done: boolean, notes: string } | null>(null)

function openEdit(task: OrderTask) {
  if (props.readonly) return
  editing.value = {
    id: task.id,
    done: task.done,
    notes: task.notes ?? '',
  }
}

function applyEdit() {
  if (!editing.value) return
  emit('set-done', editing.value.id, editing.value.done, editing.value.notes)
  editing.value = null
}

function toggleDone(task: OrderTask) {
  if (props.readonly) return
  emit('set-done', task.id, !task.done, task.notes ?? undefined)
}

function remove(task: OrderTask) {
  if (props.readonly) return
  if (!confirm(t('orders.tasks.deleteTaskConfirm', { name: task.nameSnapshot }))) return
  emit('remove', task.id)
}
</script>

<template>
  <ol class="space-y-2">
    <li
      v-for="(task, idx) in props.tasks"
      :key="task.id"
      class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-start gap-3"
    >
      <button
        type="button"
        :disabled="props.readonly"
        :class="[
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
          task.done
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
          props.readonly ? 'cursor-default' : 'cursor-pointer hover:ring-2 hover:ring-green-300',
        ]"
        :aria-label="task.done ? t('orders.tasks.markIncomplete') : t('orders.tasks.markDone')"
        @click="toggleDone(task)"
      >
        <UIcon v-if="task.done" name="i-lucide-check" class="w-4 h-4" />
        <span v-else>{{ idx + 1 }}</span>
      </button>

      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="font-medium truncate" :class="task.done ? 'line-through text-gray-500' : ''">
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
              v-if="task.done"
              size="xs"
              color="success"
              variant="soft"
            >
              {{ t('orders.tasks.completed') }}
            </UBadge>
            <UBadge v-else size="xs" color="neutral" variant="soft">
              {{ t('orders.tasks.notStarted') }}
            </UBadge>
          </div>
        </div>

        <div v-if="!props.readonly" class="mt-2 flex items-center gap-1">
          <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEdit(task)">
            {{ t('orders.tasks.editTask') }}
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
    :title="t('orders.tasks.editTask')"
    @update:open="(v: boolean) => !v && (editing = null)"
  >
    <template #body>
      <div v-if="editing" class="space-y-4">
        <UFormField :label="t('orders.tasks.doneLabel')">
          <USwitch v-model="editing.done" />
        </UFormField>
        <UFormField :label="t('orders.tasks.notesLabel')">
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
