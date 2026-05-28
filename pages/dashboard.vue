<script setup lang="ts">
const { user, logout } = useAuth()
</script>

<template>
  <div class="p-6">
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold">
        Dashboard
      </h1>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-600">{{ user?.email }}</span>
        <UButton variant="ghost" @click="logout">
          Đăng xuất
        </UButton>
      </div>
    </header>
    <UCard>
      <p class="text-gray-600">
        Đây là placeholder Dashboard. Nội dung thật sẽ có ở M5.
      </p>
    </UCard>
  </div>
</template>
