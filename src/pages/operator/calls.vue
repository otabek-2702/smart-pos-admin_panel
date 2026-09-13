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
import { getCurrentApiHost } from '@/plugins/axios'
import { loadAdminOrderDetails, loadOperatorQueue, operatorCalendarDate } from '@/services/operatorCalls'
import { readOperatorCallProgress, saveOperatorCallProgress } from '@/utils/operatorCallProgress'
import type { OperatorCallProgress } from '@/utils/operatorCallProgress'
import type { OperatorOrder, OperatorQueue } from '@/types/operatorCalls'
import type { RetentionCollectionProgress } from '@/types/customerRetention'

const { t, locale } = useI18n({ useScope: 'global' })
const { isAdministrator, isOperator, role, serverRole, email, currentUserId, hasPermission } = useUserAccess()
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
const focused = ref(false)
const resumeNotice = ref('')
const progressSaveFailed = ref(false)
const customer = computed(() => queue.value?.customers[index.value] ?? null)
const cardHeading = ref<HTMLElement | null>(null)
const dayHeading = ref<HTMLElement | null>(null)
const workspace = ref<HTMLElement | null>(null)
let request: AbortController | null = null
let detailRequest: AbortController | null = null
let operation = 0
let detailOperation = 0
let queueHost: string | null = null
let disposed = false

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

function visibleOrderComment(order: OperatorOrder): string | null {
  const comment = order.comment?.trim()
  if (!comment)
    return null
  const comparable = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
  if (order.order_type === 'DELIVERY' && order.delivery_address
    && comparable(comment) === comparable(order.delivery_address))
    return null
  return comment
}

function preparationLabel(order: OperatorOrder): string {
  const seconds = order.preparation_time_seconds
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0)
    return t('oc_preparation_minutes', { minutes: Math.ceil(seconds / 60) })
  return (detailLoading.value && order.items === null) ? '…' : t('oc_preparation_unknown')
}

function progressScope() {
  if (!allowed.value || !isOperator.value || currentUserId.value == null)
    return null
  return { userId: currentUserId.value, apiHost: getCurrentApiHost() }
}

function savePosition() {
  const scope = progressScope()
  const orderId = customer.value?.orders[0]?.id
  if (!scope || !queue.value || !orderId || queueHost !== scope.apiHost)
    return
  progressSaveFailed.value = !saveOperatorCallProgress(scope, {
    date: queue.value.date,
    orderId,
    finished: finished.value,
    totalCustomers: queue.value.total_customers,
  })
}

function applySavedPosition(saved: OperatorCallProgress | null) {
  const result = queue.value
  if (!saved || saved.date !== date.value || !result?.customers.length)
    return
  const savedIndex = result.customers.findIndex(entry => entry.orders.some(order => order.id === saved.orderId))
  if (savedIndex < 0) {
    resumeNotice.value = t('oc_resume_missing')
    return
  }
  index.value = savedIndex
  finished.value = saved.finished && savedIndex === result.customers.length - 1
    && saved.totalCustomers === result.total_customers
}

async function restoreSavedDay() {
  const scope = progressScope()
  if (!scope || disposed)
    return
  const saved = readOperatorCallProgress(scope, operatorCalendarDate())
  if (!saved)
    return
  date.value = saved.date
  await nextTick()
  if (disposed || date.value !== saved.date || JSON.stringify(scope) !== JSON.stringify(progressScope()) || loading.value)
    return
  await loadDay()
}

function queueContextValid(): boolean {
  if (queueHost === null || queueHost === getCurrentApiHost())
    return true
  clearQueue()
  error.value = t('oc_error_context')
  return false
}

function clearQueue() {
  operation += 1
  detailOperation += 1
  request?.abort()
  detailRequest?.abort()
  queue.value = null
  index.value = 0
  finished.value = false
  focused.value = false
  loading.value = false
  detailLoading.value = false
  error.value = ''
  detailError.value = ''
  progress.value = null
  queueHost = null
  resumeNotice.value = ''
  progressSaveFailed.value = false
}

async function focusWorkspace() {
  const current = operation
  const selected = index.value

  await nextTick()
  if (!focused.value || current !== operation || selected !== index.value)
    return
  const target = (!loading.value && !finished.value && customer.value) ? cardHeading.value : workspace.value

  target?.focus({ preventScroll: true })

  // Immediate movement also respects reduced-motion preferences.
  workspace.value?.scrollIntoView({ block: 'start', behavior: 'auto' })
}

async function returnToDay() {
  clearQueue()

  const current = operation

  await nextTick()
  if (current !== operation || focused.value)
    return
  dayHeading.value?.focus({ preventScroll: true })
  dayHeading.value?.scrollIntoView({ block: 'start', behavior: 'auto' })
}

