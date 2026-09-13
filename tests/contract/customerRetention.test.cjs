/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

// Synthetic fixtures only. The actual TypeScript engine and collector execute
// in isolation with a mocked Axios transport, never a browser or real server.
const root = path.resolve(__dirname, '../..')
const FROM = '2026-08-01T00:00:00+05:00'
const TO = '2026-09-10T12:00:00+05:00'
const COLLECTION_FROM = '2026-08-05T00:00:00+05:00'
const COLLECTION_TO = '2026-08-06T00:00:00+05:00'
const PHONE = '+998900000001'
const OTHER_PHONE = '+998900000002'
const SOURCE = 'https://retention-fixture.invalid'
const json = value => JSON.parse(JSON.stringify(value))

const compile = relative => ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText

const engineContext = vm.createContext({ exports: {} })

vm.runInContext(compile('src/utils/customerRetention.ts'), engineContext)

const engine = engineContext.exports
const compiledService = compile('src/services/customerRetentionSnapshot.ts')

function order(id = 1, overrides = {}) {
  return {
    id,
    order_number: `TEST-${id}`,
    customer_id: null,
    customer_name: null,
    customer_phone: null,
    customer_is_staff: false,
    phone_number: PHONE,
    created_at: '2026-08-05T12:00:00+05:00',
    updated_at: null,
    order_origin: 'POS',
    status: 'COMPLETED',
    is_paid: true,
    order_type: 'HALL',
    total_amount: '100000.10',
    ...overrides,
  }
}

function snapshot(orders = [order()], overrides = {}) {
  return {
    schema_version: 1,
    from_at: FROM,
    to_at: TO,
    collected_at: TO,
    source_api: `${SOURCE}/api/admins`,
    scope: 'authenticated_account',
    record_count: orders.length,
    total_pages: Math.max(1, Math.ceil(orders.length / 100)),
    consistency: 'pagination_verified_not_transactional',
    orders,
    ...overrides,
  }
}

function response(orders, page, fromAt, toAt) {
  const total = orders.length
  const pages = Math.max(1, Math.ceil(total / 100))

  return {
    data: {
      success: true,
      data: {
        orders: orders.slice((page - 1) * 100, page * 100),
        filters: { start_at: fromAt, end_at: toAt },
        pagination: {
          total_orders: total,
          total_pages: pages,
          per_page: 100,
          current_page: page,
          has_next: page < pages,
          has_previous: page > 1,
        },
      },
    },
  }
}

function loadService({ orders = [order()], intercept, access = {} } = {}) {
  let host = SOURCE
  let userAccess = { userId: 1, role: 'ADMIN', has: permission => permission === 'customer.retention.view', ...access }
  const calls = []

  const dependencies = {
    '@/plugins/axios': {
      getCurrentApiHost: () => host,
      default: {
        get: async (url, config) => {
          calls.push({ url, params: json(config.params), signal: config.signal })

          const matching = orders.filter(row => Date.parse(row.created_at) >= Date.parse(config.params.datetime_from) && Date.parse(row.created_at) < Date.parse(config.params.datetime_to))
          const result = response(matching, config.params.page, config.params.datetime_from, config.params.datetime_to)

          return intercept ? intercept(result, calls.length, config.params.page) : result
        },
      },
    },
    '@/utils/customerRetention': engine,
    '@/composables/useUserAccess': { readUserAccess: () => userAccess },
  }

  const context = vm.createContext({
    exports: {},
    URL,
    Blob,
    window: { location: { origin: SOURCE } },
    require: request => {
      assert.ok(Object.hasOwn(dependencies, request), `Unexpected dependency: ${request}`)
      return dependencies[request]
    },
  })

  vm.runInContext(compiledService, context)
  return {
    ...context.exports,
    calls,
    setHost: value => { host = value },
    setAccess: value => { userAccess = { ...userAccess, ...value } },
  }
}

