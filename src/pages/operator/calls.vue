<script setup lang="ts">
import { useTheme } from 'vuetify'
import Button from '@/components/design/Button.vue'
import Field from '@/components/design/Field.vue'
import Input from '@/components/design/Input.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import NavBarI18n from '@/layouts/components/NavBarI18n.vue'
import { useAlphaTheme } from '@/composables/useAlphaTheme'
import { useUserAccess } from '@/composables/useUserAccess'
import { useSessionLogout } from '@/composables/useSessionLogout'
import { loadAdminOrderItems, loadOperatorQueue, operatorCalendarDate } from '@/services/operatorCalls'
import type { OperatorQueue } from '@/types/operatorCalls'
import type { RetentionCollectionProgress } from '@/types/customerRetention'

const { t, locale } = useI18n({ useScope: 'global' })
const { isAdministrator, isOperator, role, currentUserId, hasPermission } = useUserAccess()
const { logout } = useSessionLogout()
const { theme, toggleTheme } = useAlphaTheme(useTheme())
const allowed = computed(() => isAdministrator.value || (isOperator.value && hasPermission('operator.call_queue.view')))
const today = ref(operatorCalendarDate())
const date = ref(operatorCalendarDate(Date.now() - 86400000))
const queue = shallowRef<OperatorQueue | null>(null)
const index = ref(0)
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
const detailError = ref('')
const progress = ref<RetentionCollectionProgress | null>(null)
const finished = ref(false)
const customer = computed(() => queue.value?.customers[index.value] ?? null)
const cardHeading = ref<HTMLElement | null>(null)
let request: AbortController | null = null
let detailRequest: AbortController | null = null
let operation = 0
let detailOperation = 0

const errors = ['oc_error_contract', 'oc_error_permission', 'oc_error_backend', 'oc_error_network', 'oc_error_date', 'oc_error_context', 'oc_error_limit']

function message(errorValue: any): string {
  const key = errorValue?.message
  return t(errors.includes(key) ? key : 'oc_error_network')
}

