<script setup lang="ts">
const { login } = useAuth()
const email = ref('')
const password = ref('')
const errorMsg = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  errorMsg.value = null
  submitting.value = true
  try {
    await login(email.value, password.value)
    await navigateTo('/dashboard')
  } catch (err: unknown) {
    const e = err as { data?: { error?: { message?: string } } }
    errorMsg.value = e.data?.error?.message ?? 'Đăng nhập thất bại'
  } finally {
    submitting.value = false
  }
}

definePageMeta({ layout: false })
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-semibold">
          Đăng nhập
        </h1>
      </template>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Email" required>
          <UInput v-model="email" type="email" autocomplete="email" required class="w-full" />
        </UFormField>
        <UFormField label="Mật khẩu" required>
          <UInput v-model="password" type="password" autocomplete="current-password" required class="w-full" />
        </UFormField>
        <UAlert v-if="errorMsg" color="error" variant="soft" :title="errorMsg" />
        <UButton type="submit" block :loading="submitting">
          Đăng nhập
        </UButton>
      </form>
    </UCard>
  </div>
</template>
