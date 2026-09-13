/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { parse } = require('@vue/compiler-sfc')
const vue = require('vue')
const ts = require('typescript')

// Real page state/watchers, synthetic responses, no DOM, storage or network.
const filename = path.resolve(__dirname, '../../src/pages/operator/calls.vue')
const source = fs.readFileSync(filename, 'utf8')
const { descriptor, errors } = parse(source, { filename })

assert.deepEqual(errors, [])

const exposed = ['loadDay', 'details', 'clearQueue', 'move', 'resumeLast', 'queue', 'date', 'loading', 'detailLoading', 'error', 'detailError', 'progress', 'index', 'finished', 'cardHeading']

const compiled = ts.transpileModule(`${descriptor.scriptSetup.content}\nexport { ${exposed.join(', ')} }`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText

function deferred() {
  let finish
  let fail
  const promise = new Promise((resolve, reject) => { finish = resolve; fail = reject })

  return { promise, resolve: finish, reject: fail }
}

function queue(date = '2026-08-08', preview = false) {
  return {
    date,
    admin_preview: preview,
    total_customers: 2,
    customers: [1, 2].map(id => ({
      key: `synthetic-${id}`,
      phone: `+99890000000${id}`,
      name: `Synthetic customer ${id}`,
      orders: [{ id, created_at: `${date}T12:00:00+05:00`, items: preview ? null : [{ name: 'Synthetic product', quantity: 1 }] }],
    })),
  }
}

function setup() {
  const role = vue.ref('OPERATOR')
  const currentUserId = vue.ref(1)
  const permission = vue.ref(true)
  const queues = []
  const items = []
  const unmount = []
  const scope = vue.effectScope()

  const dependencies = {
    'vuetify': { useTheme: () => ({}) },
    '@/composables/useAlphaTheme': { useAlphaTheme: () => ({ theme: vue.ref('light'), toggleTheme: () => undefined }) },
    '@/composables/useUserAccess': { useUserAccess: () => ({ role, currentUserId, isAdministrator: vue.computed(() => role.value === 'ADMIN'), isOperator: vue.computed(() => ['USER', 'OPERATOR'].includes(role.value.trim().toUpperCase())), hasPermission: () => permission.value }) },
    '@/composables/useSessionLogout': { useSessionLogout: () => ({ logout: () => undefined }) },
    '@/services/operatorCalls': {
      operatorCalendarDate: () => '2026-08-08',
      loadOperatorQueue: (date, options) => {
        const pending = deferred()

        queues.push({ date, options, ...pending })
        return pending.promise
      },
      loadAdminOrderItems: (order, signal) => {
        const pending = deferred()

        items.push({ order, signal, ...pending })
        return pending.promise
      },
    },
  }

  const context = vm.createContext({
    ...vue,
    exports: {},
    AbortController,
    document: { title: '' },
    useI18n: () => ({ t: key => key, locale: vue.ref('en') }),
    onBeforeUnmount: callback => unmount.push(callback),
    require: request => {
      if (request.startsWith('@/components/design/') || request === '@/layouts/components/NavBarI18n.vue')
        return {}
      assert.ok(Object.hasOwn(dependencies, request), `Unexpected dependency: ${request}`)
      return dependencies[request]
    },
  })

  scope.run(() => vm.runInContext(compiled, context, { filename }))
  return {
    ...context.exports,
    queues,
    items,
    role,
    currentUserId,
    permission,
    dispose: () => { unmount.forEach(callback => callback()); scope.stop() },
  }
}

test('operator page starts without automatic requests or administrative layout mounting', () => {
  const page = setup()

  assert.equal(page.queues.length, 0)
  assert.equal(page.items.length, 0)
  assert.equal(page.queue.value, null)
  assert.match(source, /layout: blank/)
  assert.doesNotMatch(descriptor.template.content, /<(?:DesignSidebar|DesignTopbar|MobileTabBar|CommandPalette)/)
  page.dispose()
})

test('USER sees the full calling page with items and navigation, without the removed administrator banner', async () => {
  const page = setup()

  page.role.value = 'user'
  assert.doesNotMatch(descriptor.template.content, /oc_admin_preview|operator-notice/)

  const loading = page.loadDay()

  assert.equal(page.queues.length, 1)
  page.queues[0].resolve(queue())
  await loading
  assert.equal(page.queue.value.total_customers, 2)
  assert.equal(page.queue.value.customers[0].orders[0].items[0].name, 'Synthetic product')
  await page.move(1)
  assert.equal(page.index.value, 1)
  assert.equal(page.items.length, 0)
  page.dispose()
})

test('duplicate loads are guarded and cancellation discards late progress and results', async () => {
  const page = setup()
  const first = page.loadDay()

  await page.loadDay()
  assert.equal(page.queues.length, 1)
  page.clearQueue()
  assert.equal(page.queues[0].options.signal.aborted, true)
  page.queues[0].options.onProgress({ loaded: 99 })
  page.queues[0].resolve(queue())
  await first
  assert.equal(page.loading.value, false)
  assert.equal(page.progress.value, null)
  assert.equal(page.queue.value, null)
  assert.equal(page.error.value, '')
  page.dispose()
})

test('changing the selected day invalidates an older response without clearing the newer day', async () => {
  const page = setup()
  const oldLoad = page.loadDay()

  page.date.value = '2026-08-09'
  await vue.nextTick()
  assert.equal(page.queues[0].options.signal.aborted, true)

  const newLoad = page.loadDay()

  page.queues[1].resolve(queue('2026-08-09'))
  await newLoad
  page.queues[0].options.onProgress({ loaded: 999 })
  page.queues[0].reject(new Error('oc_error_network'))
  await oldLoad
  assert.equal(page.queue.value.date, '2026-08-09')
  assert.equal(page.error.value, '')
  assert.equal(page.loading.value, false)
  assert.equal(page.progress.value, null)
  page.dispose()
})

test('account changes, permission loss and unmount cancel pending responses and clear customer data', async () => {
  for (const change of ['account', 'permission', 'unmount']) {
    const page = setup()
    const pending = page.loadDay()

    if (change === 'account')
      page.currentUserId.value = 2
    else if (change === 'permission')
      page.permission.value = false
    else
      page.dispose()
    assert.equal(page.queues[0].options.signal.aborted, true)
    page.queues[0].resolve(queue())
    await pending
    assert.equal(page.queue.value, null)
    if (change !== 'unmount')
      page.dispose()
  }
})

test('previous, next, finish and resume only navigate locally without logging calls or fetching operator details', async () => {
  const page = setup()
  const load = page.loadDay()
  let focused = 0

  page.cardHeading.value = { focus: () => { focused += 1 } }
  page.queues[0].resolve(queue())
  await load
  await page.move(-1)
  assert.equal(page.index.value, 0)
  await page.move(1)
  assert.equal(page.index.value, 1)
  assert.equal(focused, 1)
  await page.move(1)
  assert.equal(page.finished.value, true)
  await page.resumeLast()
  assert.equal(page.finished.value, false)
  assert.equal(page.index.value, 1)
  await page.move(-1)
  assert.equal(page.index.value, 0)
  assert.equal(page.queues.length, 1)
  assert.equal(page.items.length, 0)
  page.dispose()
})

test('admin detail navigation cancels old item reads and never attaches stale items to another customer', async () => {
  const page = setup()

  page.role.value = 'ADMIN'
  page.queue.value = queue('2026-08-08', true)

  const firstItems = page.details()
  const move = page.move(1)

  assert.equal(page.items[0].signal.aborted, true)
  page.items[1].resolve([{ name: 'Second customer item', quantity: 2 }])
  await move
  page.items[0].resolve([{ name: 'Old item', quantity: 99 }])
  await firstItems
  assert.equal(page.queue.value.customers[0].orders[0].items, null)
  assert.equal(page.queue.value.customers[1].orders[0].items[0].name, 'Second customer item')
  assert.equal(page.detailLoading.value, false)
  assert.equal(page.detailError.value, '')
  page.dispose()
})
