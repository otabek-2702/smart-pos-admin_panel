/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

// Synthetic fixtures, real service/parser/analysis, mocked transport only.
const root = path.resolve(__dirname, '../..')
const DATE = '2026-08-08'
const FROM = '2026-08-07T19:00:00.000Z'
const TO = '2026-08-08T19:00:00.000Z'
const NOW = Date.parse('2026-09-10T12:00:00Z')
const PHONE = '+998900000001'
const json = value => JSON.parse(JSON.stringify(value))

const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText

class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])) }
  static now() { return NOW }
}

const engineContext = vm.createContext({ exports: {}, Date: FixedDate })

vm.runInContext(compile('src/utils/customerRetention.ts'), engineContext)

const compiled = compile('src/services/operatorCalls.ts')

const fixtureOrder = (overrides = {}) => ({
  id: 1,
  order_number: 'TEST-1',
  created_at: '2026-08-08T12:00:00+05:00',
  order_type: 'HALL',
  place_label: 'Synthetic table',
  items: [{ name: 'Synthetic product', quantity: 2 }],
  ...overrides,
})

function body() {
  return {
    success: true,
    data: {
      date: DATE,
      time_zone: 'Asia/Tashkent',
      from_at: FROM,
      to_at: TO,
      snapshot_id: 'synthetic-snapshot',
      total_customers: 1,
      customers: [{ key: 'synthetic-customer', phone: PHONE, name: 'Synthetic customer', orders: [fixtureOrder()] }],
    },
  }
}

function retentionOrder(id = 1, overrides = {}) {
  return {
    ...fixtureOrder({ id }),
    customer_id: null,
    customer_name: 'Synthetic customer',
    customer_phone: null,
    customer_is_staff: false,
    phone_number: PHONE,
    updated_at: null,
    order_origin: 'POS',
    status: 'COMPLETED',
    is_paid: true,
    total_amount: '100000.50',
    ...overrides,
  }
}

function setup({ role = 'OPERATOR', email = '', get, collect, previewOrders = [retentionOrder()], now = NOW } = {}) {
  let access = { userId: 1, role, email, allowed: true }
  let host = 'https://operator-fixture.invalid'
  let currentNow = now
  const calls = []
  const previews = []

  class RequestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [currentNow])) }
    static now() { return currentNow }
  }

  const dependencies = {
    '@/utils/customerRetention': engineContext.exports,
    '@/composables/useUserAccess': {
      readUserAccess: () => {
        const serverRole = String(access.role).trim().toUpperCase()
        const normalizedEmail = String(access.email).trim().toLowerCase()
        const hasOperatorEmail = normalizedEmail.startsWith('operator')
        const effectiveRole = hasOperatorEmail ? 'OPERATOR' : serverRole

        return {
          ...access,
          role: effectiveRole,
          serverRole,
          email: normalizedEmail,
          hasOperatorEmail,
          isAdministrator: effectiveRole === 'ADMIN',
          isOperator: effectiveRole === 'OPERATOR',
          canReadOperatorOrders: serverRole === 'ADMIN',
          has: permission => access.allowed && permission === 'operator.call_queue.view',
        }
      },
    },
    '@/plugins/axios': {
      getCurrentApiHost: () => host,
      default: {
        get: async (url, config) => {
          calls.push({ url, config })
          return get ? get(url, config) : { data: body() }
        },
      },
    },
    '@/services/customerRetentionSnapshot': {
      collectRetentionSnapshot: async options => {
        previews.push(options)
        if (collect)
          await collect(options)
        return { orders: previewOrders, record_count: previewOrders.length, to_at: TO, collected_at: TO }
      },
    },
  }

  const context = vm.createContext({
    exports: {},
    Date: RequestDate,
    require: request => {
      assert.ok(Object.hasOwn(dependencies, request), `Unexpected dependency: ${request}`)
      return dependencies[request]
    },
  })

  vm.runInContext(compiled, context)
  return {
    ...context.exports,
    calls,
    previews,
    setAccess: value => { access = { ...access, ...value } },
    setHost: value => { host = value },
    setNow: value => { currentNow = value },
  }
}

