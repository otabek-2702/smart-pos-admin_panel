<script setup lang="ts">
import { initialAbility } from '@/plugins/casl/ability'
import { useAppAbility } from '@/plugins/casl/useAppAbility'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const ability = useAppAbility()
const userData = JSON.parse(localStorage.getItem('userData') || 'null')

const userFullName = computed(() => {
  if (!userData) return ''
  if (userData.first_name || userData.last_name)
    return `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
  return userData.fullName || userData.username || userData.email || ''
})

const userRole = computed(() => {
  if (!userData) return ''
  return userData.role || ''
})

const logout = () => {
  localStorage.removeItem('userData')
  localStorage.removeItem('accessToken')

  router.push('/login')
    .then(() => {
      localStorage.removeItem('userAbilities')
      ability.update(initialAbility)
    })
}
</script>

<template>
  <VBadge
    dot
    bordered
    location="bottom right"
    offset-x="3"
    offset-y="3"
    color="success"
  >
    <VAvatar
      class="cursor-pointer"
      color="primary"
      variant="tonal"
    >
      <VImg
        v-if="userData && userData.avatar"
        :src="userData.avatar"
      />
      <VIcon
        v-else
        icon="bx-user"
      />

      <VMenu
        activator="parent"
        width="250"
        location="bottom end"
        offset="14px"
      >
        <VList>
          <VListItem>
            <template #prepend>
              <VListItemAction start>
                <VBadge
                  dot
                  location="bottom right"
                  offset-x="3"
                  offset-y="3"
                  color="success"
                >
                  <VAvatar
                    color="primary"
                    variant="tonal"
                  >
                    <VImg
                      v-if="userData && userData.avatar"
                      :src="userData.avatar"
                    />
                    <VIcon
                      v-else
                      icon="bx-user"
                    />
                  </VAvatar>
                </VBadge>
              </VListItemAction>
            </template>

            <VListItemTitle class="font-weight-semibold">
              {{ userFullName }}
            </VListItemTitle>
            <VListItemSubtitle>{{ userRole }}</VListItemSubtitle>
          </VListItem>

          <VDivider class="my-2" />

          <VListItem v-if="userData?.email">
            <template #prepend>
              <VIcon
                class="me-2"
                icon="bx-envelope"
                size="22"
              />
            </template>
            <VListItemTitle class="text-body-2">
              {{ userData.email }}
            </VListItemTitle>
          </VListItem>

          <VListItem v-if="userData?.last_login_at">
            <template #prepend>
              <VIcon
                class="me-2"
                icon="bx-time"
                size="22"
              />
            </template>
            <VListItemTitle class="text-body-2">
              {{ t('Last Login') }}
            </VListItemTitle>
            <VListItemSubtitle class="text-caption">
              {{ new Date(userData.last_login_at).toLocaleString() }}
            </VListItemSubtitle>
          </VListItem>

          <VDivider class="my-2" />

          <VListItem
            link
            @click="logout"
          >
            <template #prepend>
              <VIcon
                class="me-2"
                icon="bx-log-out"
                size="22"
                color="error"
              />
            </template>
            <VListItemTitle class="text-error">
              {{ t('Logout') }}
            </VListItemTitle>
          </VListItem>
        </VList>
      </VMenu>
    </VAvatar>
  </VBadge>
</template>
