/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')
const FROM = '2026-08-01T00:00:00+05:00'
const END = '2026-08-03T06:00:00+05:00'
const json = value => JSON.parse(JSON.stringify(value))

const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText

const engineContext = vm.createContext({ exports: {} })

vm.runInContext(compile('src/utils/customerRetention.ts'), engineContext)

const compiled = compile('src/services/customerRetentionSnapshot.ts')
const order = (id, created_at) => ({ id, created_at, status: 'COMPLETED', order_type: 'HALL', is_paid: true, total_amount: '100000.10', phone_number: '+998900000001' })

function setup(orders, intercept) {
  const calls = []

  const dependencies = {
    '@/utils/customerRetention': engineContext.exports,
    '@/composables/useUserAccess': { readUserAccess: () => ({ userId: 1, role: 'ADMIN', has: () => true }) },
    '@/plugins/axios': {
      getCurrentApiHost: () => 'https://retention-fixture.invalid',
      default: {
        get: async (_, { params }) => {
          calls.push(json(params))

          const matching = orders.filter(row => Date.parse(row.created_at) >= Date.parse(params.datetime_from) && Date.parse(row.created_at) < Date.parse(params.datetime_to))
          const pages = Math.max(1, Math.ceil(matching.length / 100))

          const body = {
            success: true,
            data: {
              orders: json(matching.slice((params.page - 1) * 100, params.page * 100)),
              filters: { start_at: params.datetime_from, end_at: params.datetime_to },
              pagination: { total_orders: matching.length, total_pages: pages, per_page: 100, current_page: params.page, has_next: params.page < pages, has_previous: params.page > 1 },
            },
          }

          if (intercept)
            intercept(body, calls.length, params)
          return { data: body }
        },
      },
    },
  }

  const context = vm.createContext({
    exports: {},
    URL,
    Blob,
    require: request => {
      assert.ok(Object.hasOwn(dependencies, request), `Unexpected dependency: ${request}`)
      return dependencies[request]
    },
  })

  vm.runInContext(compiled, context)
  return { ...context.exports, calls }
}

const collect = (service, options = {}) => service.collectRetentionSnapshot({ fromAt: FROM, toAt: END, ...options })

test('daily partitions cover empty days and a partial final day without losing cross-day IDs', async () => {
  const service = setup([order(90, '2026-08-01T12:00:00+05:00'), order(2, '2026-08-03T00:00:00+05:00'), order(3, END)])
  const progress = []
  const result = await collect(service, { onProgress: value => progress.push(json(value)) })

  assert.deepEqual(result.orders.map(row => row.id).join(','), '90,2')
  assert.equal(result.record_count, 2)
  assert.equal(result.total_pages, 3)
  assert.deepEqual(json(result.collection_windows.map(part => part.record_count)), [1, 0, 1])
  assert.equal(result.to_at, END)
  assert.equal(service.calls.length, 6)
  for (let index = 0; index < result.collection_windows.length; index += 1) {
    const part = result.collection_windows[index]

    assert.equal(Date.parse(part.from_at), index ? Date.parse(result.collection_windows[index - 1].to_at) : Date.parse(FROM))
    assert.ok(Date.parse(part.to_at) - Date.parse(part.from_at) <= 86400000)
  }
  assert.equal(Date.parse(result.collection_windows.at(-1).to_at), Date.parse(END))
  assert.equal(progress.at(-1).completed_windows, 3)
  assert.equal(progress.at(-1).verified_orders, 2)
})

test('only a changed day retries; previously verified days are not recollected or duplicated', async () => {
  const service = setup([order(90, FROM), order(2, '2026-08-02T00:00:00+05:00')], (body, call) => {
    if (call === 4)
      body.data.orders[0].total_amount = '1.00'
  })

  const result = await collect(service, { toAt: '2026-08-03T00:00:00+05:00' })

  assert.equal(result.record_count, 2)
  assert.equal(service.calls.length, 6)
  assert.equal(service.calls.filter(call => Date.parse(call.datetime_from) === Date.parse(FROM)).length, 2)
  assert.equal(result.collection_windows.length, 2)
})

test('persistent daily changes and pagination failures stop after three attempts', async () => {
  for (const pagination of [false, true]) {
    const service = setup([order(1, FROM)], (body, call) => {
      if (pagination)
        body.data.pagination.total_orders = 2
      else
        body.data.orders[0].total_amount = call % 2 ? '1.00' : '2.00'
    })

    await assert.rejects(collect(service, { toAt: '2026-08-02T00:00:00+05:00' }), /cr_error_(changed|pagination)/)
    assert.equal(service.calls.length, pagination ? 3 : 6)
  }
})

test('a repeated ID in different date partitions prevents a complete snapshot', async () => {
  const service = setup([order(7, FROM), order(7, '2026-08-02T00:00:00+05:00')])

  await assert.rejects(collect(service), /cr_error_changed/)
  assert.equal(service.calls.length, 4)
})

test('partition provenance round-trips but gaps, missing windows, counts and page mismatches fail', async () => {
  const service = setup([order(90, FROM), order(2, '2026-08-03T00:00:00+05:00')])
  const result = await collect(service)
  const imported = service.parseRetentionSnapshot(JSON.stringify(result))

  assert.deepEqual(json(imported), json(result))

  const corruptions = [
    value => { value.collection_windows[1].from_at = FROM },
    value => { value.collection_windows.pop() },
    value => { value.collection_windows[0].record_count = 2 },
    value => { value.collection_windows[0].total_pages = 2 },
    value => { value.total_pages = 2 },
  ]

  for (const corrupt of corruptions) {
    const value = json(result)

    corrupt(value)
    assert.throws(() => service.parseRetentionSnapshot(JSON.stringify(value)), /cr_error_invalid_snapshot/)
  }
})

test('canceling after a verified day does not request the next day or return partial records', async () => {
  const service = setup([order(90, FROM)])
  const controller = new AbortController()

  await assert.rejects(collect(service, {
    signal: controller.signal,
    onProgress: value => {
      if (value.completed_windows === 1)
        controller.abort()
    },
  }), /cr_error_canceled/)
  assert.equal(service.calls.length, 2)
})