function setupIntegrated(user, afterResponse = () => undefined) {
  let storedUser = user
  const calls = []
  const modules = new Map()
  const source = 'https://operator-fixture.invalid'

  const dependencies = {
    '@/utils/storage': { getStoredUserData: () => storedUser },
    '@/plugins/axios': {
      getCurrentApiHost: () => source,
      default: {
        get: async (url, config) => {
          calls.push({ url, config })

          const response = url === '/orders'
            ? {
              data: {
                success: true,
                data: {
                  orders: [retentionOrder()],
                  filters: { start_at: config.params.datetime_from, end_at: config.params.datetime_to },
                  pagination: { total_orders: 1, total_pages: 1, per_page: 100, current_page: 1, has_next: false, has_previous: false },
                },
              },
            }
            : { data: body() }

          afterResponse()
          return response
        },
      },
    },
  }

  function loadModule(request) {
    if (Object.hasOwn(dependencies, request))
      return dependencies[request]
    if (modules.has(request))
      return modules.get(request)
    assert.ok(request.startsWith('@/'), `Unexpected dependency: ${request}`)

    const context = vm.createContext({ exports: {}, Date: FixedDate, URL, Blob, window: { location: { origin: source } }, require: loadModule })

    vm.runInContext(compile(`src/${request.slice(2)}.ts`), context)
    modules.set(request, context.exports)
    return context.exports
  }

  return {
    ...loadModule('@/services/operatorCalls'),
    ...loadModule('@/services/customerRetentionSnapshot'),
    readUserAccess: loadModule('@/composables/useUserAccess').readUserAccess,
    calls,
    setUser: value => { storedUser = value },
  }
}

test('calendar dates use Tashkent midnight, validate actual dates and cap today at now', () => {
  const service = setup()

  assert.equal(service.operatorCalendarDate(Date.parse('2026-08-08T18:59:59Z')), '2026-08-08')
  assert.equal(service.operatorCalendarDate(Date.parse('2026-08-08T19:00:00Z')), '2026-08-09')
  assert.deepEqual(json(service.operatorDayWindow(DATE)), { from_at: FROM, to_at: TO })
  assert.equal(service.operatorDayWindow('2026-09-10').to_at, new Date(NOW).toISOString())
  for (const date of ['2026-07-31', '2026-08-32', '2026-09-31', '2026-09-11', '08/08/2026', '', '2026-08-08T00:00:00Z'])
    assert.throws(() => service.operatorDayWindow(date), /oc_error_date/)
})

test('queue whitelists minimal customer, order and item fields without money or unrelated PII', () => {
  const service = setup()
  const raw = body()

  raw.data.accessToken = 'synthetic-secret'
  Object.assign(raw.data.customers[0], { address: 'synthetic-secret', loyalty_balance: 100000 })
  Object.assign(raw.data.customers[0].orders[0], { total_amount: '100000', profit: 50000, cashier: 'synthetic-secret' })
  Object.assign(raw.data.customers[0].orders[0].items[0], { price: '10000', cost: 9000, sku: 'synthetic-secret' })

  const result = service.parseOperatorQueue(raw, DATE)

  assert.deepEqual(json(result), body().data)
  assert.doesNotMatch(JSON.stringify(result), /synthetic-secret|total_amount|loyalty_balance|cashier|profit|"price"|"cost"/)
})

test('dedicated queue accepts only the optional approved order context and item comments', () => {
  const service = setup()
  const raw = body()
  const order = raw.data.customers[0].orders[0]

  Object.assign(order, {
    comment: 'Synthetic order note\nRing once',
    delivery_address: 'Synthetic street, 10',
    description: 'unrelated-secret',
    coordinates: 'unrelated-secret',
  })
  Object.assign(order.items[0], { comment: 'No onions', detail: 'unrelated-secret' })

  const result = service.parseOperatorQueue(raw, DATE).customers[0].orders[0]

  assert.equal(result.comment, 'Synthetic order note\nRing once')
  assert.equal(result.delivery_address, 'Synthetic street, 10')
  assert.equal(result.items[0].comment, 'No onions')
  assert.doesNotMatch(JSON.stringify(result), /unrelated-secret|description|coordinates|detail/)

  order.comment = null
  order.delivery_address = ''
  order.items[0].comment = null

  const empty = service.parseOperatorQueue(raw, DATE).customers[0].orders[0]

  assert.equal(empty.comment, null)
  assert.equal(empty.delivery_address, null)
  assert.equal(empty.items[0].comment, null)
})

