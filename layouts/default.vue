<script setup lang="ts">
const { user, logout } = useAuth()

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
  { label: 'Đơn hàng', to: '/orders', icon: 'i-lucide-package' },
  { label: 'Mẫu áo', to: '/styles', icon: 'i-lucide-shirt' },
  { label: 'Kích cỡ', to: '/sizes', icon: 'i-lucide-ruler' },
]
</script>

<template>
  <div class="min-h-screen flex bg-gray-50 dark:bg-gray-900">
    <aside class="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="font-semibold text-lg">
          DEMS
        </div>
        <div class="text-xs text-gray-500">
          Quản lý đơn may mặc
        </div>
      </div>
      <nav class="flex-1 p-2 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          active-class="bg-gray-100 dark:bg-gray-700 font-medium"
        >
          <UIcon :name="item.icon" class="w-4 h-4" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
      <div class="p-3 border-t border-gray-200 dark:border-gray-700">
        <div class="text-xs text-gray-500 mb-2 truncate">
          {{ user?.email }}
        </div>
        <UButton variant="ghost" size="sm" block icon="i-lucide-log-out" @click="logout">
          Đăng xuất
        </UButton>
      </div>
    </aside>
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