const analyze = (orders, overrides, rules) => engine.analyzeRetentionSnapshot(snapshot(orders, overrides), rules)
const parse = value => loadService().parseRetentionSnapshot(JSON.stringify(value))
const collect = (service, options = {}) => service.collectRetentionSnapshot({ fromAt: COLLECTION_FROM, toAt: COLLECTION_TO, ...options })
const manyOrders = () => Array.from({ length: 101 }, (_, index) => order(index + 1))

test('phone normalization merges local Uzbek forms and explicit international numbers only', () => {
  for (const input of ['90 000 00 01', '998900000001', '+998 (90) 000-00-01', '00998900000001'])
    assert.equal(engine.normalizeRetentionPhone(input), PHONE)
  assert.equal(engine.normalizeRetentionPhone('+1 (202) 555-0101'), '+12025550101')
  for (const input of ['', null, 900000001, '+998', 'N/A', '—', '+99890abc0000001', '123456789012', '000000000', '+998000000000'])
    assert.equal(engine.normalizeRetentionPhone(input), null, `Accepted placeholder ${input}`)
})

test('one observed order becomes inactive at exactly five complete 24-hour days', () => {
  const orders = [order(1, { created_at: '2026-09-05T12:00:00+05:00' })]
  const before = analyze(orders, { to_at: '2026-09-10T11:59:59.999+05:00' }).customers[0]
  const exact = analyze(orders).customers[0]

  assert.equal(before.inactive_days, 4)
  assert.equal(before.segment, 'ACTIVE')
  assert.equal(exact.inactive_days, 5)
  assert.equal(exact.inactive_after_days, 5)
  assert.equal(exact.segment, 'ONE_TIME_INACTIVE')
  assert.equal(exact.overdue_days, 0)
  assert.equal(exact.cadence_confidence, 'LIMITED')
})

test('repeat cadence uses only the last ten distinct visit dates, not every historical gap', () => {
  const daily = Array.from({ length: 20 }, (_, index) => order(index + 1, {
    created_at: `2026-08-${String(index + 1).padStart(2, '0')}T12:00:00+05:00`,
  }))

  const recent = Array.from({ length: 10 }, (_, index) => order(index + 21, {
    created_at: new Date(Date.parse('2026-09-01T12:00:00+05:00') + index * 6 * 86400000).toISOString(),
  }))

  const duplicates = Array.from({ length: 30 }, (_, index) => order(index + 31, { created_at: recent[9].created_at }))
  const customer = analyze([...daily, ...recent, ...duplicates], { to_at: '2026-11-10T12:00:00+05:00' }).customers[0]

  assert.equal(customer.order_count, 60)
  assert.equal(customer.median_gap_days, 6)
  assert.equal(customer.inactive_after_days, 12)
  assert.equal(customer.segment, 'REPEAT_INACTIVE')
  assert.equal(customer.cadence_confidence, 'OBSERVED')
})

test('visit dates roll over at 03:00 Tashkent and same-day orders do not inflate cadence', () => {
  const orders = [
    order(1, { created_at: '2026-08-05T02:59:59+05:00' }),
    order(2, { created_at: '2026-08-05T03:00:00+05:00' }),
    order(3, { created_at: '2026-08-05T23:00:00+05:00' }),
    order(4, { created_at: '2026-08-10T02:59:59+05:00' }),
  ]

  const customer = analyze(orders).customers[0]

  assert.equal(customer.median_gap_days, 2.5)
  assert.equal(customer.inactive_after_days, 7)

  const sameDay = analyze([order(1), order(2)]).customers[0]

  assert.equal(sameDay.median_gap_days, null)
  assert.equal(sameDay.inactive_after_days, 7)
  assert.equal(sameDay.cadence_confidence, 'LIMITED')
})