test('queue context rejects non-text and oversized notes without truncating allowed source strings', () => {
  const service = setup()

  for (const field of ['comment', 'delivery_address', 'item_comment']) {
    for (const value of [42, false, [], {}, 'x'.repeat(20_001)]) {
      const raw = body()
      const order = raw.data.customers[0].orders[0]

      if (field === 'item_comment')
        order.items[0].comment = value
      else
        order[field] = value
      assert.throws(() => service.parseOperatorQueue(raw, DATE), /oc_error_contract/)
    }
  }

  const raw = body()
  const value = 'x'.repeat(20_000)

  Object.assign(raw.data.customers[0].orders[0], { comment: value, delivery_address: value })
  raw.data.customers[0].orders[0].items[0].comment = value

  const result = service.parseOperatorQueue(raw, DATE).customers[0].orders[0]

  assert.equal(result.comment, value)
  assert.equal(result.delivery_address, value)
  assert.equal(result.items[0].comment, value)
})

test('queue rejects malformed, noncanonical or duplicate phones, keys and order IDs', () => {
  const service = setup()

  const mutations = [
    raw => { raw.data.customers[0].phone = '90 000 00 01' },
    raw => { raw.data.customers[0].phone = '+998' },
    raw => { raw.data.customers[0].phone = 'tel:javascript:bad' },
    raw => { raw.data.customers[0].orders.push(fixtureOrder()) },
    raw => { raw.data.customers[0].orders[0].id = '1' },
    raw => { raw.data.customers[0].orders[0].order_type = 'UNKNOWN' },
    raw => { raw.data.customers[0].orders = [] },
    raw => { raw.data.customers[0].orders[0].items = null },
  ]

  for (const mutate of mutations) {
    const raw = body()

    mutate(raw)
    assert.throws(() => service.parseOperatorQueue(raw, DATE), /oc_error_contract/)
  }
  for (const duplicate of ['key', 'phone', 'order']) {
    const raw = body()

    raw.data.total_customers = 2
    raw.data.customers.push({ key: duplicate === 'key' ? 'synthetic-customer' : 'second', phone: duplicate === 'phone' ? PHONE : '+998900000002', orders: [fixtureOrder({ id: duplicate === 'order' ? 1 : 2 })] })
    assert.throws(() => service.parseOperatorQueue(raw, DATE), /oc_error_contract/)
  }
})

test('queue rejects truncated historical days, cross-day orders and inconsistent totals', () => {
  const service = setup()

  const mutations = [
    raw => { raw.data.to_at = '2026-08-08T13:00:00+05:00' },
    raw => { raw.data.to_at = '2026-08-08T19:00:04.000Z'; raw.data.customers[0].orders[0].created_at = '2026-08-08T19:00:01.000Z' },
    raw => { raw.data.customers[0].orders[0].created_at = TO },
    raw => { raw.data.customers[0].orders[0].created_at = '2026-08-07T18:59:59.000Z' },
    raw => { raw.data.total_customers = 2 },
    raw => { raw.data.time_zone = 'UTC' },
    raw => { raw.data.date = '2026-08-09' },
    raw => { raw.data.snapshot_id = null },
  ]

  for (const mutate of mutations) {
    const raw = body()

    mutate(raw)
    assert.throws(() => service.parseOperatorQueue(raw, DATE), /oc_error_contract/)
  }
})

test('items accept positive fractional numeric quantities but never coerce booleans or arrays', () => {
  const service = setup()

  assert.deepEqual(json(service.parseOperatorItems([{ name: 'Synthetic product', quantity: '2.5', amount: '100000' }])), [{ name: 'Synthetic product', quantity: 2.5 }])
  for (const quantity of [0, -1, Infinity, NaN, 100001, true, [1], {}, null])
    assert.throws(() => service.parseOperatorItems([{ name: 'Synthetic product', quantity }]), /oc_error_contract/)
})

