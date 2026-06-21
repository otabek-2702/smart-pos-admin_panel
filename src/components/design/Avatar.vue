<script setup lang="ts">
import { cx } from './utils'

interface Props {
  initials?: string
  src?: string
  alt?: string
  size?: 'sm'
  title?: string
}

const props = defineProps<Props>()

const failed = ref(false)

const klass = computed(() => cx('avatar', props.size && `avatar--${props.size}`))

function onError() {
  failed.value = true
}
</script>

<template>
  <div
    :class="klass"
    :title="title"
  >
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt || initials || ''"
      class="avatar__img"
      @error="onError"
    >
    <template v-else>
      {{ initials }}
    </template>
  </div>
</template>

<style scoped>
.avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  display: block;
}
</style>
