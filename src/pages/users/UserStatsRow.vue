<script setup lang="ts">
defineProps<{ stats: any | null }>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <VRow class="mb-4">
    <VCol
      cols="6"
      sm="3"
    >
      <div class="kpi-card">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-primary">
            <VIcon icon="bx-group" size="20" />
          </div>
          <div class="kpi-card__label">
            {{ t('Total') }}
          </div>
        </div>
        <div class="kpi-card__value num-tabular">
          <template v-if="stats">
            {{ stats.total_users ?? stats.total ?? stats.total_employees ?? '—' }}
          </template>
          <span
            v-else
            class="sk-box"
            style="display:inline-block;width:36px;height:1em;border-radius:4px;vertical-align:middle;"
          />
        </div>
      </div>
    </VCol>

    <VCol
      cols="6"
      sm="3"
    >
      <div class="kpi-card">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-success">
            <VIcon icon="bx-user-check" size="20" />
          </div>
          <div class="kpi-card__label">
            {{ t('Active') }}
          </div>
        </div>
        <div class="kpi-card__value num-tabular">
          <template v-if="stats">
            {{ stats.active_users ?? stats.active ?? stats.active_employees ?? '—' }}
          </template>
          <span
            v-else
            class="sk-box"
            style="display:inline-block;width:36px;height:1em;border-radius:4px;vertical-align:middle;"
          />
        </div>
      </div>
    </VCol>

    <VCol
      cols="6"
      sm="3"
    >
      <div class="kpi-card">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-info">
            <VIcon icon="bx-buildings" size="20" />
          </div>
          <div class="kpi-card__label">
            {{ t('Departments') }}
          </div>
        </div>
        <div class="kpi-card__value num-tabular">
          <template v-if="stats">
            {{ stats.total_departments ?? '—' }}
          </template>
          <span
            v-else
            class="sk-box"
            style="display:inline-block;width:36px;height:1em;border-radius:4px;vertical-align:middle;"
          />
        </div>
      </div>
    </VCol>

    <VCol
      cols="6"
      sm="3"
    >
      <div class="kpi-card">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-warning">
            <VIcon icon="bx-money" size="20" />
          </div>
          <div class="kpi-card__label">
            {{ t('Total Salary') }}
          </div>
        </div>
        <div class="kpi-card__value num-tabular">
          <template v-if="stats">
            {{ stats.total_salary ?? '—' }}
          </template>
          <span
            v-else
            class="sk-box"
            style="display:inline-block;width:36px;height:1em;border-radius:4px;vertical-align:middle;"
          />
        </div>
      </div>
    </VCol>
  </VRow>
</template>