test('a queue requested before Tashkent midnight remains valid after its response crosses midnight', async () => {
  const date = '2026-09-10'
  const requestedAt = Date.parse('2026-09-10T23:59:58+05:00')
  const respondedAt = Date.parse('2026-09-11T00:00:02+05:00')
  const raw = body()

  Object.assign(raw.data, {
    date,
    from_at: '2026-09-09T19:00:00.000Z',
    to_at: '2026-09-10T18:59:59.000Z',
  })
  raw.data.customers[0].orders[0].created_at = '2026-09-10T12:00:00+05:00'

  const service = setup({
    now: requestedAt,
    get: async () => {
      service.setNow(respondedAt)
      return { data: raw }
    },
  })

  assert.deepEqual(json(await service.loadOperatorQueue(date)), raw.data)
  assert.deepEqual(json(service.parseOperatorQueue(raw, date, requestedAt)), raw.data)
  assert.throws(() => service.parseOperatorQueue(raw, date), /oc_error_contract/)
  assert.equal(service.calls.length, 1)
  assert.equal(service.previews.length, 0)
})

test('OPERATOR uses only the dedicated endpoint and never falls back to general orders on errors', async () => {
  const service = setup()
  const controller = new AbortController()

  await service.loadOperatorQueue(DATE, { signal: controller.signal })
  assert.equal(service.calls.length, 1)
  assert.equal(service.calls[0].url, '/operator/call-queue')
  assert.deepEqual(json(service.calls[0].config.params), { date: DATE })
  assert.equal(service.calls[0].config.signal, controller.signal)
  assert.equal(service.previews.length, 0)
  for (const [status, message] of [[404, 'backend'], [405, 'backend'], [501, 'backend'], [401, 'permission'], [403, 'permission'], [500, 'network']]) {
    const failed = setup({ get: async () => { throw Object.assign(new Error('Synthetic failure'), { response: { status } }) } })

    await assert.rejects(failed.loadOperatorQueue(DATE), new RegExp(`oc_error_${message}`))
    assert.deepEqual(failed.calls.map(call => call.url), ['/operator/call-queue'])
    assert.equal(failed.previews.length, 0)
  }
})

test('known backend error codes retain actionable states without exposing messages or adding a fallback', async () => {
  const cases = [
    [422, 'INVALID_DATE', 'date'],
    [422, 'OBSERVATION_BEFORE_CUTOFF', 'date'],
    [422, 'FUTURE_DATE', 'date'],
    [422, 'OPERATOR_QUEUE_LIMIT_EXCEEDED', 'limit'],
    [503, 'OPERATOR_QUEUE_NOT_READY', 'backend'],
    [422, 'UNKNOWN_SYNTHETIC_ERROR', 'network'],
    [503, undefined, 'network'],
    [401, 'INVALID_DATE', 'permission'],
    [403, 'OPERATOR_QUEUE_LIMIT_EXCEEDED', 'permission'],
  ]

  for (const [status, code, message] of cases) {
    const service = setup({
      get: async () => { throw Object.assign(new Error('Synthetic failure'), { response: { status, data: { success: false, code, message: 'Private synthetic detail' } } }) },
    })

    await assert.rejects(service.loadOperatorQueue(DATE), { message: `oc_error_${message}` })
    assert.deepEqual(service.calls.map(call => call.url), ['/operator/call-queue'])
    assert.equal(service.previews.length, 0)
  }
})

test('operator-prefixed non-admin users load only the dedicated queue and never gain admin transport', async () => {
  for (const role of ['USER', 'user']) {
    const service = setup({ role, email: 'operator@example.invalid' })
    const result = await service.loadOperatorQueue(DATE)

    assert.equal(result.total_customers, 1)
    assert.equal(result.customers[0].orders[0].items[0].name, 'Synthetic product')
    assert.deepEqual(service.calls.map(call => call.url), ['/operator/call-queue'])
    assert.equal(service.previews.length, 0)
    await assert.rejects(service.loadAdminOrderItems(fixtureOrder()), /oc_error_permission/)
    assert.equal(service.calls.length, 1)

    const unavailable = setup({ role, email: 'Operator@example.invalid', get: async () => { throw Object.assign(new Error('Not ready'), { response: { status: 404 } }) } })

    await assert.rejects(unavailable.loadOperatorQueue(DATE), /oc_error_backend/)
    assert.deepEqual(unavailable.calls.map(call => call.url), ['/operator/call-queue'])
    assert.equal(unavailable.previews.length, 0)
  }
})