function time(value: string) {
  return new Intl.DateTimeFormat(locale.value === 'ru' ? 'ru-RU' : 'en-GB', {
    timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function typeLabel(type: string) {
  return t({ HALL: 'oc_hall', DELIVERY: 'oc_delivery', PICKUP: 'oc_pickup' }[type] ?? 'oc_order')
}

function clearQueue() {
  operation += 1
  detailOperation += 1
  request?.abort()
  detailRequest?.abort()
  queue.value = null
  index.value = 0
  finished.value = false
  loading.value = false
  detailLoading.value = false
  error.value = ''
  detailError.value = ''
  progress.value = null
}

async function details() {
  detailRequest?.abort()

  const selected = customer.value
  const current = ++detailOperation
  const abort = new AbortController()

  detailRequest = abort
  detailError.value = ''
  if (!selected || !queue.value?.admin_preview || !selected.orders.some(order => order.items === null)) {
    detailLoading.value = false
    return
  }
  detailLoading.value = true
  try {
    for (const order of selected.orders) {
      if (order.items !== null)
        continue
      const items = await loadAdminOrderItems(order, abort.signal)
      if (current !== detailOperation || abort.signal.aborted)
        return
      order.items = items
    }

    // Queue is deliberately shallow; all source objects remain private to this page.
    triggerRef(queue)
  }
  catch (err) {
    if (!abort.signal.aborted && current === detailOperation)
      detailError.value = message(err)
  }
  finally {
    if (current === detailOperation)
      detailLoading.value = false
  }
}

async function loadDay() {
  if (!allowed.value || loading.value)
    return
  clearQueue()

  const current = ++operation
  const abort = new AbortController()

  request = abort
  loading.value = true
  today.value = operatorCalendarDate()
  try {
    const result = await loadOperatorQueue(date.value, {
      signal: abort.signal,
      onProgress: value => {
        if (current === operation && !abort.signal.aborted)
          progress.value = value
      },
    })

    if (current !== operation || abort.signal.aborted || !allowed.value)
      return
    queue.value = result
    await details()
  }
  catch (err) {
    if (!abort.signal.aborted && current === operation)
      error.value = message(err)
  }
  finally {
    if (current === operation)
      loading.value = false
  }
}

async function move(delta: number) {
  if (!queue.value || loading.value)
    return
  const next = index.value + delta
  if (next >= queue.value.customers.length) {
    detailRequest?.abort()
    detailOperation += 1
    detailLoading.value = false
    finished.value = true
    return
  }
  if (next < 0)
    return
  index.value = next
  finished.value = false
  await details()
  await nextTick()
  cardHeading.value?.focus()
}

async function resumeLast() {
  finished.value = false
  await details()
}

watch(date, clearQueue)
watch([currentUserId, role, allowed], clearQueue, { flush: 'sync' })
watch(locale, () => { document.title = `${t('oc_title')} · Alpha POS` }, { immediate: true })
onBeforeUnmount(clearQueue)
</script>

<template>
  <div class="operator-page">
    <header class="operator-header">
      <div><span class="operator-brand">Alpha POS</span><h1>{{ t('oc_title') }}</h1></div>
      <div class="operator-tools">
        <NavBarI18n />
        <button
          class="operator-icon"
          :aria-label="t('Toggle theme')"
          @click="toggleTheme"
        >
          <DesignIcon
            :name="theme === 'dark' ? 'sun' : 'moon'"
            :size="20"
          />
        </button>
        <Button
          variant="ghost"
          @click="logout"
        >
          {{ t('oc_logout') }}
        </Button>
      </div>
    </header>
    <main class="operator-main">
      <section
        v-if="!allowed"
        class="operator-card"
        role="alert"
      >
        <h2>{{ t('oc_no_access') }}</h2><p>{{ t('oc_error_permission') }}</p>
      </section>
      <template v-else>
        <section class="operator-card operator-day">
          <Field
            :label="t('oc_choose_day')"
            :hint="t('oc_calendar_hint')"
          >
            <Input
              v-model="date"
              type="date"
              min="2026-08-01"
              :max="today"
              :disabled="loading"
            />
          </Field>
          <Button
            variant="primary"
            size="lg"
            :loading="loading"
            @click="loadDay"
          >
            {{ t('oc_show_clients') }}
          </Button>
        </section>
        <div
          v-if="loading"
          class="operator-state"
          role="status"
          aria-live="polite"
        >
          <h2>{{ t('oc_loading') }}</h2>
          <p v-if="progress">
            {{ t('oc_progress', { current: progress.page, total: progress.total_pages }) }}
          </p>
          <Button @click="clearQueue">
            {{ t('oc_stop') }}
          </Button>
        </div>
        <div
          v-else-if="error"
          class="operator-card operator-error"
          role="alert"
        >
          <h2>{{ t('oc_load_failed') }}</h2><p>{{ error }}</p><Button @click="loadDay">
            {{ t('oc_retry') }}
          </Button>
        </div>
        <div
          v-else-if="!queue"
          class="operator-state"
        >
          <DesignIcon
            name="users"
            :size="36"
          /><h2>{{ t('oc_start_title') }}</h2><p>{{ t('oc_start_hint') }}</p>
        </div>
        <div
          v-else-if="!queue.customers.length"
          class="operator-state"
          role="status"
        >
          <h2>{{ t('oc_empty') }}</h2><p>{{ t('oc_empty_hint') }}</p>
        </div>
        <div
          v-else-if="finished"
          class="operator-card operator-state"
          role="status"
        >
          <DesignIcon
            name="check"
            :size="36"
          /><h2>{{ t('oc_finished') }}</h2><p>{{ t('oc_navigation_only') }}</p>
          <Button @click="resumeLast">
            {{ t('oc_back_last') }}
          </Button>
        </div>
        <template v-else-if="customer">
          <div
            class="operator-progress"
            aria-live="polite"
          >
            {{ t('oc_position', { current: index + 1, total: queue.total_customers }) }}
          </div>
          <article class="operator-card operator-customer">
            <p class="operator-eyebrow">
              {{ t('oc_customer') }}
            </p>
            <h2
              ref="cardHeading"
              tabindex="-1"
            >
              {{ customer.name || t('oc_unnamed') }}
            </h2>
            <p class="operator-phone">
              {{ customer.phone }}
            </p>
            <a
              class="operator-call"
              :href="`tel:${customer.phone}`"
            ><DesignIcon
              name="phone"
              :size="22"
            />{{ t('oc_call') }}</a>
            <p class="operator-help">
              {{ t('oc_dialer_hint') }}
            </p>
            <div class="operator-order-heading">
              <h3>{{ t('oc_orders') }}</h3><span>{{ date }}</span>
            </div>
            <p
              v-if="detailLoading"
              role="status"
            >
              {{ t('oc_items_loading') }}
            </p>
            <div
              v-if="detailError"
              class="operator-error"
              role="alert"
            >
              <p>{{ detailError }}</p><Button @click="details">
                {{ t('oc_retry_items') }}
              </Button>
            </div>
            <section
              v-for="order in customer.orders"
              :key="order.id"
              class="operator-order"
            >
              <div class="operator-order-meta">
                <strong>{{ time(order.created_at) }}</strong><span>{{ typeLabel(order.order_type) }}</span><span>#{{ order.order_number || order.id }}</span>
              </div>
              <p
                v-if="order.place_label"
                class="operator-place"
              >
                {{ order.place_label }}
              </p>
              <ul
                v-if="order.items?.length"
                class="operator-items"
              >
                <li
                  v-for="(item, itemIndex) in order.items"
                  :key="itemIndex"
                >
                  <span>{{ item.name }}</span><strong>× {{ item.quantity }}</strong>
                </li>
              </ul>
              <p
                v-else-if="!detailLoading"
                class="operator-help"
              >
                {{ t('oc_items_unknown') }}
              </p>
            </section>
          </article>
          <section class="operator-card operator-questions">
            <h3>{{ t('oc_questions') }}</h3>
            <ol><li>{{ t('oc_taste_question') }}</li><li>{{ t('oc_recommend_question') }}</li></ol>
            <p class="operator-help">
              {{ t('oc_answers_pending') }}
            </p>
          </section>
          <p class="operator-help operator-navigation-note">
            {{ t('oc_navigation_only') }}
          </p>
          <nav
            class="operator-bottom"
            :aria-label="t('oc_client_navigation')"
          >
            <Button
              size="lg"
              :disabled="index === 0"
              @click="move(-1)"
            >
              {{ t('oc_previous') }}
            </Button>
            <Button
              variant="primary"
              size="lg"
              @click="move(1)"
            >
              {{ index + 1 === queue.total_customers ? t('oc_finish') : t('oc_next') }}<DesignIcon
                name="chevright"
                :size="20"
              />
            </Button>
          </nav>
        </template>
      </template>
    </main>
  </div>
</template>

<style scoped>
.operator-page { min-height: 100dvh; background: var(--surface-inset, #f4f5f8); color: var(--text); }
.operator-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px max(16px, calc((100vw - 640px) / 2)); background: var(--surface); border-bottom: 1px solid var(--border); }
.operator-brand { color: var(--text-tertiary); font-size: 12px; font-weight: 700; letter-spacing: .05em; }
.operator-header h1 { font-size: 19px; margin: 2px 0 0; line-height: 1.3; }
.operator-tools { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.operator-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 10px; color: var(--text-secondary); }
.operator-main { width: min(100%, 672px); padding: 20px 16px calc(116px + env(safe-area-inset-bottom)); margin: auto; display: flex; flex-direction: column; gap: 16px; }
.operator-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 22px; min-width: 0; }
.operator-day { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 14px; }
.operator-day > button { margin-top: 24px; }
.operator-day :deep(input) { font-size: 16px; min-height: 46px; }
.operator-state { text-align: center; padding: 30px 18px; color: var(--text-secondary); line-height: 1.6; }
.operator-state h2 { color: var(--text); font-size: 20px; margin: 12px 0; }
.operator-error { color: var(--danger, #c84545); line-height: 1.55; }
.operator-progress { text-align: center; font-size: 14px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.operator-eyebrow { margin: 0 0 6px; color: var(--text-tertiary); font-size: 12px; text-transform: uppercase; letter-spacing: .07em; }
.operator-customer h2 { margin: 0; font-size: 23px; line-height: 1.3; overflow-wrap: anywhere; }
.operator-phone { font-variant-numeric: tabular-nums; font-size: clamp(21px, 6vw, 29px); font-weight: 650; letter-spacing: .015em; margin: 16px 0; overflow-wrap: anywhere; }
.operator-call { display: flex; justify-content: center; align-items: center; gap: 10px; width: 100%; min-height: 56px; border-radius: 12px; background: var(--primary); color: var(--on-primary, white); font-size: 18px; font-weight: 650; text-decoration: none; }
.operator-help { color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin: 10px 0 0; }
.operator-order-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 26px; }
.operator-order-heading h3, .operator-questions h3 { font-size: 16px; margin: 0; }
.operator-order-heading span { color: var(--text-secondary); font-size: 13px; }
.operator-order { padding-top: 16px; margin-top: 16px; border-top: 1px solid var(--border); }
.operator-order-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 14px; color: var(--text-secondary); }
.operator-order-meta strong { color: var(--text); font-variant-numeric: tabular-nums; }
.operator-order-meta span:last-child { margin-inline-start: auto; font-variant-numeric: tabular-nums; }
.operator-items { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 9px; }
.operator-items li { display: flex; justify-content: space-between; gap: 16px; line-height: 1.45; font-size: 15px; }
.operator-items span { overflow-wrap: anywhere; }
.operator-items strong { flex-shrink: 0; font-variant-numeric: tabular-nums; }
.operator-place { font-size: 14px; margin: 10px 0; }
.operator-questions ol { padding-inline-start: 22px; margin-bottom: 0; line-height: 1.65; }
.operator-questions li + li { margin-top: 12px; }
.operator-navigation-note { padding: 0 6px; }
.operator-bottom { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: min(100%, 672px); padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px; background: var(--surface); border-top: 1px solid var(--border); z-index: 20; }
.operator-bottom button { min-height: 54px; font-size: 16px; white-space: normal; }
.operator-call:focus-visible, .operator-icon:focus-visible, .operator-customer h2:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px; }
@media (max-width: 480px) { .operator-header { align-items: flex-start; padding: 14px 16px; flex-wrap: wrap; } .operator-header h1 { font-size: 18px; } .operator-tools { margin-left: auto; } .operator-card { padding: 18px; } .operator-day { grid-template-columns: minmax(0, 1fr); } .operator-day > button { margin-top: 0; min-height: 48px; } }
</style>

<route lang="yaml">
name: operator-calls
meta:
  layout: blank
  action: read
  subject: Auth
</route>
