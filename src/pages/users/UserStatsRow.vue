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
      <VCard>
        <VCardText class="d-flex align-center gap-2 py-3">
          <VAvatar
            color="primary"
            variant="tonal"
            size="32"
            rounded
          >
            <VIcon
              icon="bx-group"
              size="16"
            />
          </VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold lh-1 mb-1">
              <template v-if="stats">
                {{ stats.total ?? stats.total_employees ?? stats.total_users ?? '—' }}
              </template>
              <span
                v-else
                class="sk-box"
                style="display:inline-block;width:36px;height:1em;border-radius:4px;vertical-align:middle;"
              />
            </div>
            <div class="text-caption text-disabled">
              {{ t('Total') }}
            </div>
          </div>
        </VCardText>
      </VCard>
    </VCol>

    <VCol
      cols="6"
      sm="3"
    >
      <VCard>
        <VCardText class="d-flex align-center gap-2 py-3">
          <VAvatar
            color="success"
            variant="tonal"
            size="32"
            rounded
          >
            <VIcon
              icon="bx-user-check"
              size="16"
            />
          </VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold lh-1 mb-1">
              <template v-if="stats">
                {{ stats.active ?? stats.active_employees ?? stats.active_users ?? '—' }}
              </template>
              <span
                v-else
                class="sk-box"
                style="display:inline-block;width:36px;height:1em;border-radius:4px;vertical-align:middle;"
              />
            </div>
            <div class="text-caption text-disabled">
              {{ t('Active') }}
            </div>
          </div>
        </VCardText>
      </VCard>
    </VCol>

    <VCol
      cols="6"
      sm="3"
    >
      <VCard>
        <VCardText class="d-flex align-center gap-2 py-3">
          <VAvatar
            color="info"
            variant="tonal"
            size="32"
            rounded
          >
            <VIcon
              icon="bx-buildings"
              size="16"
            />
          </VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold lh-1 mb-1">
              <template v-if="stats">
                {{ stats.total_departments ?? '—' }}
              </template>
              <span
                v-else
                class="sk-box"
                style="display:inline-block;width:36px;height:1em;border-radius:4px;vertical-align:middle;"
              />
            </div>
            <div class="text-caption text-disabled">
              {{ t('Departments') }}
            </div>
          </div>
        </VCardText>
      </VCard>
    </VCol>

    <VCol
      cols="6"
      sm="3"
    >
      <VCard>
        <VCardText class="d-flex align-center gap-2 py-3">
          <VAvatar
            color="warning"
            variant="tonal"
            size="32"
            rounded
          >
            <VIcon
              icon="bx-money"
              size="16"
            />
          </VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold lh-1 mb-1">
              <template v-if="stats">
                {{ stats.total_salary ?? '—' }}
              </template>
              <span
                v-else
                class="sk-box"
                style="display:inline-block;width:36px;height:1em;border-radius:4px;vertical-align:middle;"
              />
            </div>
            <div class="text-caption text-disabled">
              {{ t('Total Salary') }}
            </div>
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>