test('queue and detail access deny ordinary USER and unrelated roles or missing permission without requests', async () => {
  for (const state of [{ role: 'USER' }, { role: 'CASHIER' }, { role: 'MANAGER' }, { allowed: false }, { userId: null }]) {
    const service = setup()

    service.setAccess(state)
    await assert.rejects(service.loadOperatorQueue(DATE), /oc_error_permission/)
    assert.equal(service.calls.length, 0)
    assert.equal(service.previews.length, 0)
  }
  const operator = setup()

  await assert.rejects(operator.loadAdminOrderItems(fixtureOrder()), /oc_error_permission/)
  assert.equal(operator.calls.length, 0)
})

test('source, identity and permission changes invalidate a response before data is returned', async () => {
  for (const change of ['host', 'user', 'permission', 'email']) {
    const service = setup({
      get: async () => {
        if (change === 'host')
          service.setHost('https://changed-fixture.invalid')
        else if (change === 'email')
          service.setAccess({ email: 'operator-other@example.invalid' })
        else
          service.setAccess(change === 'user' ? { userId: 2 } : { allowed: false })
        return { data: body() }
      },
    })

    await assert.rejects(service.loadOperatorQueue(DATE), /oc_error_(context|permission)/)
  }
})

test('already canceled operations never dispatch queue, preview, or detail requests', async () => {
  const controller = new AbortController()

  controller.abort()
  for (const role of ['OPERATOR', 'ADMIN']) {
    const service = setup({ role })

    await assert.rejects(service.loadOperatorQueue(DATE, { signal: controller.signal }), /oc_error_canceled/)
    assert.equal(service.calls.length, 0)
    assert.equal(service.previews.length, 0)
    if (role === 'ADMIN') {
      await assert.rejects(service.loadAdminOrderItems(fixtureOrder(), controller.signal), /oc_error_canceled/)
      assert.equal(service.calls.length, 0)
    }
  }
})

test('ADMIN preview uses the exact day collector and retains only eligible customers with lazy items', async () => {
  const service = setup({
    role: 'ADMIN',
    previewOrders: [
      retentionOrder(1),
      retentionOrder(2, { order_type: 'DELIVERY' }),
      retentionOrder(3, { is_paid: false }),
      retentionOrder(4, { customer_is_staff: true }),
    ],
  })

  const result = await service.loadOperatorQueue(DATE)

  assert.equal(service.calls.length, 0)
  assert.equal(service.previews.length, 1)
  assert.equal(service.previews[0].fromAt, FROM)
  assert.equal(service.previews[0].toAt, TO)
  assert.equal(result.admin_preview, true)
  assert.equal(result.total_customers, 1)
  assert.equal(result.customers[0].orders.length, 2)
  assert.ok(result.customers[0].orders.every(order => order.items === null))
  assert.doesNotMatch(JSON.stringify(result), /total_amount|phone_number|customer_is_staff|is_paid/)
})

test('operator-prefix ADMIN uses its own existing Orders adapter while returning only calling fields', async () => {
  const service = setup({ role: 'ADMIN', email: ' Operator.one@example.invalid ' })
  const result = await service.loadOperatorQueue(DATE)

  assert.equal(service.calls.length, 0)
  assert.equal(service.previews.length, 1)
  assert.equal(service.previews[0].fromAt, FROM)
  assert.equal(service.previews[0].toAt, TO)
  assert.equal(result.total_customers, 1)
  assert.equal(result.customers[0].orders[0].items, null)
  assert.doesNotMatch(JSON.stringify(result), /total_amount|phone_number|customer_is_staff|is_paid/)
})

test('real prefix ADMIN access passes the actual collector actor guard without admin UI permission', async () => {
  for (const user of [
    { id: 1, role: 'ADMIN', email: 'operator@example.invalid' },
    { user: { id: 1, role: ' admin ', email: ' Operator.one@example.invalid ' } },
  ]) {
    const service = setupIntegrated(user)
    const access = service.readUserAccess()

    assert.equal(access.role, 'OPERATOR')
    assert.equal(access.serverRole, 'ADMIN')
    assert.equal(access.isAdministrator, false)
    assert.equal(access.has('customer.retention.view'), false)

    const result = await service.loadOperatorQueue(DATE)

    assert.deepEqual(service.calls.map(call => call.url), ['/orders', '/orders'])
    assert.equal(result.total_customers, 1)
    assert.equal(result.customers[0].phone, PHONE)
    assert.equal(result.customers[0].orders[0].id, 1)
    assert.doesNotMatch(JSON.stringify(result), /total_amount|customer_is_staff|is_paid/)
  }
})

