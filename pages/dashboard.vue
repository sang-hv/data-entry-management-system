<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl">
    <header class="mb-5">
      <h1 class="text-xl md:text-2xl font-semibold">
        Dashboard
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Xin chào, {{ user?.name }}
      </p>
    </header>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
      <UCard
v-for="stat in [
        { label: 'Đơn đang chạy', value: '—', icon: 'i-lucide-package', color: 'text-blue-600' },
        { label: 'Đơn trễ deadline', value: '—', icon: 'i-lucide-alert-circle', color: 'text-red-600' },
        { label: 'Sắp tới hạn (7d)', value: '—', icon: 'i-lucide-clock', color: 'text-yellow-600' },
        { label: 'Thiếu thông tin', value: '—', icon: 'i-lucide-help-circle', color: 'text-gray-600' },
      ]" :key="stat.label">
        <div class="flex items-center gap-3">
          <UIcon :name="stat.icon" :class="['w-8 h-8', stat.color]" />
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ stat.label }}
            </div>
            <div class="text-2xl font-semibold tabular-nums">
              {{ stat.value }}
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <UCard>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Dashboard hiện đang ở chế độ placeholder. Số liệu thật và danh sách đơn cần chú ý sẽ được bổ sung ở Milestone 5 (Alerts & Dashboard).
      </p>
    </UCard>
  </div>
</template>