test('adaptive threshold rounds up and validates settings rather than accepting NaN', () => {
  const orders = [order(1), order(2, { created_at: '2026-08-11T12:00:00+05:00' })]
  const rules = { one_time_days: 5, repeat_min_days: 7, repeat_gap_multiplier: 1.25 }

  assert.equal(analyze(orders, {}, rules).customers[0].inactive_after_days, 8)
  for (const invalid of [{ one_time_days: 0 }, { repeat_min_days: 1.5 }, { repeat_gap_multiplier: NaN }, { repeat_gap_multiplier: 11 }])
    assert.throws(() => analyze(orders, {}, { ...rules, ...invalid }), /cr_error_invalid_rules/)
})

test('all three sales channels share the normalized phone without claiming lifetime history', () => {
  const result = analyze([
    order(1, { order_type: 'HALL', phone_number: '90 000 00 01' }),
    order(2, { order_type: 'DELIVERY', phone_number: PHONE, order_origin: 'TELEGRAM', customer_id: 4 }),
    order(3, { order_type: 'PICKUP', phone_number: null, customer_phone: PHONE, customer_id: 5 }),
  ])

  assert.equal(result.customers.length, 1)
  assert.equal(result.customers[0].order_count, 3)
  assert.deepEqual(json(result.customers[0].order_types), ['DELIVERY', 'HALL', 'PICKUP'])
  assert.equal(result.customers[0].first_order_at, '2026-08-05T12:00:00+05:00')
  assert.equal(Object.keys(result.customers[0]).some(key => /lifetime|first.ever/i.test(key)), false)
})

test('only paid noncanceled nonstaff orders count; anonymous and invalid phones reconcile', () => {
  const result = analyze([
    order(1),
    order(2, { is_paid: false }),
    order(3, { status: 'CANCELED' }),
    order(4, { customer_is_staff: true }),
    order(5, { phone_number: null }),
    order(6, { phone_number: '+998' }),
    order(7, { phone_number: 'invalid', customer_phone: PHONE }),
    order(8, { phone_number: OTHER_PHONE, customer_phone: PHONE }),
    order(9, { phone_number: null, customer_phone: PHONE }),
  ])

  const metrics = result.metrics

  assert.deepEqual(json(metrics), {
    collected_orders: 9,
    eligible_orders: 6,
    identified_orders: 3,
    anonymous_orders: 2,
    invalid_phone_orders: 1,
    staff_orders: 1,
    phone_conflict_orders: 1,
    customers: 2,
    one_time_inactive: 1,
    repeat_inactive: 1,
    active: 0,
  })
  assert.equal(metrics.eligible_orders, metrics.identified_orders + metrics.anonymous_orders + metrics.invalid_phone_orders)
  assert.equal(result.customers.find(customer => customer.phone === OTHER_PHONE).orders[0].id, 8)
})

test('money retains exact cents and rejects negative, nonfinite, excessive, or malformed values', () => {
  assert.equal(engine.retentionAmountCents('100000.10'), 10000010)
  assert.equal(analyze([order(1, { total_amount: '0.10' }), order(2, { total_amount: '0.20' })]).customers[0].total_spent, 0.3)
  for (const value of ['-1', 'NaN', 'Infinity', '1e3', '1.001', '100 000', '9007199254740992'])
    assert.throws(() => engine.retentionAmountCents(value), /cr_error_invalid_snapshot/)
})

test('snapshot import is a strict whitelist and strips unrelated PII, tokens and notes', () => {
  const raw = snapshot([order(1, { address: 'Synthetic address', token: 'fixture-token', notes: 'Remove', customer: { email: 'unused@example.invalid' } })], {
    accessToken: 'fixture-token', password: 'fixture-password', address: 'Remove',
  })

  const result = parse(raw)

  assert.deepEqual(json(result), snapshot())
  assert.doesNotMatch(JSON.stringify(result), /fixture-token|fixture-password|Synthetic address|unused@example|"notes"|"address"/)
  assert.equal(typeof result.orders[0].total_amount, 'string')
})