test('real non-admin calling access never falls back to the Orders collector or detail transport', async () => {
  for (const user of [
    { id: 1, role: 'USER', email: 'operator@example.invalid' },
    { id: 1, role: 'MANAGER', email: 'Operator.one@example.invalid', permissions: ['*'] },
    { id: 1, role: 'OPERATOR', email: 'caller@example.invalid', permissions: ['operator.call_queue.view'] },
  ]) {
    const service = setupIntegrated(user)
    const result = await service.loadOperatorQueue(DATE)

    assert.equal(result.total_customers, 1)
    assert.deepEqual(service.calls.map(call => call.url), ['/operator/call-queue'])
    await assert.rejects(service.collectRetentionSnapshot({ fromAt: FROM, toAt: TO }), /cr_error_forbidden/)
    await assert.rejects(service.loadAdminOrderItems(fixtureOrder()), /oc_error_permission/)
    assert.equal(service.calls.length, 1)
  }
})

test('real collector discards prefix ADMIN responses when email or actual server role changes', async () => {
  for (const change of [{ email: 'operator-other@example.invalid' }, { role: 'USER' }]) {
    const user = { id: 1, role: 'ADMIN', email: 'operator@example.invalid' }
    const service = setupIntegrated(user, () => service.setUser({ ...user, ...change }))

    await assert.rejects(service.loadOperatorQueue(DATE), /cr_error_(source_changed|forbidden)/)
    assert.deepEqual(service.calls.map(call => call.url), ['/orders'])
  }
})

test('operator-prefix ADMIN may lazily read product names and quantities from its own order detail', async () => {
  const service = setup({
    role: 'ADMIN',
    email: 'operator@example.invalid',
    get: async () => ({ data: { success: true, data: { order: { ...fixtureOrder(), total_amount: '100000', items: [{ product: { name: 'Synthetic product', cost: '1000' }, quantity: '2.5', price: '10000' }] } } } }),
  })

  assert.deepEqual(json(await service.loadAdminOrderItems(fixtureOrder())), [{ name: 'Synthetic product', quantity: 2.5 }])
  assert.deepEqual(service.calls.map(call => call.url), ['/orders/1'])
})

test('changing email or backend authority invalidates pending operator ADMIN adapter results', async () => {
  for (const change of [{ email: 'operator-other@example.invalid' }, { role: 'USER' }]) {
    const service = setup({ role: 'ADMIN', email: 'operator@example.invalid', collect: async () => service.setAccess(change) })

    await assert.rejects(service.loadOperatorQueue(DATE), /oc_error_(context|permission)/)
    assert.equal(service.previews.length, 1)
    assert.equal(service.calls.length, 0)
  }
})

test('only ADMIN lazily requests the real detail path and extracts product names with quantities', async () => {
  const service = setup({
    role: 'ADMIN',
    get: async () => ({
      data: {
        success: true,
        data: {
          order: {
            ...fixtureOrder(), total_amount: '100000', items: [{ product: { name: 'Synthetic product', cost: '1000' }, quantity: '2.5', price: '10000' }],
          },
        },
      },
    }),
  })

  const result = await service.loadAdminOrderItems(fixtureOrder())

  assert.deepEqual(service.calls.map(call => call.url), ['/orders/1'])
  assert.deepEqual(json(result), [{ name: 'Synthetic product', quantity: 2.5 }])
  for (const changed of [{ id: 2 }, { created_at: TO }, { items: null }]) {
    const mismatch = setup({ role: 'ADMIN', get: async () => ({ data: { success: true, data: { order: { ...fixtureOrder(), ...changed } } } }) })

    await assert.rejects(mismatch.loadAdminOrderItems(fixtureOrder()), /oc_error_contract/)
  }
})

