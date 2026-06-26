<script setup lang="ts">
import { useGenerateImageVariant } from '@/@core/composable/useGenerateImageVariant'
import boyWithRocketDark from '@images/illustrations/boy-with-rocket-dark.png'
import boyWithRocketLight from '@images/illustrations/boy-with-rocket-light.png'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import NavBarApiHost from '@/layouts/components/NavBarApiHost.vue'
import { themeConfig } from '@themeConfig'
import axiosIns from '@/plugins/axios'
import ability from '@/plugins/casl/ability'
import { useApiError } from '@/composables/useApiError'
import { setBusinessDayStart } from '@/composables/useBusinessDay'

const { t, locale } = useI18n({ useScope: 'global' })
const { translate } = useApiError()
const router = useRouter()
const route = useRoute()

const form = ref({ email: '', password: '' })
const isPasswordVisible = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')

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

const login = async () => {
  isLoading.value = true
  errorMsg.value = ''

  try {
    const { data } = await axiosIns.post('/auth-login', {
      email: form.value.email,
      password: form.value.password,
    })

    const { token, user } = data.data

    localStorage.setItem('accessToken', JSON.stringify(token))
    localStorage.setItem('userData', JSON.stringify(user))

    // Per-restaurant overnight-shift boundary (default 03:00). BE exposes it
    // on /auth-me (top-level) and /app-settings (under data.settings). The
    // /auth-login response does NOT carry it, so we fan out to /auth-me after
    // login. Best-effort: failure here is non-fatal — useBusinessDay falls
    // back to its 03:00 default.
    try {
      const meRes = await axiosIns.get('/auth-me')
      const me = meRes?.data?.data ?? {}
      const bds: unknown = me?.business_day_start
        ?? me?.user?.business_day_start
        ?? me?.restaurant?.business_day_start
      if (typeof bds === 'string' && /^\d{1,2}:\d{2}/.test(bds))
        setBusinessDayStart(bds.slice(0, 5))
      // Refresh cached userData with the fuller /auth-me payload so other
      // pages that read userData see the new field too.
      if (me && typeof me === 'object')
        localStorage.setItem('userData', JSON.stringify({ ...user, ...me }))
    }
    catch { /* noop — keep prior default */ }

    // Temporary: grant manage-all to every authenticated user. Backend still
    // enforces per-endpoint via @admin_required / @permission_required, so
    // this is a UI gate only. Restore role-based CASL once finer-grained
    // routing is needed.
    const userAbilities = [{ action: 'manage', subject: 'all' }]

    localStorage.setItem('userAbilities', JSON.stringify(userAbilities))
    ability.update(userAbilities)

    const redirectTo = route.query.to ? String(route.query.to) : '/'

    router.replace(redirectTo)
  }
  catch (err: any) {
    errorMsg.value = translate(err) || t('login_error')
  }
  finally {
    isLoading.value = false
  }
}
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