test('snapshot parser rejects wrong versions, duplicate IDs, invalid coverage and amounts', () => {
  const invalid = [
    snapshot([], { schema_version: 2 }),
    snapshot([order(), order()]),
    snapshot([], { record_count: 1 }),
    snapshot([], { from_at: '2026-07-31T00:00:00+05:00' }),
    snapshot([], { to_at: FROM }),
    snapshot([order(1, { created_at: TO })]),
    snapshot([order(1, { created_at: '2026-07-31T23:59:59+05:00' })]),
    snapshot([order(1, { created_at: '2026-08-05T12:00:00' })]),
    snapshot([order(1, { total_amount: -1 })]),
    snapshot([order(1, { total_amount: 'Infinity' })]),
    snapshot([order(1, { id: '1' })]),
    snapshot([order(1, { is_paid: 'true' })]),
    snapshot([], { source_api: 'https://user:password@retention-fixture.invalid/api/admins' }),
    snapshot([], { source_api: `${SOURCE}/api/admins?token=fixture` }),
  ]

  for (const value of invalid)
    assert.throws(() => parse(value), /cr_error_(invalid_snapshot|window)/)
  assert.throws(() => loadService().parseRetentionSnapshot('{not json'), /cr_error_invalid_snapshot/)
})

test('collector requests the exact unfiltered timestamp window, stable IDs and no item expansion', async () => {
  const progress = []
  const service = loadService({ orders: manyOrders() })
  const controller = new AbortController()
  const result = await collect(service, { signal: controller.signal, onProgress: value => progress.push(json(value)) })

  assert.equal(result.record_count, 101)
  assert.equal(result.consistency, 'pagination_verified_not_transactional')
  assert.deepEqual(service.calls.map(call => call.params.page), [1, 2, 1, 2])
  for (const call of service.calls) {
    assert.equal(call.url, '/orders')
    assert.equal(call.signal, controller.signal)
    assert.deepEqual(call.params, { page: call.params.page, per_page: 100, order_by: 'id', include_items: false, datetime_from: new Date(COLLECTION_FROM).toISOString(), datetime_to: new Date(COLLECTION_TO).toISOString() })
  }
  assert.deepEqual(progress.map(item => [item.phase, item.loaded]), [['collecting', 100], ['collecting', 101], ['verifying', 101], ['verifying', 101]])
})

test('collection whitelists customer data and accepts numeric money without binary rounding', async () => {
  const service = loadService({
    orders: [order(1, {
      customer: { id: 4, name: 'Synthetic customer', phone: PHONE, is_staff: true, address: 'Remove', token: 'Remove' },
      total_amount: 100000.25,
      address: 'Remove',
      accessToken: 'Remove',
    })],
  })

  const result = await collect(service)

  assert.equal(result.orders[0].customer_id, 4)
  assert.equal(result.orders[0].customer_is_staff, true)
  assert.equal(result.orders[0].customer_phone, PHONE)
  assert.equal(engine.retentionAmountCents(result.orders[0].total_amount), 10000025)
  assert.doesNotMatch(JSON.stringify(result), /Remove|address|accessToken/)
})

test('a truly empty complete snapshot is verified twice rather than replaced with demo rows', async () => {
  const service = loadService({ orders: [] })
  const result = await collect(service)

  assert.equal(result.record_count, 0)
  assert.equal(result.orders.length, 0)
  assert.equal(service.calls.length, 2)
})

test('collector rejects missing contracts, changed echoed windows and malformed pagination', async () => {
  const corruptions = [
    result => { result.data.success = false },
    result => { delete result.data.data.filters },
    result => { result.data.data.filters.end_at = FROM },
    result => { result.data.data.pagination.current_page = 2 },
    result => { result.data.data.pagination.total_orders = '1' },
    result => { result.data.data.pagination.per_page = 50 },
    result => { result.data.data.pagination.has_next = true },
    result => { result.data.data.pagination.total_pages = 2 },
    result => { result.data.data.orders = [] },
  ]

  for (const corrupt of corruptions) {
    const service = loadService({ intercept: result => { corrupt(result); return result } })

    await assert.rejects(collect(service), /cr_error_(contract|window|pagination)/)
  }
})