test('ADMIN order details map exact backend context fields and never retain unrelated detail data', async () => {
  const service = setup({
    role: 'ADMIN',
    email: 'operator@example.invalid',
    get: async () => ({
      data: {
        success: true,
        data: {
          order: {
            ...fixtureOrder({ order_type: 'DELIVERY' }),
            description: 'Synthetic note\nUse the side entrance',
            delivery_address: 'Synthetic street, 10',
            comment: 'unrelated-secret',
            cashier: { email: 'unrelated-secret' },
            place: { name: 'unrelated-secret' },
            table: { name: 'unrelated-secret' },
            payments: 'unrelated-secret',
            items: [{ product: { name: 'Synthetic product' }, quantity: 2, detail: 'No onions', comment: 'unrelated-secret', price: 20000 }],
          },
        },
      },
    }),
  })

  const controller = new AbortController()
  const result = await service.loadAdminOrderDetails(fixtureOrder({ order_type: 'DELIVERY' }), controller.signal)

  assert.deepEqual(json(result), {
    comment: 'Synthetic note\nUse the side entrance',
    delivery_address: 'Synthetic street, 10',
    ready_at: null,
    preparation_time_seconds: null,
    items: [{ name: 'Synthetic product', quantity: 2, comment: 'No onions' }],
  })
  assert.deepEqual(service.calls.map(call => call.url), ['/orders/1'])
  assert.equal(service.calls[0].config.signal, controller.signal)
  assert.doesNotMatch(JSON.stringify(result), /unrelated-secret|cashier|payments|table|place|"price"/)
})

test('ADMIN details support absent legacy context and null or empty comments without invented text', async () => {
  for (const fields of [{}, { description: null, delivery_address: null }, { description: '', delivery_address: '' }]) {
    const service = setup({
      role: 'ADMIN',
      get: async () => ({ data: { success: true, data: { order: { ...fixtureOrder(), ...fields, items: [] } } } }),
    })

    assert.deepEqual(json(await service.loadAdminOrderDetails(fixtureOrder())), {
      comment: null, delivery_address: null, ready_at: null, preparation_time_seconds: null, items: [],
    })
  }
})

test('recorded preparation accepts coherent backend duration and timestamp pairs including instant orders', async () => {
  const timingCases = [
    { ready_at: '2026-08-08T12:05:30+05:00', preparation_time_seconds: 330 },
    { ready_at: '2026-08-08T07:00:00.000Z', preparation_time_seconds: 0 },
    { ready_at: '2026-08-08T12:00:00.000999+05:00', preparation_time_seconds: 0.000999 },
    { ready_at: '2026-08-09T00:05:00+05:00', preparation_time_seconds: 43500 },
  ]

  for (const timing of timingCases) {
    const service = setup({
      role: 'ADMIN',
      get: async () => ({ data: { success: true, data: { order: { ...fixtureOrder(), ...timing, items: [] } } } }),
    })

    const result = await service.loadAdminOrderDetails(fixtureOrder())

    assert.equal(result.ready_at, timing.ready_at)
    assert.equal(result.preparation_time_seconds, timing.preparation_time_seconds)
    assert.deepEqual(service.calls.map(call => call.url), ['/orders/1'])
  }
})

test('missing or untrustworthy preparation remains unknown without hiding otherwise usable details', async () => {
  const validReady = '2026-08-08T12:05:00+05:00'

  const timingCases = [
    {},
    { ready_at: null, preparation_time_seconds: null },
    { ready_at: validReady },
    { preparation_time_seconds: 300 },
    { ready_at: validReady, preparation_time_seconds: '300' },
    { ready_at: validReady, preparation_time_seconds: true },
    { ready_at: validReady, preparation_time_seconds: Infinity },
    { ready_at: validReady, preparation_time_seconds: NaN },
    { ready_at: validReady, preparation_time_seconds: -1 },
    { ready_at: validReady, preparation_time_seconds: 301 },
    { ready_at: '2026-08-08T11:59:59+05:00', preparation_time_seconds: 0 },
    { ready_at: '2026-08-08', preparation_time_seconds: 300 },
    { ready_at: 'not-a-date', preparation_time_seconds: 300 },
    { ready_at: true, preparation_time_seconds: 300 },
    { ready_at: '2027-08-08T12:00:00+05:00', preparation_time_seconds: 365 * 86400 },
    { paid_at: validReady, updated_at: validReady, status: 'COMPLETED' },
  ]

  for (const timing of timingCases) {
    const service = setup({
      role: 'ADMIN',
      get: async () => ({ data: { success: true, data: { order: { ...fixtureOrder(), ...timing, description: 'Synthetic note', items: [] } } } }),
    })

    const result = await service.loadAdminOrderDetails(fixtureOrder())

    assert.equal(result.ready_at, null)
    assert.equal(result.preparation_time_seconds, null)
    assert.equal(result.comment, 'Synthetic note')
    assert.deepEqual(service.calls.map(call => call.url), ['/orders/1'])
  }
})

