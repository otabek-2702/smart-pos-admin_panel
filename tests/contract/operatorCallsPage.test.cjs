/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { parse } = require('@vue/compiler-sfc')
const vue = require('vue')
const ts = require('typescript')

// Real page state/watchers, synthetic responses and in-memory bookmarks; no DOM, browser storage or network.
const filename = path.resolve(__dirname, '../../src/pages/operator/calls.vue')
const source = fs.readFileSync(filename, 'utf8')
const { descriptor, errors } = parse(source, { filename })

assert.deepEqual(errors, [])

const exposed = ['loadDay', 'details', 'clearQueue', 'move', 'resumeLast', 'returnToDay', 'focusWorkspace', 'visibleOrderComment', 'preparationLabel', 'restoreSavedDay', 'savePosition', 'applySavedPosition', 'resumeNotice', 'progressSaveFailed', 'queue', 'customer', 'date', 'loading', 'detailLoading', 'error', 'detailError', 'progress', 'index', 'finished', 'focused', 'cardHeading', 'dayHeading', 'workspace']

const compiled = ts.transpileModule(`${descriptor.scriptSetup.content}\nexport { ${exposed.join(', ')} }`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText

function deferred() {
  let finish
  let fail
  const promise = new Promise((resolve, reject) => { finish = resolve; fail = reject })

  return { promise, resolve: finish, reject: fail }
}

async function flushPage() {
  // Drain cross-VM async continuations as well as Vue's rendering tick.
  await new Promise(resolve => setImmediate(resolve))
  await vue.nextTick()
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
      orders: [{ id, order_type: 'DELIVERY', created_at: `${date}T12:00:00+05:00`, items: preview ? null : [{ name: 'Synthetic product', quantity: 1 }] }],
    })),
  }
}

const DEFAULT_HOST = 'https://api.example.invalid'
const bookmarkKey = (userId = 1, apiHost = DEFAULT_HOST) => `${apiHost}|${userId}`
const bookmark = (overrides = {}) => ({ date: '2026-08-08', orderId: 2, finished: false, totalCustomers: 2, ...overrides })

