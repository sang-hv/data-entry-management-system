<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-semibold mb-6">
      Dashboard
    </h1>
    <UCard>
      <p class="text-gray-600">
        Xin chào, <strong>{{ user?.name }}</strong>. Đây là placeholder Dashboard. Nội dung thật sẽ có ở M5 (alerts + cảnh báo + thống kê đơn).
      </p>
    </UCard>
  </div>
</template>