test('dedicated queue optionally projects recorded timing and never fills absent timing from unrelated timestamps', async () => {
  const raw = body()
  const timing = { ready_at: '2026-08-08T12:05:30+05:00', preparation_time_seconds: 330 }

  Object.assign(raw.data.customers[0].orders[0], timing, { updated_at: TO, paid_at: TO, preparation_time_formatted: 'unrelated-secret' })

  const service = setup({ get: async () => ({ data: raw }) })
  const result = await service.loadOperatorQueue(DATE)
  const order = result.customers[0].orders[0]

  assert.equal(order.ready_at, timing.ready_at)
  assert.equal(order.preparation_time_seconds, 330)
  assert.doesNotMatch(JSON.stringify(result), /updated_at|paid_at|unrelated-secret|preparation_time_formatted/)
  assert.deepEqual(service.calls.map(call => call.url), ['/operator/call-queue'])
  assert.equal(service.previews.length, 0)

  raw.data.customers[0].orders[0].preparation_time_seconds = 999

  const inconsistent = service.parseOperatorQueue(raw, DATE).customers[0].orders[0]

  assert.equal(inconsistent.ready_at, null)
  assert.equal(inconsistent.preparation_time_seconds, null)
  assert.equal(inconsistent.items[0].name, 'Synthetic product')
})

test('ADMIN details reject wrong order type, malformed identity or invalid context without fallback', async () => {
  const mutations = [
    { order_type: 'PICKUP' },
    { id: 2 },
    { created_at: '2026-08-08' },
    { description: {} },
    { delivery_address: false },
    { description: 'x'.repeat(20_001) },
    { delivery_address: 'x'.repeat(20_001) },
    { items: [{ product: { name: 'Synthetic product' }, quantity: 1, detail: 42 }] },
    { items: [{ product: { name: 'Synthetic product' }, quantity: 1, detail: 'x'.repeat(20_001) }] },
  ]

  for (const fields of mutations) {
    const service = setup({
      role: 'ADMIN',
      get: async () => ({ data: { success: true, data: { order: { ...fixtureOrder(), items: [], ...fields } } } }),
    })

    await assert.rejects(service.loadAdminOrderDetails(fixtureOrder()), /oc_error_contract/)
    assert.deepEqual(service.calls.map(call => call.url), ['/orders/1'])
    assert.equal(service.previews.length, 0)
  }
})

test('new detail context API remains actual-admin-only and discards stale or aborted results', async () => {
  for (const role of ['USER', 'MANAGER', 'WAREHOUSE', 'OPERATOR']) {
    const service = setup({ role, email: 'operator@example.invalid' })

    await assert.rejects(service.loadAdminOrderDetails(fixtureOrder()), /oc_error_permission/)
    assert.equal(service.calls.length, 0)
  }
  for (const change of ['host', 'user', 'role', 'email', 'abort']) {
    const controller = new AbortController()

    const service = setup({
      role: 'ADMIN',
      email: 'operator@example.invalid',
      get: async () => {
        if (change === 'host')
          service.setHost('https://changed-fixture.invalid')
        else if (change === 'user')
          service.setAccess({ userId: 2 })
        else if (change === 'role')
          service.setAccess({ role: 'USER' })
        else if (change === 'email')
          service.setAccess({ email: 'operator-other@example.invalid' })
        else
          controller.abort()
        return { data: { success: true, data: { order: { ...fixtureOrder(), description: 'Synthetic note', items: [] } } } }
      },
    })

    await assert.rejects(service.loadAdminOrderDetails(fixtureOrder(), controller.signal), /oc_error_(context|permission|canceled)/)
    assert.deepEqual(service.calls.map(call => call.url), ['/orders/1'])
  }
})

test('transport cancellation is reported as cancellation without a fallback', async () => {
  const service = setup({ get: async () => { throw Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' }) } })

  await assert.rejects(service.loadOperatorQueue(DATE), /oc_error_canceled/)
  assert.equal(service.previews.length, 0)
})