function setup(pageOptions = {}) {
  const role = vue.ref(pageOptions.role ?? 'OPERATOR')
  const serverRole = vue.ref('ADMIN')
  const email = vue.ref('operator@example.invalid')
  const currentUserId = vue.ref(pageOptions.userId ?? 1)
  const permission = vue.ref(pageOptions.permission ?? true)
  const apiHost = vue.ref(pageOptions.apiHost ?? DEFAULT_HOST)
  const storageWritable = vue.ref(true)
  const bookmarks = pageOptions.bookmarks ?? new Map()
  const bookmarkReads = []
  const bookmarkWrites = []
  const queues = []
  const items = []
  const mounted = []
  const unmount = []
  const scope = vue.effectScope()

  const dependencies = {
    'vuetify': { useTheme: () => ({}) },
    '@/composables/useAlphaTheme': { useAlphaTheme: () => ({ theme: vue.ref('light'), toggleTheme: () => undefined }) },
    '@/composables/useUserAccess': { useUserAccess: () => ({ role, serverRole, email, currentUserId, isAdministrator: vue.computed(() => role.value === 'ADMIN'), isOperator: vue.computed(() => role.value.trim().toUpperCase() === 'OPERATOR'), hasPermission: () => permission.value }) },
    '@/composables/useSessionLogout': { useSessionLogout: () => ({ logout: () => undefined }) },
    '@/plugins/axios': { getCurrentApiHost: () => apiHost.value },
    '@/utils/operatorCallProgress': {
      readOperatorCallProgress: (progressScope, today) => {
        bookmarkReads.push({ ...progressScope, today })

        const saved = bookmarks.get(bookmarkKey(progressScope.userId, progressScope.apiHost))

        return saved ? { ...saved } : null
      },
      saveOperatorCallProgress: (progressScope, saved) => {
        const snapshot = JSON.parse(JSON.stringify({ scope: progressScope, saved }))

        bookmarkWrites.push(snapshot)
        if (!storageWritable.value)
          return false
        bookmarks.set(bookmarkKey(progressScope.userId, progressScope.apiHost), snapshot.saved)
        return true
      },
    },
    '@/services/operatorCalls': {
      operatorCalendarDate: () => '2026-08-08',
      loadOperatorQueue: (date, options) => {
        const pending = deferred()

        queues.push({ date, options, ...pending })
        return pending.promise
      },
      loadAdminOrderDetails: (order, signal) => {
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
    useI18n: () => ({ t: (key, params) => key === 'oc_preparation_minutes' ? `${params.minutes} min` : key, locale: vue.ref('en') }),
    onMounted: callback => mounted.push(callback),
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
    serverRole,
    email,
    currentUserId,
    permission,
    apiHost,
    storageWritable,
    bookmarks,
    bookmarkReads,
    bookmarkWrites,
    mount: () => Promise.all(mounted.map(callback => callback())),
    dispose: () => { unmount.forEach(callback => callback()); scope.stop() },
  }
}

test('operator page without a bookmark starts without automatic requests or administrative layout mounting', async () => {
  const page = setup()

  await page.mount()
  assert.equal(page.queues.length, 0)
  assert.equal(page.items.length, 0)
  assert.equal(page.queue.value, null)
  assert.match(source, /layout: blank/)
  assert.doesNotMatch(descriptor.template.content, /<(?:DesignSidebar|DesignTopbar|MobileTabBar|CommandPalette)/)
  page.dispose()
})

test('an operator workspace sees the full calling page with items and navigation without an administrator banner', async () => {
  const page = setup()

  page.role.value = 'OPERATOR'
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

test('account, email or backend role changes, permission loss and unmount cancel pending responses and clear customer data', async () => {
  for (const change of ['account', 'email', 'backend-role', 'permission', 'unmount']) {
    const page = setup()
    const pending = page.loadDay()

    if (change === 'account')
      page.currentUserId.value = 2
    else if (change === 'email')
      page.email.value = 'operator-other@example.invalid'
    else if (change === 'backend-role')
      page.serverRole.value = 'USER'
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
  assert.equal(focused, 2)
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

test('admin navigation cancels old detail reads and never attaches stale items, context or preparation timing to another customer', async () => {
  const page = setup()

  page.role.value = 'ADMIN'
  page.queue.value = queue('2026-08-08', true)

  const firstItems = page.details()
  const move = page.move(1)

  assert.equal(page.items[0].signal.aborted, true)
  page.items[1].resolve({ items: [{ name: 'Second customer item', quantity: 2, comment: 'No onions' }], comment: 'Second note', delivery_address: 'Second address', ready_at: '2026-08-08T12:03:01+05:00', preparation_time_seconds: 181 })
  await move
  page.items[0].resolve({ items: [{ name: 'Old item', quantity: 99, comment: 'Old item note' }], comment: 'Old note', delivery_address: 'Old address', ready_at: '2026-08-08T12:59:00+05:00', preparation_time_seconds: 3540 })
  await firstItems
  assert.equal(page.queue.value.customers[0].orders[0].items, null)
  assert.equal(page.queue.value.customers[0].orders[0].comment, undefined)
  assert.equal(page.queue.value.customers[0].orders[0].delivery_address, undefined)
  assert.equal(page.queue.value.customers[0].orders[0].ready_at, undefined)
  assert.equal(page.queue.value.customers[0].orders[0].preparation_time_seconds, undefined)
  assert.equal(page.queue.value.customers[1].orders[0].items[0].name, 'Second customer item')
  assert.equal(page.queue.value.customers[1].orders[0].items[0].comment, 'No onions')
  assert.equal(page.queue.value.customers[1].orders[0].comment, 'Second note')
  assert.equal(page.queue.value.customers[1].orders[0].delivery_address, 'Second address')
  assert.equal(page.queue.value.customers[1].orders[0].ready_at, '2026-08-08T12:03:01+05:00')
  assert.equal(page.queue.value.customers[1].orders[0].preparation_time_seconds, 181)
  assert.equal(page.preparationLabel(page.customer.value.orders[0]), '4 min')
  assert.equal(page.detailLoading.value, false)
  assert.equal(page.detailError.value, '')
  page.dispose()
})

test('show clients focuses the workspace immediately and displays the customer before lazy details finish', async () => {
  const page = setup()
  const focusEvents = []

  page.workspace.value = { focus: () => focusEvents.push('workspace'), scrollIntoView: () => focusEvents.push('scroll') }
  page.cardHeading.value = { focus: () => focusEvents.push('customer') }

  const pending = page.loadDay()

  assert.equal(page.focused.value, true)
  assert.equal(page.loading.value, true)
  await flushPage()
  assert.deepEqual(focusEvents, ['workspace', 'scroll'])
  page.queues[0].resolve(queue('2026-08-08', true))
  await flushPage()
  assert.equal(page.loading.value, false)
  assert.equal(page.detailLoading.value, true)
  assert.equal(page.customer.value.name, 'Synthetic customer 1')
  assert.equal(page.items.length, 1)
  assert.deepEqual(focusEvents, ['workspace', 'scroll', 'customer', 'scroll'])
  page.items[0].resolve({ items: [{ name: 'Synthetic product', quantity: 1, comment: 'No onions' }], comment: 'Ring once', delivery_address: 'Synthetic street, 10', ready_at: '2026-08-08T12:01:00+05:00', preparation_time_seconds: 60 })
  await pending
  assert.equal(page.customer.value.orders[0].comment, 'Ring once')
  assert.equal(page.customer.value.orders[0].delivery_address, 'Synthetic street, 10')
  assert.equal(page.customer.value.orders[0].ready_at, '2026-08-08T12:01:00+05:00')
  assert.equal(page.customer.value.orders[0].preparation_time_seconds, 60)
  assert.equal(page.preparationLabel(page.customer.value.orders[0]), '1 min')
  assert.equal(page.detailLoading.value, false)
  page.dispose()
})

test('return to day exits focus mode, cancels loading and restores keyboard focus without late data', async () => {
  const page = setup()
  const focusEvents = []

  page.dayHeading.value = { focus: () => focusEvents.push('day'), scrollIntoView: () => focusEvents.push('scroll') }

  const pending = page.loadDay()

  await page.returnToDay()
  assert.equal(page.focused.value, false)
  assert.equal(page.loading.value, false)
  assert.equal(page.queues[0].options.signal.aborted, true)
  assert.deepEqual(focusEvents, ['day', 'scroll'])
  page.queues[0].resolve(queue())
  await pending
  assert.equal(page.queue.value, null)
  assert.equal(page.error.value, '')
  page.dispose()
})

test('return to day and selected-day changes cancel pending context and discard all late note and timing fields', async () => {
  for (const change of ['return', 'date']) {
    const page = setup()
    const pending = page.loadDay()
    const response = queue('2026-08-08', true)

    page.queues[0].resolve(response)
    await flushPage()
    assert.equal(page.items.length, 1)
    if (change === 'return') { await page.returnToDay() }
    else {
      page.date.value = '2026-08-09'
      await vue.nextTick()
    }
    assert.equal(page.items[0].signal.aborted, true)
    assert.equal(page.focused.value, false)
    page.items[0].resolve({ items: [{ name: 'Old product', quantity: 1, comment: 'Old item note' }], comment: 'Old note', delivery_address: 'Old address', ready_at: '2026-08-08T12:05:00+05:00', preparation_time_seconds: 300 })
    await pending
    assert.equal(page.queue.value, null)
    assert.equal(response.customers[0].orders[0].items, null)
    assert.equal(response.customers[0].orders[0].comment, undefined)
    assert.equal(response.customers[0].orders[0].delivery_address, undefined)
    assert.equal(response.customers[0].orders[0].ready_at, undefined)
    assert.equal(response.customers[0].orders[0].preparation_time_seconds, undefined)
    assert.equal(page.detailError.value, '')
    page.dispose()
  }
})

test('stale focus callbacks never steal focus after returning to day or loading a replacement queue', async () => {
  const page = setup()
  const events = []

  page.workspace.value = { focus: () => events.push('workspace'), scrollIntoView: () => undefined }
  page.dayHeading.value = { focus: () => events.push('day'), scrollIntoView: () => undefined }
  page.focused.value = true

  const oldFocus = page.focusWorkspace()

  await page.returnToDay()
  await oldFocus
  assert.deepEqual(events, ['day'])
  events.length = 0

  const oldReturn = page.returnToDay()
  const newLoad = page.loadDay()

  await oldReturn
  assert.equal(page.focused.value, true)
  assert.deepEqual(events, ['workspace'])
  page.queues[0].resolve(queue())
  await newLoad
  page.dispose()
})

test('mount restores the saved day and resolves its order anchor against a newly reordered queue', async () => {
  const bookmarks = new Map([[bookmarkKey(), bookmark({ date: '2026-08-07', orderId: 1 })]])
  const page = setup({ bookmarks })
  const pending = page.mount()

  await flushPage()
  assert.equal(page.date.value, '2026-08-07')
  assert.equal(page.queues.length, 1)
  assert.equal(page.queues[0].date, '2026-08-07')
  assert.equal(page.loading.value, true)

  const result = queue('2026-08-07')

  result.customers.reverse()
  page.queues[0].resolve(result)
  await pending
  assert.equal(page.index.value, 1)
  assert.equal(page.customer.value.orders[0].id, 1)
  assert.equal(page.finished.value, false)
  assert.equal(page.focused.value, true)
  assert.equal(page.bookmarkWrites.length, 1)
  assert.equal(page.bookmarkWrites[0].saved.orderId, 1)
  page.dispose()
})

test('loading, moving, finishing and reopening the last customer save only a scoped navigation bookmark', async () => {
  const page = setup()
  const pending = page.loadDay()

  page.queues[0].resolve(queue())
  await pending
  await page.move(1)
  await page.move(1)
  await page.resumeLast()
  await page.move(-1)
  assert.deepEqual(page.bookmarkWrites.map(write => [write.saved.orderId, write.saved.finished]), [[1, false], [2, false], [2, true], [2, false], [1, false]])
  for (const write of page.bookmarkWrites) {
    assert.deepEqual(write.scope, { userId: 1, apiHost: DEFAULT_HOST })
    assert.deepEqual(Object.keys(write.saved).sort(), ['date', 'finished', 'orderId', 'totalCustomers'])
    assert.equal(write.saved.date, '2026-08-08')
    assert.equal(write.saved.totalCustomers, 2)
    assert.doesNotMatch(JSON.stringify(write), /Synthetic customer|Synthetic product|\+998|phone|email|comment|address|token|password/)
  }
  page.dispose()
})

test('fresh-login remount for the same user resumes the bookmark only after a fresh queue response', async () => {
  const bookmarks = new Map()
  const first = setup({ bookmarks })
  const firstLoad = first.loadDay()

  first.queues[0].resolve(queue())
  await firstLoad
  await first.move(1)
  first.dispose()

  const fresh = setup({ bookmarks })
  const remount = fresh.mount()

  await flushPage()
  assert.equal(fresh.queue.value, null)
  assert.equal(fresh.customer.value, null)
  assert.equal(fresh.queues.length, 1)
  fresh.queues[0].resolve(queue())
  await remount
  assert.equal(fresh.customer.value.orders[0].id, 2)
  assert.equal(fresh.index.value, 1)
  fresh.dispose()
})

test('account changes clear current data and restore only the new account bookmark without overwriting the old one', async () => {
  const bookmarks = new Map([[bookmarkKey(2), bookmark({ date: '2026-08-07', orderId: 1 })]])
  const page = setup({ bookmarks })
  const pending = page.loadDay()

  page.queues[0].resolve(queue())
  await pending
  await page.move(1)

  const previousBookmark = { ...bookmarks.get(bookmarkKey()) }

  page.currentUserId.value = 2
  assert.equal(page.queue.value, null)
  assert.equal(page.customer.value, null)
  await flushPage()
  assert.equal(page.queues.length, 2)
  assert.equal(page.queues[1].date, '2026-08-07')
  page.queues[1].resolve(queue('2026-08-07'))
  await flushPage()
  assert.equal(page.customer.value.orders[0].id, 1)
  assert.equal(page.bookmarkWrites.at(-1).scope.userId, 2)
  assert.equal(page.bookmarkWrites.at(-1).saved.date, '2026-08-07')
  assert.deepEqual(bookmarks.get(bookmarkKey()), previousBookmark)
  page.dispose()
})

test('failed, canceled and empty queue loads do not overwrite an existing bookmark', async () => {
  for (const scenario of ['failure', 'cancel', 'empty']) {
    const saved = bookmark({ date: '2026-08-07' })
    const page = setup({ bookmarks: new Map([[bookmarkKey(), saved]]) })
    const pending = page.loadDay()

    if (scenario === 'failure') { page.queues[0].reject(new Error('oc_error_network')) }
    else if (scenario === 'cancel') {
      page.clearQueue()
      page.queues[0].resolve(queue())
    }
    else { page.queues[0].resolve({ ...queue(), total_customers: 0, customers: [] }) }
    await pending
    assert.equal(page.bookmarkWrites.length, 0, scenario)
    assert.deepEqual(page.bookmarks.get(bookmarkKey()), saved, scenario)
    page.dispose()
  }
})

test('an unavailable saved anchor starts at the first customer with a notice and no false completion', async () => {
  const page = setup({ bookmarks: new Map([[bookmarkKey(), bookmark({ orderId: 999, finished: true })]]) })
  const pending = page.mount()

  await flushPage()
  page.queues[0].resolve(queue())
  await pending
  assert.equal(page.index.value, 0)
  assert.equal(page.customer.value.orders[0].id, 1)
  assert.equal(page.finished.value, false)
  assert.equal(page.resumeNotice.value, 'oc_resume_missing')
  assert.equal(page.bookmarkWrites.at(-1).saved.orderId, 1)
  page.dispose()
})

test('saved completion is restored only when its anchor remains last and the queue count is unchanged', async () => {
  for (const scenario of ['same', 'reordered', 'grown', 'shrunk']) {
    const page = setup({ bookmarks: new Map([[bookmarkKey(), bookmark({ finished: true })]]) })
    const pending = page.mount()

    await flushPage()

    const result = queue()

    if (scenario === 'reordered') { result.customers.reverse() }
    else if (scenario === 'grown') {
      result.customers.unshift({ key: 'synthetic-3', phone: '+998900000003', name: 'Synthetic customer 3', orders: [{ id: 3, order_type: 'PICKUP', created_at: '2026-08-08T11:00:00+05:00', items: [] }] })
      result.total_customers = 3
    }
    else if (scenario === 'shrunk') {
      result.customers.shift()
      result.total_customers = 1
    }
    page.queues[0].resolve(result)
    await pending
    assert.equal(page.customer.value.orders[0].id, 2, scenario)
    assert.equal(page.finished.value, scenario === 'same', scenario)
    assert.equal(page.bookmarkWrites.at(-1).saved.finished, scenario === 'same', scenario)
    page.dispose()
  }
})

test('matching any order in the saved customer restores it, while a different day never reuses the anchor', () => {
  const page = setup()
  const result = queue()

  result.customers[1].orders.push({ id: 22, order_type: 'PICKUP', created_at: '2026-08-08T14:00:00+05:00', items: [] })
  page.queue.value = result
  page.applySavedPosition(bookmark({ date: '2026-08-07' }))
  assert.equal(page.index.value, 0)
  page.applySavedPosition(bookmark({ orderId: 22 }))
  assert.equal(page.index.value, 1)
  page.dispose()
})

test('blocked bookmark storage warns without blocking calls or navigation, then clears after a successful save', async () => {
  const page = setup()

  page.storageWritable.value = false

  const pending = page.loadDay()

  page.queues[0].resolve(queue())
  await pending
  assert.equal(page.progressSaveFailed.value, true)
  assert.equal(page.customer.value.orders[0].id, 1)
  assert.equal(page.error.value, '')
  await page.move(1)
  assert.equal(page.customer.value.orders[0].id, 2)
  assert.equal(page.progressSaveFailed.value, true)
  page.storageWritable.value = true
  page.savePosition()
  assert.equal(page.progressSaveFailed.value, false)
  assert.equal(page.bookmarks.get(bookmarkKey()).orderId, 2)
  assert.match(descriptor.template.content, /progressSaveFailed \? t\('oc_progress_unavailable'\)/)
  page.dispose()
})

test('plain administrators and accounts without operator permission neither restore nor write bookmarks', async () => {
  const page = setup({ role: 'ADMIN', bookmarks: new Map([[bookmarkKey(), bookmark()]]) })

  await page.mount()
  assert.equal(page.queues.length, 0)
  assert.equal(page.bookmarkReads.length, 0)

  const pending = page.loadDay()

  page.queues[0].resolve(queue())
  await pending
  await page.move(1)
  assert.equal(page.bookmarkWrites.length, 0)
  assert.equal(page.bookmarkReads.length, 0)
  page.dispose()

  const blocked = setup({ permission: false, bookmarks: new Map([[bookmarkKey(), bookmark()]]) })

  await blocked.mount()
  await blocked.restoreSavedDay()
  await blocked.loadDay()
  blocked.savePosition()
  assert.equal(blocked.queues.length, 0)
  assert.equal(blocked.bookmarkReads.length, 0)
  assert.equal(blocked.bookmarkWrites.length, 0)
  blocked.dispose()
})

test('an API-host change prevents foreign bookmark writes and clears the queue on navigation', async () => {
  const page = setup()
  const pending = page.loadDay()

  page.queues[0].resolve(queue())
  await pending

  const saved = { ...page.bookmarks.get(bookmarkKey()) }

  page.apiHost.value = 'https://other-api.example.invalid'
  page.savePosition()
  assert.equal(page.bookmarkWrites.length, 1)
  await page.move(1)
  assert.equal(page.queue.value, null)
  assert.equal(page.customer.value, null)
  assert.equal(page.error.value, 'oc_error_context')
  assert.deepEqual(page.bookmarks.get(bookmarkKey()), saved)
  assert.equal(page.bookmarks.has(bookmarkKey(1, page.apiHost.value)), false)
  page.dispose()
})

test('an in-flight queue for the old API host is discarded without moving either host bookmark', async () => {
  const saved = bookmark()
  const page = setup({ bookmarks: new Map([[bookmarkKey(), saved]]) })
  const pending = page.loadDay()

  page.apiHost.value = 'https://other-api.example.invalid'
  page.queues[0].resolve(queue())
  await pending
  assert.equal(page.queue.value, null)
  assert.equal(page.error.value, 'oc_error_context')
  assert.equal(page.bookmarkWrites.length, 0)
  assert.deepEqual(page.bookmarks.get(bookmarkKey()), saved)
  page.dispose()
})

test('a saved-day restore cannot dispatch after its page unmounts before the next render tick', async () => {
  const page = setup({ bookmarks: new Map([[bookmarkKey(), bookmark()]]) })
  const pending = page.mount()

  page.dispose()
  await flushPage()
  assert.equal(page.queues.length, 0)
  await pending
  assert.equal(page.bookmarkWrites.length, 0)
})

test('delivery comments suppress only an address duplicate after whitespace and case normalization', () => {
  const page = setup()
  const order = { order_type: 'DELIVERY', delivery_address: '  Synthetic Street, 10  ' }

  for (const comment of ['Synthetic Street, 10', ' SYNTHETIC\nSTREET,\t10 ', 'synthetic   street, 10'])
    assert.equal(page.visibleOrderComment({ ...order, comment }), null)

  assert.equal(page.visibleOrderComment({ ...order, comment: ' Ring once. ' }), 'Ring once.')
  assert.equal(page.visibleOrderComment({ ...order, comment: 'Synthetic Street, 10. Ring once.' }), 'Synthetic Street, 10. Ring once.')
  assert.equal(page.visibleOrderComment({ ...order, comment: 'Synthetic Street, 10A' }), 'Synthetic Street, 10A')
  assert.equal(page.visibleOrderComment({ ...order, comment: 'Synthetic Street 10' }), 'Synthetic Street 10')
  assert.equal(page.visibleOrderComment({ ...order, comment: 'First line.\nSecond line.' }), 'First line.\nSecond line.')
  page.dispose()
})

test('missing comments stay absent and matching non-delivery or addressless comments remain visible', () => {
  const page = setup()

  for (const comment of [undefined, null, '', ' \n\t '])
    assert.equal(page.visibleOrderComment({ order_type: 'DELIVERY', comment }), null)

  for (const order_type of ['HALL', 'PICKUP', 'OTHER'])
    assert.equal(page.visibleOrderComment({ order_type, comment: ' Same text ', delivery_address: 'same text' }), 'Same text')

  for (const delivery_address of [undefined, null, ''])
    assert.equal(page.visibleOrderComment({ order_type: 'DELIVERY', comment: ' Keep this note ', delivery_address }), 'Keep this note')
  page.dispose()
})

test('preparation time uses validated seconds, retains zero and rounds partial minutes upward', () => {
  const page = setup()

  for (const [seconds, minutes] of [[0, 0], [0.5, 1], [1, 1], [59, 1], [60, 1], [60.1, 2], [61, 2], [120, 2], [3599, 60]]) {
    const order = { preparation_time_seconds: seconds, items: [] }

    assert.equal(page.preparationLabel(order), `${minutes} min`)
  }
  page.detailLoading.value = true
  assert.equal(page.preparationLabel({ preparation_time_seconds: 0, items: null }), '0 min')
  assert.equal(page.preparationLabel({ preparation_time_seconds: 61, items: null }), '2 min')
  page.dispose()
})

test('missing or invalid preparation times are not replaced with elapsed time or inferred from dates', () => {
  const page = setup()

  for (const seconds of [undefined, null, NaN, Infinity, -Infinity, -1, '60', '', false, {}]) {
    const order = {
      preparation_time_seconds: seconds,
      created_at: '2020-01-01T12:00:00+05:00',
      ready_at: '2020-01-01T12:05:00+05:00',
      items: [],
    }

    assert.equal(page.preparationLabel(order), 'oc_preparation_unknown')
  }
  assert.doesNotMatch(page.preparationLabel.toString(), /Date\.now|new Date|setInterval/)
  page.dispose()
})

test('preparation placeholder is limited to lazy item details currently loading', () => {
  const page = setup()

  assert.equal(page.preparationLabel({ items: null }), 'oc_preparation_unknown')
  page.detailLoading.value = true
  assert.equal(page.preparationLabel({ items: null }), '…')
  assert.equal(page.preparationLabel({ items: null, preparation_time_seconds: NaN }), '…')
  for (const items of [undefined, [], [{ name: 'Synthetic product', quantity: 1 }]])
    assert.equal(page.preparationLabel({ items }), 'oc_preparation_unknown')
  page.detailLoading.value = false
  page.detailError.value = 'oc_error_network'
  assert.equal(page.preparationLabel({ items: null }), 'oc_preparation_unknown')
  page.dispose()
})

test('order brief keeps the customer header unframed, gives each order its own card and places the only call link in the bottom dock', () => {
  const elements = []
  const classes = node => node.props?.find(prop => prop.type === 6 && prop.name === 'class')?.value?.content.split(/\s+/) ?? []
  const hasClass = (node, name) => classes(node).includes(name)

  const collect = (node, ancestors = []) => {
    if (node.type === 1)
      elements.push({ node, ancestors })
    for (const child of node.children ?? [])
      collect(child, [...ancestors, node])
  }

  collect(descriptor.template.ast)

  const customer = elements.find(({ node }) => hasClass(node, 'operator-customer'))
  const heading = elements.find(({ node }) => node.tag === 'h2' && node.props.some(prop => prop.type === 6 && prop.name === 'ref' && prop.value?.content === 'cardHeading'))
  const orders = elements.filter(({ node }) => hasClass(node, 'operator-order'))
  const dock = elements.find(({ node }) => hasClass(node, 'operator-bottom'))
  const callLinks = elements.filter(({ node }) => node.tag === 'a' && node.props.some(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'href' && prop.exp?.content.includes('tel:')))

  assert.ok(customer)
  assert.ok(heading)
  assert.equal(hasClass(customer.node, 'operator-card'), false)
  assert.ok(heading.ancestors.includes(customer.node))
  assert.equal(heading.ancestors.some(node => hasClass(node, 'operator-card')), false)
  assert.equal(orders.length, 1, 'One repeated order card template serves all customer orders')
  assert.equal(hasClass(orders[0].node, 'operator-card'), true)
  assert.ok(orders[0].node.props.some(prop => prop.type === 7 && prop.name === 'for' && prop.exp?.content === 'order in customer.orders'))
  assert.ok(dock)
  assert.equal(callLinks.length, 1)
  assert.ok(callLinks[0].ancestors.includes(dock.node))
  assert.ok(customer.node.loc.end.offset < dock.node.loc.start.offset, 'Customer and order content precede the action dock')
  assert.ok(orders[0].node.loc.end.offset < callLinks[0].node.loc.start.offset)
})

test('order brief reserves safe-area space for both rows of the fixed bottom action dock', () => {
  const styles = descriptor.styles.map(style => style.content).join('\n')

  const rule = selector => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = styles.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]+)\\}`))

    assert.ok(match, `Missing CSS rule: ${selector}`)
    return match[1]
  }

  const main = rule('.operator-main')
  const dock = rule('.operator-bottom')
  const call = rule('.operator-call')
  const navigationButtons = rule('.operator-bottom button')
  const mainBottom = main.match(/padding(?:-bottom)?:[^;]*calc\(([\d.]+)px\s*\+\s*env\(safe-area-inset-bottom\)\)/)
  const dockPadding = dock.match(/padding:\s*([\d.]+)px\s+[\d.]+px\s+calc\(([\d.]+)px\s*\+\s*env\(safe-area-inset-bottom\)\)/)
  const callHeight = call.match(/min-height:\s*([\d.]+)px/)
  const navigationHeight = navigationButtons.match(/min-height:\s*([\d.]+)px/)
  const rowGap = dock.match(/gap:\s*([\d.]+)px/)
  const border = dock.match(/border-top:\s*([\d.]+)px/)

  assert.match(dock, /position:\s*fixed/)
  assert.match(dock, /grid-template-columns:\s*[\d.]+fr\s+[\d.]+fr/)
  assert.match(rule('.operator-bottom .operator-call'), /grid-column:\s*1\s*\/\s*-1/)
  assert.ok(mainBottom && dockPadding && callHeight && navigationHeight && rowGap && border)

  const minimumDockHeight = Number(callHeight[1]) + Number(navigationHeight[1]) + Number(rowGap[1]) + Number(dockPadding[1]) + Number(dockPadding[2]) + Number(border[1])

  assert.ok(Number(mainBottom[1]) > minimumDockHeight, 'Content bottom padding must clear the two control rows, gap, dock padding and border; both include the same safe area')
})

test('operator template removes requested helper text and renders order context as conditional plain text', () => {
  const template = descriptor.template.content

  assert.doesNotMatch(template, /oc_dialer_hint|oc_questions|oc_taste_question|oc_recommend_question|oc_answers_pending|oc_navigation_only|oc_orders/)
  assert.match(template, /<h3>\{\{ typeLabel\(order\.order_type\) \}\}<\/h3>/)
  assert.match(template, /order\.order_type === 'DELIVERY' && order\.delivery_address/)
  assert.match(template, /<dd>\{\{ order\.delivery_address \}\}<\/dd>/)
  assert.match(template, /v-if="visibleOrderComment\(order\)"/)
  assert.match(template, /<dd>\{\{ visibleOrderComment\(order\) \}\}<\/dd>/)
  assert.match(template, /t\('oc_received_at'\)/)
  assert.match(template, /<time :datetime="order\.created_at">\{\{ time\(order\.created_at\) \}\}<\/time>/)
  assert.match(template, /t\('oc_preparation_time'\)/)
  assert.match(template, /<dd>\{\{ preparationLabel\(order\) \}\}<\/dd>/)
  assert.match(template, /v-if="item\.comment"/)
  assert.match(template, /\{\{ item\.comment \}\}/)
  assert.doesNotMatch(template, /v-html|innerHTML/)
  assert.match(template, /<header\s+v-if="!focused"/)
  assert.match(template, /v-if="focused"\s+class="operator-focus-bar"/)
  assert.match(template, /<section\s+v-else\s+class="operator-card operator-day"/)
  assert.match(template, /@click="returnToDay"/)
  assert.match(source, /white-space: pre-wrap; overflow-wrap: anywhere/)
})
