<script setup lang="ts">
const { t } = useI18n({ useScope: 'global' })

const props = defineProps<{
  modelValue: boolean
  recipe: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

const typeColor: Record<string, string> = {
  PRODUCTION: 'primary',
  ASSEMBLY: 'success',
  PREPARATION: 'warning',
  DISASSEMBLY: 'error',
}
</script>

<template>
  <VDialog v-model="visible" max-width="560">
    <VCard v-if="recipe" :title="recipe.name">
      <VCardText>
        <div class="d-flex gap-2 mb-3 flex-wrap">
          <VChip :color="typeColor[recipe.recipe_type] ?? 'default'" size="small" variant="tonal">{{ recipe.recipe_type }}</VChip>
          <VChip v-if="recipe.version" color="secondary" size="small" variant="tonal">v{{ recipe.version }}</VChip>
        </div>
        <div class="mb-3">
          <span class="text-body-2 text-disabled">{{ t('Output') }}: </span>
          <strong>{{ recipe.output_quantity }} {{ recipe.output_unit ?? '' }} {{ recipe.output_item?.name ?? recipe.output_item_name ?? '' }}</strong>
        </div>
        <p class="text-overline text-disabled mb-1">{{ t('Ingredients') }}</p>
        <VTable density="compact">
          <thead>
            <tr>
              <th>{{ t('Item') }}</th>
              <th>{{ t('Quantity') }}</th>
              <th>{{ t('Unit') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(ing, idx) in ((recipe.ingredients ?? []) as any[])" :key="idx">
              <td>{{ ing.stock_item?.name ?? '—' }}</td>
              <td>{{ ing.quantity }}</td>
              <td>{{ ing.unit ?? '—' }}</td>
            </tr>
            <tr v-if="!(recipe.ingredients?.length)">
              <td colspan="3" class="text-center text-disabled">{{ t('No ingredients') }}</td>
            </tr>
          </tbody>
        </VTable>
      </VCardText>
      <VCardActions class="justify-end pa-4 pt-0">
        <VBtn variant="tonal" @click="visible = false">{{ t('Close') }}</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
