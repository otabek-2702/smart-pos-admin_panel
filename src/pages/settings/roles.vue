<script setup lang="ts">
import axios from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

interface PermissionDef { key: string; label: string; group: string }
interface RoleRow { name: string; permissions: string[] }

const permissions = ref<PermissionDef[]>([])
const roles = ref<RoleRow[]>([])
const loading = ref(false)
const saving = ref<string | null>(null)
const selectedRole = ref<string | null>(null)

async function loadAll() {
  loading.value = true
  try {
    const [pRes, rRes] = await Promise.all([
      axios.get('/permissions'),
      axios.get('/roles'),
    ])
    const pd = pRes.data?.data ?? pRes.data
    const rd = rRes.data?.data ?? rRes.data

    permissions.value = pd?.permissions ?? []
    roles.value = rd?.roles ?? []
    if (!selectedRole.value && roles.value.length)
      selectedRole.value = roles.value[0].name
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(loadAll)

const groupedPermissions = computed(() => {
  const map: Record<string, PermissionDef[]> = {}
  for (const p of permissions.value) {
    const g = p.group || t('Other')
    if (!map[g])
      map[g] = []
    map[g].push(p)
  }

  return map
})

const currentRole = computed<RoleRow | null>(() =>
  roles.value.find(r => r.name === selectedRole.value) ?? null,
)

const isWildcard = computed(() => currentRole.value?.permissions?.includes('*') ?? false)

function hasPerm(key: string) {
  if (!currentRole.value)
    return false

  return currentRole.value.permissions.includes(key)
}

function toggleAdminWildcard() {
  if (!currentRole.value)
    return
  if (isWildcard.value)
    currentRole.value.permissions = []
  else
    currentRole.value.permissions = ['*']
}

function togglePerm(key: string) {
  if (!currentRole.value)
    return
  if (isWildcard.value) {
    notify(t('Wildcard active — disable it first to manage per-permission'), 'warning')

    return
  }
  const idx = currentRole.value.permissions.indexOf(key)
  if (idx === -1)
    currentRole.value.permissions.push(key)
  else
    currentRole.value.permissions.splice(idx, 1)
}

function toggleGroup(group: string, on: boolean) {
  if (!currentRole.value || isWildcard.value)
    return
  const keys = (groupedPermissions.value[group] ?? []).map(p => p.key)
  if (on) {
    for (const k of keys) {
      if (!currentRole.value.permissions.includes(k))
        currentRole.value.permissions.push(k)
    }
  }
  else {
    currentRole.value.permissions = currentRole.value.permissions.filter(p => !keys.includes(p))
  }
}

function groupAllOn(group: string) {
  if (!currentRole.value)
    return false
  const keys = (groupedPermissions.value[group] ?? []).map(p => p.key)

  return keys.length > 0 && keys.every(k => currentRole.value!.permissions.includes(k))
}

async function saveRole() {
  if (!currentRole.value)
    return
  const name = currentRole.value.name
  saving.value = name
  try {
    const res = await axios.patch(`/roles/${name}`, { permissions: currentRole.value.permissions })
    const d = res.data?.data ?? res.data

    if (d?.permissions)
      currentRole.value.permissions = d.permissions
    notify(t('Role updated'))
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = null
  }
}

const roleColor: Record<string, string> = {
  ADMIN: 'error',
  MANAGER: 'primary',
  CASHIER: 'warning',
  WAITER: 'info',
  USER: 'secondary',
}
</script>

<template>
  <div>
    <VRow>
      <!-- Left: role list -->
      <VCol
        cols="12"
        md="3"
      >
        <VCard>
          <VCardText class="d-flex align-center justify-space-between py-3">
            <span class="text-h6">{{ t('Roles') }}</span>
            <VBtn
              icon
              variant="text"
              size="small"
              @click="loadAll"
            >
              <VIcon icon="bx-refresh" />
            </VBtn>
          </VCardText>
          <VDivider />
          <VList density="compact">
            <template v-if="loading && !roles.length">
              <VListItem
                v-for="n in 5"
                :key="n"
              >
                <div
                  class="sk-box"
                  style="width:100%;height:18px;border-radius:4px;"
                />
              </VListItem>
            </template>
            <VListItem
              v-for="r in roles"
              :key="r.name"
              :active="selectedRole === r.name"
              @click="selectedRole = r.name"
            >
              <template #prepend>
                <VAvatar
                  size="32"
                  :color="roleColor[r.name] ?? 'default'"
                  variant="tonal"
                >
                  <span class="text-caption font-weight-bold">{{ r.name[0] }}</span>
                </VAvatar>
              </template>
              <VListItemTitle>{{ r.name }}</VListItemTitle>
              <VListItemSubtitle>
                {{ r.permissions.includes('*') ? t('Wildcard') : `${r.permissions.length} ${t('perms')}` }}
              </VListItemSubtitle>
            </VListItem>
          </VList>
        </VCard>
      </VCol>

      <!-- Right: editor -->
      <VCol
        cols="12"
        md="9"
      >
        <div
          v-if="!currentRole"
          class="text-center text-disabled py-8"
        >
          <VIcon
            icon="bx-shield"
            size="56"
            class="mb-2"
          />
          <div class="text-h6">
            {{ t('Pick a role to edit') }}
          </div>
        </div>

        <template v-else>
          <VCard class="mb-4">
            <VCardText class="d-flex align-center gap-3 flex-wrap">
              <VChip
                :color="roleColor[currentRole.name] ?? 'default'"
                variant="tonal"
                size="large"
              >
                {{ currentRole.name }}
              </VChip>
              <div>
                <div class="text-subtitle-2">
                  {{ t('Effective permissions') }}
                </div>
                <div class="text-caption text-disabled">
                  {{ isWildcard ? t('Wildcard — full manage-all access') : `${currentRole.permissions.length} / ${permissions.length}` }}
                </div>
              </div>
              <VSpacer />
              <VBtn
                variant="tonal"
                :color="isWildcard ? 'warning' : 'default'"
                :prepend-icon="isWildcard ? 'bx-shield-alt-2' : 'bx-shield'"
                @click="toggleAdminWildcard"
              >
                {{ isWildcard ? t('Disable wildcard') : t('Grant wildcard (*)') }}
              </VBtn>
              <VBtn
                color="primary"
                :loading="saving === currentRole.name"
                @click="saveRole"
              >
                {{ t('Save Role') }}
              </VBtn>
            </VCardText>
          </VCard>

          <VAlert
            v-if="isWildcard"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            {{ t('Wildcard grants every permission — including future ones added later. Per-permission toggles are disabled until you turn it off.') }}
          </VAlert>

          <VCard
            v-for="(perms, group) in groupedPermissions"
            :key="group"
            class="mb-3"
          >
            <VCardText>
              <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-subtitle-1 font-weight-medium">{{ group }}</span>
                <VBtnToggle
                  :model-value="groupAllOn(group) ? 'on' : 'off'"
                  density="compact"
                  variant="outlined"
                  :disabled="isWildcard"
                >
                  <VBtn
                    size="x-small"
                    value="off"
                    @click="toggleGroup(group, false)"
                  >
                    {{ t('None') }}
                  </VBtn>
                  <VBtn
                    size="x-small"
                    value="on"
                    @click="toggleGroup(group, true)"
                  >
                    {{ t('All') }}
                  </VBtn>
                </VBtnToggle>
              </div>
              <VRow dense>
                <VCol
                  v-for="p in perms"
                  :key="p.key"
                  cols="12"
                  sm="6"
                  md="4"
                >
                  <VCheckbox
                    :model-value="hasPerm(p.key)"
                    :label="p.label || p.key"
                    :disabled="isWildcard"
                    density="compact"
                    hide-details
                    @update:model-value="togglePerm(p.key)"
                  >
                    <template #label>
                      <div>
                        <div>{{ p.label || p.key }}</div>
                        <div class="text-caption text-disabled">
                          {{ p.key }}
                        </div>
                      </div>
                    </template>
                  </VCheckbox>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
        </template>
      </VCol>
    </VRow>

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