async function details() {
  if (!queueContextValid())
    return
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
      const context = await loadAdminOrderDetails(order, abort.signal)
      if (current !== detailOperation || abort.signal.aborted)
        return
      order.items = context.items
      order.comment = context.comment
      order.delivery_address = context.delivery_address
      order.ready_at = context.ready_at
      order.preparation_time_seconds = context.preparation_time_seconds
      triggerRef(queue)
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
  if (disposed || !allowed.value || loading.value)
    return
  clearQueue()

  const current = ++operation
  const abort = new AbortController()
  const host = getCurrentApiHost()
  const scope = progressScope()
  const saved = scope ? readOperatorCallProgress(scope, operatorCalendarDate()) : null

  request = abort
  loading.value = true
  focused.value = true
  focusWorkspace()
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
    if (host !== getCurrentApiHost())
      throw new Error('oc_error_context')
    queue.value = result
    queueHost = host
    applySavedPosition(saved)
    loading.value = false
    savePosition()

    const pendingDetails = finished.value ? Promise.resolve() : details()

    await focusWorkspace()
    await pendingDetails
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
  if (!queue.value || loading.value || !queueContextValid())
    return
  const next = index.value + delta
  if (next >= queue.value.customers.length) {
    detailRequest?.abort()
    detailOperation += 1
    detailLoading.value = false
    finished.value = true
    savePosition()
    await focusWorkspace()
    return
  }
  if (next < 0)
    return
  index.value = next
  finished.value = false
  savePosition()

  const pendingDetails = details()

  await focusWorkspace()
  await pendingDetails
}

async function resumeLast() {
  if (!queueContextValid())
    return
  finished.value = false
  savePosition()

  const pendingDetails = details()

  await focusWorkspace()
  await pendingDetails
}

watch(date, clearQueue)
watch([currentUserId, role, serverRole, email, allowed], () => {
  clearQueue()
  restoreSavedDay()
}, { flush: 'sync' })
watch(locale, () => { document.title = `${t('oc_title')} · Alpha POS` }, { immediate: true })
onMounted(restoreSavedDay)
onBeforeUnmount(() => {
  disposed = true
  clearQueue()
})
</script>

