import type { Ref } from 'vue'

/**
 * Returns a ref that mirrors `source` but only updates after `source`
 * has stopped changing for `delay` ms. Useful for search inputs to avoid
 * firing a server request on every keystroke.
 */
export function useDebouncedRef<T>(source: Ref<T>, delay = 350): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(source, (value) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = value
    }, delay)
  })

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  return debounced
}
