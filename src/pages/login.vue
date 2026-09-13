<script setup lang="ts">
import { useGenerateImageVariant } from '@/@core/composable/useGenerateImageVariant'
import boyWithRocketDark from '@images/illustrations/boy-with-rocket-dark.png'
import boyWithRocketLight from '@images/illustrations/boy-with-rocket-light.png'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import NavBarApiHost from '@/layouts/components/NavBarApiHost.vue'
import { themeConfig } from '@themeConfig'
import axiosIns, { getCurrentApiHost } from '@/plugins/axios'
import ability, { initialAbility } from '@/plugins/casl/ability'
import { useApiError } from '@/composables/useApiError'
import { hydrateBusinessSettings, setBusinessDayStart } from '@/composables/useBusinessDay'
import { canHydrateBusinessSettings, loginAbilities, postLoginPath, sessionRole } from '@/navigation/operatorAccess'
import { finishLoginLink, takeLoginLink } from '@/bootstrap/loginLink'
import { getStoredToken } from '@/utils/storage'

const { t, locale } = useI18n({ useScope: 'global' })
const { translate } = useApiError()
const router = useRouter()
const route = useRoute()

const form = ref({ email: '', password: '' })
const isPasswordVisible = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')
const isLinkLogin = ref(false)
const accountSwitchRequired = ref(false)

interface LoginContext {
  token: string | null
  host: string
}

interface AccountSwitchContext extends LoginContext {
  logoutToken: string | null
}

let accountSwitchContext: AccountSwitchContext | null = null

const boyWithRocket = useGenerateImageVariant(boyWithRocketLight, boyWithRocketDark)

const languages = computed(() => [
  { code: 'uz', label: t('lang_native_uz') },
  { code: 'ru', label: t('lang_native_ru') },
  { code: 'en', label: t('lang_native_en') },
])

const setLocale = (code: string) => {
  locale.value = code
  localStorage.setItem('appLocale', code)
}

function persistSessionUser(user: Record<string, any>) {
  const userAbilities = loginAbilities(sessionRole(user))

  localStorage.setItem('userData', JSON.stringify(user))
  localStorage.setItem('userAbilities', JSON.stringify(userAbilities))
  ability.update(userAbilities)
  window.dispatchEvent(new Event('user-access-changed'))
}

function clearLocalSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('userData')
  localStorage.removeItem('userAbilities')
  ability.update(initialAbility)
  window.dispatchEvent(new Event('user-access-changed'))
}