test('duplicates, out-of-order IDs, missing rows and inconsistent totals never complete', async () => {
  const corruptions = [
    result => { result.data.data.orders[0].id = 1 },
    result => { result.data.data.orders = [] },
    result => { result.data.data.pagination.total_orders = 100 },
    result => { result.data.data.orders[0].created_at = TO },
  ]

  for (const corrupt of corruptions) {
    const service = loadService({
      orders: manyOrders(),
      intercept: (result, _, page) => {
        if (page === 2)
          corrupt(result)
        return result
      },
    })

    await assert.rejects(collect(service), /cr_error_(pagination|window)/)
  }
  const unordered = loadService({ orders: [order(2), order(1)] })

  await assert.rejects(collect(unordered), /cr_error_pagination/)
})

test('first and last page rechecks reject mutable source data before returning a snapshot', async () => {
  for (const changedCall of [3, 4]) {
    const service = loadService({
      orders: manyOrders(),
      intercept: (result, call) => {
        if (call % 4 === changedCall % 4)
          result.data.data.orders[0] = { ...result.data.data.orders[0], total_amount: '1.00' }
        return result
      },
    })

    await assert.rejects(collect(service), /cr_error_changed/)
  }
})

test('transport failures expose no partial snapshot or fake successful result', async () => {
  for (const [status, code] of [[401, 'auth'], [403, 'forbidden'], [429, 'rate_limit'], [404, 'contract'], [500, 'network']]) {
    const service = loadService({
      orders: manyOrders(),
      intercept: (result, call) => {
        if (call === 2)
          throw Object.assign(new Error('Synthetic API failure'), { response: { status } })
        return result
      },
    })

    await assert.rejects(collect(service), new RegExp(`cr_error_${code}`))
    assert.equal(service.calls.length, 2)
  }
})

test('cancellation before or during a request rejects without a partial result', async () => {
  const controller = new AbortController()
  const service = loadService()

  controller.abort()
  await assert.rejects(collect(service, { signal: controller.signal }), /cr_error_canceled/)
  assert.equal(service.calls.length, 0)

  const during = loadService({ intercept: () => { throw Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' }) } })

  await assert.rejects(collect(during), /cr_error_canceled/)
})

test('changing API origin while downloading invalidates the entire snapshot', async () => {
  const service = loadService({
    intercept: result => {
      service.setHost('https://other-fixture.invalid')
      return result
    },
  })

  await assert.rejects(collect(service), /cr_error_source_changed/)
})

test('retention permission and an identified user are required before any request', async () => {
  for (const access of [{ has: () => false }, { userId: null }]) {
    const service = loadService({ access })

    await assert.rejects(collect(service), /cr_error_(forbidden|auth)/)
    assert.equal(service.calls.length, 0)
  }
})

test('switching authenticated user or role during collection rejects the whole snapshot', async () => {
  for (const changed of [{ userId: 2 }, { role: 'MANAGER' }]) {
    const service = loadService({
      intercept: result => {
        service.setAccess(changed)
        return result
      },
    })

    await assert.rejects(collect(service), /cr_error_source_changed/)
    assert.equal(service.calls.length, 1)
  }
})

test('revoking retention permission during a response prevents further requests and completion', async () => {
  const service = loadService({
    orders: manyOrders(),
    intercept: result => {
      service.setAccess({ has: () => false })
      return result
    },
  })

  await assert.rejects(collect(service), /cr_error_forbidden/)
  assert.equal(service.calls.length, 1)
})

test('pagination diagnostics expose safe counts without customer data or tokens', async () => {
  const service = loadService({
    intercept: result => {
      result.data.data.pagination.total_orders = 2
      return result
    },
  })

  await assert.rejects(collect(service), error => {
    assert.equal(error.code, 'cr_error_pagination')
    assert.deepEqual(json(error.details), { reason: 'page_metadata', requested_page: 1, returned_page: 1, total: 2, per_page: 100, received_rows: 1, expected_rows: 2 })
    assert.doesNotMatch(JSON.stringify(error.details), /998900000001|phone|customer|token|address/)
    return true
  })
})