<template>
  <div class="operator-page">
    <header
      v-if="!focused"
      class="operator-header"
    >
      <div>
        <span class="operator-brand">Alpha POS</span><h1
          ref="dayHeading"
          tabindex="-1"
        >
          {{ t('oc_title') }}
        </h1>
      </div>
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
    <main
      ref="workspace"
      class="operator-main"
      tabindex="-1"
      :aria-label="t('oc_title')"
    >
      <section
        v-if="!allowed"
        class="operator-card"
        role="alert"
      >
        <h2>{{ t('oc_no_access') }}</h2><p>{{ t('oc_error_permission') }}</p>
      </section>
      <template v-else>
        <div
          v-if="focused"
          class="operator-focus-bar"
        >
          <Button
            variant="ghost"
            @click="returnToDay"
          >
            <DesignIcon
              name="chevleft"
              :size="18"
            />{{ t('oc_change_day') }}
          </Button>
          <time :datetime="date">{{ date }}</time>
        </div>
        <section
          v-else
          class="operator-card operator-day"
        >
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
        <p
          v-if="resumeNotice || progressSaveFailed"
          class="operator-help"
          role="status"
        >
          {{ progressSaveFailed ? t('oc_progress_unavailable') : resumeNotice }}
        </p>
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
          <Button @click="returnToDay">
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
          /><h2>{{ t('oc_finished') }}</h2>
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
          <article class="operator-customer">
            <h2
              ref="cardHeading"
              tabindex="-1"
            >
              {{ customer.name || t('oc_unnamed') }}
            </h2>
            <p class="operator-phone">
              {{ customer.phone }}
            </p>
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
              class="operator-card operator-order"
            >
              <div class="operator-order-meta">
                <h3>{{ typeLabel(order.order_type) }}</h3><span>#{{ order.order_number || order.id }}</span>
              </div>
              <dl class="operator-timing">
                <div>
                  <dt>{{ t('oc_received_at') }}</dt>
                  <dd><time :datetime="order.created_at">{{ time(order.created_at) }}</time></dd>
                </div>
                <div>
                  <dt>{{ t('oc_preparation_time') }}</dt>
                  <dd>{{ preparationLabel(order) }}</dd>
                </div>
              </dl>
              <p
                v-if="order.place_label"
                class="operator-place"
              >
                {{ order.place_label }}
              </p>
              <dl
                v-if="(order.order_type === 'DELIVERY' && order.delivery_address) || visibleOrderComment(order)"
                class="operator-context"
              >
                <div v-if="order.order_type === 'DELIVERY' && order.delivery_address">
                  <dt>{{ t('oc_delivery_address') }}</dt>
                  <dd>{{ order.delivery_address }}</dd>
                </div>
                <div v-if="visibleOrderComment(order)">
                  <dt>{{ t('oc_order_comment') }}</dt>
                  <dd>{{ visibleOrderComment(order) }}</dd>
                </div>
              </dl>
              <ul
                v-if="order.items?.length"
                class="operator-items"
              >
                <li
                  v-for="(item, itemIndex) in order.items"
                  :key="itemIndex"
                >
                  <div class="operator-item-line">
                    <span>{{ item.name }}</span><strong>× {{ item.quantity }}</strong>
                  </div>
                  <p
                    v-if="item.comment"
                    class="operator-item-comment"
                  >
                    <span>{{ t('oc_item_comment') }}:</span> {{ item.comment }}
                  </p>
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
          <nav
            class="operator-bottom"
            :aria-label="t('oc_client_navigation')"
          >
            <a
              class="operator-call"
              :href="`tel:${customer.phone}`"
            ><DesignIcon
              name="phone"
              :size="22"
            />{{ t('oc_call') }}</a>
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
.operator-main { width: min(100%, 672px); padding: 20px 16px calc(188px + env(safe-area-inset-bottom)); margin: auto; display: flex; flex-direction: column; gap: 16px; }
.operator-focus-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text-secondary); font-size: 13px; }
.operator-focus-bar button { min-height: 48px; white-space: normal; text-align: start; }
.operator-focus-bar time { flex-shrink: 0; font-variant-numeric: tabular-nums; }
.operator-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 22px; min-width: 0; }
.operator-day { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 14px; }
.operator-day > button { margin-top: 24px; }
.operator-day :deep(input) { font-size: 16px; min-height: 46px; }
.operator-state { text-align: center; padding: 30px 18px; color: var(--text-secondary); line-height: 1.6; }
.operator-state h2 { color: var(--text); font-size: 20px; margin: 12px 0; }
.operator-error { color: var(--danger, #c84545); line-height: 1.55; }
.operator-progress { text-align: center; font-size: 14px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.operator-customer { min-width: 0; }
.operator-customer h2 { margin: 0; color: var(--text-secondary); font-size: 16px; font-weight: 500; line-height: 1.4; overflow-wrap: anywhere; }
.operator-phone { font-variant-numeric: tabular-nums; font-size: clamp(21px, 6vw, 26px); font-weight: 650; letter-spacing: .015em; margin: 6px 0 20px; overflow-wrap: anywhere; }
.operator-call { display: flex; justify-content: center; align-items: center; gap: 10px; width: 100%; min-height: 56px; border-radius: 12px; background: var(--primary); color: var(--on-primary, white); font-size: 18px; font-weight: 650; text-decoration: none; }
.operator-help { color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin: 10px 0 0; }
.operator-order { margin-top: 14px; }
.operator-order-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 14px; color: var(--text-secondary); }
.operator-order-meta h3 { margin: 0; color: var(--text); font-size: 18px; overflow-wrap: anywhere; }
.operator-order-meta span:last-child { margin-inline-start: auto; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.operator-timing { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }
.operator-timing > div { display: flex; flex-direction: column; }
.operator-timing dt { flex: 1; color: var(--text-secondary); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
.operator-timing dd { margin: 4px 0 0; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.operator-context { display: grid; gap: 12px; margin: 16px 0; padding: 14px; background: var(--surface-inset); border-radius: 10px; line-height: 1.5; }
.operator-context dt { font-size: 12px; color: var(--text-secondary); margin-bottom: 3px; }
.operator-context dd { font-size: 15px; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.operator-items { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 9px; }
.operator-items li { line-height: 1.45; font-size: 15px; }
.operator-item-line { display: flex; justify-content: space-between; gap: 16px; }
.operator-item-comment { margin: 5px 0 3px; padding-inline-start: 10px; border-inline-start: 2px solid var(--border); color: var(--text-secondary); white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; }
.operator-items span { overflow-wrap: anywhere; }
.operator-items strong { flex-shrink: 0; font-variant-numeric: tabular-nums; }
.operator-place { font-size: 14px; margin: 10px 0; }
.operator-bottom { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: min(100%, 672px); padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px; background: var(--surface); border-top: 1px solid var(--border); z-index: 20; }
.operator-bottom button { min-height: 54px; font-size: 16px; white-space: normal; }
.operator-bottom .operator-call { grid-column: 1 / -1; }
.operator-call:focus-visible, .operator-icon:focus-visible, .operator-customer h2:focus-visible, .operator-header h1:focus-visible, .operator-main:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px; }
@media (max-width: 480px) { .operator-header { align-items: flex-start; padding: 14px 16px; flex-wrap: wrap; } .operator-header h1 { font-size: 18px; } .operator-tools { margin-left: auto; } .operator-card { padding: 18px; } .operator-day { grid-template-columns: minmax(0, 1fr); } .operator-day > button { margin-top: 0; min-height: 48px; } }
</style>

<route lang="yaml">
name: operator-calls
meta:
  layout: blank
  action: read
  subject: Auth
</route>