function assertLoginContext(token: string | null, host: string) {
  if (getStoredToken() !== token || getCurrentApiHost() !== host)
    throw new Error('login_session_changed')
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function userIdentity(user: Record<string, any>): unknown {
  return user.id ?? user.user_id ?? user.user?.id ?? user.user?.user_id
}

function validUserIdentity(id: unknown): boolean {
  return (typeof id === 'string' && Boolean(id.trim()))
    || (typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
}

function validSessionUser(user: unknown): user is Record<string, any> {
  if (!isRecord(user))
    return false
  const role = user.role ?? user.user?.role

  return typeof role === 'string' && Boolean(role.trim()) && validUserIdentity(userIdentity(user))
}

function loginResponse(body: any): { token: string; user: Record<string, any> } {
  const token = body?.data?.token
  const user = body?.data?.user
  if (body?.success === false || typeof token !== 'string' || !token.trim()
    || !validSessionUser(user))
    throw new Error('login_invalid_response')
  return { token, user }
}

function beginLoginContext(): AccountSwitchContext {
  const logoutToken = getStoredToken()
  const host = getCurrentApiHost()

  accountSwitchContext = null
  accountSwitchRequired.value = false

  // A credential link deliberately starts a new session, even if one was saved.
  if (isLinkLogin.value)
    clearLocalSession()

  return { token: getStoredToken(), host, logoutToken }
}

function parseSessionMetadata(body: any, user: Record<string, any>) {
  const me = body?.data
  if (body?.success === false || !isRecord(me) || ('user' in me && !isRecord(me.user)))
    throw new Error('login_invalid_response')
  const identity = me.user ?? me
  const receivedId = userIdentity(identity)
  if (receivedId != null && String(receivedId) !== String(userIdentity(user)))
    throw new Error('login_invalid_response')
  const sessionUser = { ...user, ...me, ...identity }
  if (!validSessionUser(sessionUser))
    throw new Error('login_invalid_response')

  return { me, sessionUser }
}

function applyBusinessDayMetadata(me: Record<string, any>) {
  const bds: unknown = me.business_day_start ?? me.user?.business_day_start ?? me.restaurant?.business_day_start
  if (typeof bds === 'string' && /^\d{1,2}:\d{2}/.test(bds))
    setBusinessDayStart(bds.slice(0, 5))
}

function handleMetadataError(err: any, context: LoginContext) {
  assertLoginContext(context.token, context.host)
  if (err?.code === 'ERR_AUTH_CONTEXT' || err?.message === 'login_session_changed')
    throw err
  if ([401, 403].includes(err?.response?.status)) {
    clearLocalSession()
    throw new Error('login_session_rejected')
  }
  if (err?.message === 'login_invalid_response') {
    clearLocalSession()
    throw err
  }

  // Optional metadata outages are non-fatal; replaced or rejected sessions are not.
}

async function hydrateSessionUser(user: Record<string, any>, context: LoginContext) {
  try {
    const response = await axiosIns.get('/auth-me', { skipAuthRedirect: true, expectedAuthContext: context })

    assertLoginContext(context.token, context.host)

    const { me, sessionUser } = parseSessionMetadata(response?.data, user)

    applyBusinessDayMetadata(me)
    persistSessionUser(sessionUser)
    return sessionUser
  }
  catch (err: any) {
    handleMetadataError(err, context)
    return user
  }
}

async function completeLogin(user: Record<string, any>, context: LoginContext) {
  assertLoginContext(context.token, context.host)

  const role = sessionRole(user)
  if (canHydrateBusinessSettings(role))
    hydrateBusinessSettings().catch(() => { /* Settings hydration is non-fatal. */ })
  finishLoginLink()
  accountSwitchContext = null
  accountSwitchRequired.value = false
  await router.replace(postLoginPath(role, route.query.to))
}

function displayLoginError(err: any, context: AccountSwitchContext) {
  const safeErrors = ['login_session_changed', 'login_session_rejected', 'login_invalid_response']

  if (err?.code === 'ERR_AUTH_CONTEXT') {
    errorMsg.value = t('login_session_changed')
    return
  }
  if (err?.response?.status === 409 && err?.response?.data?.code === 'account_switch_requires_logout') {
    if (getStoredToken() !== context.token || getCurrentApiHost() !== context.host) {
      errorMsg.value = t('login_session_changed')
      return
    }
    accountSwitchContext = context
    accountSwitchRequired.value = true
    errorMsg.value = t('login_link_logout_required')
    return
  }
  accountSwitchContext = null
  errorMsg.value = safeErrors.includes(err?.message) ? t(err.message) : (translate(err) || t('login_error'))
}

const login = async () => {
  if (isLoading.value)
    return
  isLoading.value = true
  errorMsg.value = ''

  const context = beginLoginContext()

  try {
    const { data } = await axiosIns.post('/auth-login', { email: form.value.email, password: form.value.password }, {
      expectedAuthContext: { token: context.token, host: context.host },
    })

    assertLoginContext(context.token, context.host)

    const { token, user } = loginResponse(data)
    const nextContext = { token, host: context.host }

    localStorage.setItem('accessToken', JSON.stringify(token))
    persistSessionUser(user)

    const sessionUser = await hydrateSessionUser(user, nextContext)

    await completeLogin(sessionUser, nextContext)
  }
  catch (err: any) {
    displayLoginError(err, context)
  }
  finally {
    if (isLinkLogin.value)
      form.value.password = ''
    isLoading.value = false
  }
}

async function logoutForAccountSwitch() {
  const context = accountSwitchContext
  if (isLoading.value || !accountSwitchRequired.value || !context)
    return
  isLoading.value = true
  try {
    // The server can retain an HTTP-only session cookie. Revoke only after this
    // explicit user action, never by bypassing its account-switch guard.
    assertLoginContext(context.token, context.host)

    const response = await axiosIns.post('/auth-logout', undefined, {
      skipAuthRedirect: true,
      expectedAuthContext: { token: context.token, host: context.host },
      headers: context.logoutToken ? { Authorization: `Bearer ${context.logoutToken}` } : undefined,
    })

    assertLoginContext(context.token, context.host)
    if (response?.data?.success === false)
      throw new Error('login_invalid_response')
    clearLocalSession()
    accountSwitchRequired.value = false
    accountSwitchContext = null
    errorMsg.value = ''
  }
  catch (err: any) {
    errorMsg.value = (err?.message === 'login_session_changed' || err?.code === 'ERR_AUTH_CONTEXT')
      ? t('login_session_changed')
      : (translate(err) || t('login_error'))
  }
  finally { isLoading.value = false }
}

async function initializeLoginLink() {
  const link = takeLoginLink()
  if (!link)
    return
  form.value.email = link.email
  if (link.invalid) {
    errorMsg.value = t('login_link_invalid')
    return
  }
  if (!link.password)
    return
  form.value.password = link.password
  link.password = ''
  isLinkLogin.value = true
  try { await login() }
  finally { isLinkLogin.value = false }
}

onMounted(initializeLoginLink)
</script>

<template>
  <VRow
    no-gutters
    class="auth-wrapper"
  >
    <!-- Left illustration -->
    <VCol
      md="8"
      class="d-none d-md-flex"
    >
      <div class="position-relative w-100 pa-8">
        <div class="d-flex align-center justify-center w-100 h-100">
          <VImg
            :src="boyWithRocket"
            class="auth-illustration"
            :alt="t('login_illustration_alt')"
          />
        </div>
      </div>
    </VCol>

    <!-- Login form -->
    <VCol
      cols="12"
      md="4"
      class="auth-card-v2 d-flex align-center justify-center"
      style="background-color: rgb(var(--v-theme-surface))"
    >
      <VCard
        flat
        :max-width="500"
        class="mt-12 mt-sm-0 pa-6 w-100"
      >
        <!-- Language switcher + API host -->
        <div class="login-toolbar d-flex align-center justify-end flex-wrap gap-2 mb-2">
          <NavBarApiHost />
          <VBtnToggle
            :model-value="locale"
            density="compact"
            variant="outlined"
            divided
            mandatory
          >
            <VBtn
              v-for="lang in languages"
              :key="lang.code"
              :value="lang.code"
              size="small"
              :aria-label="t('switch_language')"
              @click="setLocale(lang.code)"
            >
              {{ lang.label }}
            </VBtn>
          </VBtnToggle>
        </div>

        <!-- Logo + app title -->
        <VCardItem class="justify-start px-0">
          <template #prepend>
            <div class="d-flex">
              <VNodeRenderer :nodes="themeConfig.app.logo" />
            </div>
          </template>
          <VCardTitle class="auth-title">
            {{ themeConfig.app.title }}
          </VCardTitle>
        </VCardItem>

        <VCardText class="px-0">
          <h6 class="text-h6 mb-1">
            {{ t('welcome_to', { appName: themeConfig.app.title }) }}
          </h6>
          <p class="mb-0 text-body-2">
            {{ t('login_subtitle') }}
          </p>
        </VCardText>

        <VCardText class="px-0">
          <!-- Error alert -->
          <VAlert
            v-if="errorMsg"
            type="error"
            variant="tonal"
            class="mb-4"
            closable
            @click:close="errorMsg = ''"
          >
            {{ errorMsg }}
          </VAlert>

          <VBtn
            v-if="accountSwitchRequired"
            class="mb-4"
            variant="outlined"
            :loading="isLoading"
            @click="logoutForAccountSwitch"
          >
            {{ t('login_link_logout') }}
          </VBtn>

          <p
            v-if="isLinkLogin && isLoading"
            class="mb-4 text-body-2"
            role="status"
            aria-live="polite"
          >
            {{ t('login_link_signing_in') }}
          </p>

          <VForm @submit.prevent="login">
            <VRow>
              <VCol cols="12">
                <VTextField
                  v-model="form.email"
                  autofocus
                  :label="t('Email')"
                  type="email"
                  :disabled="isLoading"
                />
              </VCol>

              <VCol cols="12">
                <VTextField
                  v-model="form.password"
                  :label="t('Password')"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isPasswordVisible ? 'bx-hide' : 'bx-show'"
                  :disabled="isLoading"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />

                <VBtn
                  block
                  type="submit"
                  class="mb-1 mt-6"
                  :loading="isLoading"
                >
                  {{ t('login_btn') }}
                </VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style lang="scss">
.layout-blank,
.layout-wrapper.layout-blank {
  min-block-size: 100vh;
}

.auth-wrapper {
  min-block-size: 100vh;
}

.auth-illustration {
  z-index: 1;
  max-inline-size: 700px;
  inline-size: 100%;
}

.auth-title {
  font-size: 28px;
  font-weight: 700;
}

@media (max-width: 1200px) {
  .auth-illustration {
    max-inline-size: 520px;
  }
}

@media (max-width: 900px) {
  .auth-title {
    font-size: 22px;
  }

  .login-toolbar {
    justify-content: flex-start !important;
  }
}

@media (max-width: 768px) {
  .auth-card-v2 .v-card.pa-6 {
    padding: 16px !important;
  }

  .auth-title {
    font-size: 20px;
  }

  .login-toolbar {
    gap: 4px !important;
  }
}

@media (max-width: 420px) {
  .auth-card-v2 .v-card.pa-6 {
    padding: 12px !important;
  }

  .auth-title {
    font-size: 18px;
  }

  .login-toolbar .v-btn {
    min-width: 0;
    padding: 0 8px;
  }
}
</style>

<route lang="yaml">
meta:
  layout: blank
  action: read
  subject: Auth
  redirectIfLoggedIn: true
</route>
