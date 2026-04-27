<script setup lang="ts">
import { useGenerateImageVariant } from '@/@core/composable/useGenerateImageVariant'
import boyWithRocketDark from '@images/illustrations/boy-with-rocket-dark.png'
import boyWithRocketLight from '@images/illustrations/boy-with-rocket-light.png'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import { themeConfig } from '@themeConfig'
import axiosIns from '@/plugins/axios'
import ability from '@/plugins/casl/ability'

const { t, locale } = useI18n({ useScope: 'global' })
const router = useRouter()
const route = useRoute()

const form = ref({ email: '', password: '' })
const isPasswordVisible = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')

const boyWithRocket = useGenerateImageVariant(boyWithRocketLight, boyWithRocketDark)

const languages = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

const setLocale = (code: string) => {
  locale.value = code
  localStorage.setItem('appLocale', code)
}

const login = async () => {
  isLoading.value = true
  errorMsg.value = ''

  try {
    const { data } = await axiosIns.post('/admins-api/login', {
      email: form.value.email,
      password: form.value.password,
    })

    const { token, user } = data.data

    localStorage.setItem('accessToken', JSON.stringify(token))
    localStorage.setItem('userData', JSON.stringify(user))

    const userAbilities = [{ action: 'manage', subject: 'all' }]
    localStorage.setItem('userAbilities', JSON.stringify(userAbilities))
    ability.update(userAbilities)

    const redirectTo = route.query.to ? String(route.query.to) : '/'
    router.replace(redirectTo)
  }
  catch (err: any) {
    const msg = err.response?.data?.message
    errorMsg.value = msg || t('login_error')
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <VRow no-gutters class="auth-wrapper">
    <!-- Left illustration -->
    <VCol md="8" class="d-none d-md-flex">
      <div class="position-relative w-100 pa-8">
        <div class="d-flex align-center justify-center w-100 h-100">
          <VImg
            max-width="700"
            :src="boyWithRocket"
            class="auth-illustration"
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
      <VCard flat :max-width="500" class="mt-12 mt-sm-0 pa-6 w-100">
        <!-- Language switcher -->
        <div class="d-flex justify-end mb-2">
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
// @use "@core/scss/template/pages/page-auth.scss";
</style>

<route lang="yaml">
meta:
  layout: blank
  action: read
  subject: Auth
  redirectIfLoggedIn: true
</route>
