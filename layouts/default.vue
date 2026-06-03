<script setup lang="ts">
const { user, logout } = useAuth()
const route = useRoute()
const { t } = useI18n()

const navItems = computed(() => [
  { label: t('nav.dashboard'), to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
  { label: t('nav.orders'), to: '/orders', icon: 'i-lucide-package' },
  { label: t('nav.styles'), to: '/styles', icon: 'i-lucide-shirt' },
  { label: t('nav.sizes'), to: '/sizes', icon: 'i-lucide-ruler' },
  { label: t('nav.tasks'), to: '/tasks', icon: 'i-lucide-list-checks' },
  { label: t('nav.alerts'), to: '/alerts', icon: 'i-lucide-bell' },
])

const drawerOpen = ref(false)

watch(() => route.fullPath, () => {
  drawerOpen.value = false
})

const currentPageTitle = computed(() => {
  const match = navItems.value.find((n) => route.path.startsWith(n.to))
  return match?.label ?? t('app.name')
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Mobile top bar -->
    <header class="md:hidden sticky top-0 z-30 flex items-center gap-2 h-14 px-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <UButton
        variant="ghost"
        icon="i-lucide-menu"
        size="md"
        :aria-label="t('common.actions.openMenu')"
        @click="drawerOpen = true"
      />
      <div class="font-semibold">
        {{ currentPageTitle }}
      </div>
      <div class="ml-auto">
        <UDropdownMenu
          :items="[[
            { label: user?.email, type: 'label' as const },
            { label: t('common.actions.logout'), icon: 'i-lucide-log-out', onSelect: logout },
          ]]"
        >
          <UButton variant="ghost" size="sm" icon="i-lucide-user" />
        </UDropdownMenu>
      </div>
    </header>

    <div class="flex">
      <!-- Desktop sidebar -->
      <aside class="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <div class="px-4 py-5 border-b border-gray-200 dark:border-gray-800">
          <div class="font-semibold text-base">
            {{ t('app.name') }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('app.tagline') }}
          </div>
        </div>
        <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            :class="route.path.startsWith(item.to)
              ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-medium'
              : ''"
          >
            <UIcon :name="item.icon" class="w-4 h-4 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </NuxtLink>
        </nav>
        <div class="p-3 border-t border-gray-200 dark:border-gray-800">
          <UDropdownMenu
            :items="[[
              { label: t('common.actions.logout'), icon: 'i-lucide-log-out', onSelect: logout },
            ]]"
          >
            <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <UAvatar :alt="user?.name ?? 'User'" size="xs" />
              <div class="flex-1 min-w-0 text-left">
                <div class="text-sm font-medium truncate">
                  {{ user?.name }}
                </div>
                <div class="text-xs text-gray-500 truncate">
                  {{ user?.email }}
                </div>
              </div>
              <UIcon name="i-lucide-chevron-up" class="w-4 h-4 text-gray-400" />
            </button>
          </UDropdownMenu>
        </div>
      </aside>

      <!-- Mobile drawer -->
      <USlideover v-model:open="drawerOpen" side="left">
        <template #content>
          <div class="flex flex-col h-full">
            <div class="px-4 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <div class="font-semibold text-base">
                  {{ t('app.name') }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ t('app.tagline') }}
                </div>
              </div>
              <UButton variant="ghost" icon="i-lucide-x" size="sm" @click="drawerOpen = false" />
            </div>
            <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">
              <NuxtLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                :class="route.path.startsWith(item.to)
                  ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300'"
              >
                <UIcon :name="item.icon" class="w-4 h-4 shrink-0" />
                <span>{{ item.label }}</span>
              </NuxtLink>
            </nav>
            <div class="p-3 border-t border-gray-200 dark:border-gray-800">
              <div class="flex items-center gap-2.5 px-3 py-2 mb-1">
                <UAvatar :alt="user?.name ?? 'User'" size="xs" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">
                    {{ user?.name }}
                  </div>
                  <div class="text-xs text-gray-500 truncate">
                    {{ user?.email }}
                  </div>
                </div>
              </div>
              <UButton variant="soft" color="neutral" block icon="i-lucide-log-out" @click="logout">
                {{ t('common.actions.logout') }}
              </UButton>
            </div>
          </div>
        </template>
      </USlideover>

      <!-- Main content -->
      <main class="flex-1 md:ml-60 min-w-0">
        <slot />
      </main>
    </div>
  </div>
</template>
