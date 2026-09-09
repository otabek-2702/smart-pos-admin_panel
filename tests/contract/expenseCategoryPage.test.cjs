/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { parse } = require('@vue/compiler-sfc')
const { computed, ref } = require('vue')
const ts = require('typescript')

// Actual page and API helper, real Vue refs, mocked transport only: no auth or network.
const root = path.resolve(__dirname, '../..')
const filename = path.join(root, 'src/pages/expense-categories/index.vue')
const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename })

assert.deepEqual(errors, [])

const exposed = [
  'form',
  'formOpen',
  'formError',
  'errors',
  'saving',
  'editing',
  'items',
  'total',
  'loading',
  'loadError',
  'page',
  'search',
  'includeInactive',
  'canView',
  'canManage',
  'openCreate',
  'openEdit',
  'closeForm',
  'toggleSource',
  'validate',
  'submit',
  'load',
  'askDeactivate',
  'closeConfirm',
  'doDeactivate',
  'confirmOpen',
  'confirmRow',
  'deactivating',
  'deactivateError',
  'columns',
  'emptyTitle',
  'emptySubtitle',
]

const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText

const compiledPage = compile(`${descriptor.scriptSetup.content}\nexport { ${exposed.join(', ')} }`)
const compiledApi = compile(fs.readFileSync(path.join(root, 'src/services/expenseControlApi.ts'), 'utf8'))
const json = value => JSON.parse(JSON.stringify(value))

function category(id = 12, overrides = {}) {
  return {
    id,
    code: 'UTILITIES',
    name: 'Utilities',
    description: '',
    budget_limit: null,
    reporting_group: 'UTILITIES',
    is_active: true,
    sort_order: 0,
    allowed_sources: ['SAFE', 'BANK'],
    requires_receipt: false,
    requires_description: false,
    expense_count: 0,
    ...overrides,
  }
}

function response(categories = []) {
  return { data: { data: { categories, pagination: { total: categories.length } } } }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject })

  return { promise, resolve, reject }
}

function loadPage({ permissions = ['expense.category.view', 'expense.category.manage'], transport = {} } = {}) {
  const requests = []
  const notifications = []
  const mounted = []
  const unmounted = []
  const permissionState = ref(permissions)
  const locale = ref('en')

  const axios = Object.fromEntries(['get', 'post', 'patch'].map(method => [method, async (url, payload) => {
    requests.push({ method, url, payload: payload === undefined ? undefined : json(payload) })
    if (transport[method])
      return transport[method](url, payload)
    if (method === 'get')
      return response()
    return { data: { data: { category: category() } } }
  }]))

  const apiContext = vm.createContext({
    exports: {},
    require: request => {
      assert.equal(request, '@/plugins/axios')
      return { default: axios }
    },
  })

  vm.runInContext(compiledApi, apiContext)

  const dependencies = {
    '@/services/expenseControlApi': apiContext.exports,
    '@/composables/useUserAccess': {
      useUserAccess: () => ({ hasPermission: permission => permissionState.value.includes(permission) }),
    },
  }

  const context = vm.createContext({
    exports: {},
    ref,
    computed,
    watch: () => undefined,
    onMounted: callback => mounted.push(callback),
    onBeforeUnmount: callback => unmounted.push(callback),
    useDebounceFn: callback => callback,
    useI18n: () => ({ t: key => `${locale.value}:${key}` }),
    useFormatters: () => ({ formatCurrency: String }),
    useNotify: () => ({ notify: (...args) => notifications.push(args) }),
    require: request => {
      if (request.startsWith('@/components/design/'))
        return {}
      assert.ok(Object.hasOwn(dependencies, request), `Unexpected dependency: ${request}`)
      return dependencies[request]
    },
  })

  vm.runInContext(compiledPage, context, { filename })
  return {
    ...context.exports,
    requests,
    notifications,
    permissionState,
    locale,
    mount: () => Promise.all(mounted.map(callback => callback())),
    unmount: () => unmounted.forEach(callback => callback()),
  }
}

function ready(page) {
  page.openCreate()
  page.form.value.name = '  Utilities  '
}

test('new categories default to SAFE and BANK and submit exact numeric payload', async () => {
  const page = loadPage()

  ready(page)
  assert.deepEqual(json(page.form.value.allowed_sources), ['SAFE', 'BANK'])
  page.form.value.budget_limit = 100000
  page.form.value.sort_order = '2'
  page.form.value.code = ' utilities '
  page.form.value.description = '  Monthly expenses  '
  await page.submit()
  assert.deepEqual(page.requests[0], {
    method: 'post',
    url: '/expense-categories',
    payload: {
      name: 'Utilities',
      description: 'Monthly expenses',
      budget_limit: 100000,
      reporting_group: 'REVIEW',
      is_active: true,
      sort_order: 2,
      allowed_sources: ['SAFE', 'BANK'],
      requires_receipt: false,
      requires_description: false,
      code: 'UTILITIES',
    },
  })
  assert.equal(page.formOpen.value, false)
  assert.equal(page.saving.value, false)
})

test('editing preserves existing sources and omits the immutable code from PATCH', async () => {
  const page = loadPage()
  const existing = category(17, { allowed_sources: ['DRAWER'], budget_limit: '200000' })

  page.openEdit(existing)
  assert.deepEqual(json(page.form.value.allowed_sources), ['DRAWER'])
  assert.notEqual(page.form.value.allowed_sources, existing.allowed_sources)
  assert.equal(page.form.value.budget_limit, 200000)
  await page.submit()
  assert.equal(page.requests[0].method, 'patch')
  assert.equal(page.requests[0].url, '/expense-categories/17')
  assert.deepEqual(page.requests[0].payload.allowed_sources, ['DRAWER'])
  assert.equal(Object.hasOwn(page.requests[0].payload, 'code'), false)
})

test('DRAWER can be enabled explicitly without changing SAFE/BANK defaults', () => {
  const page = loadPage()

  ready(page)
  page.toggleSource('DRAWER', true)
  page.toggleSource('DRAWER', true)
  assert.deepEqual(json(page.form.value.allowed_sources), ['SAFE', 'BANK', 'DRAWER'])
  page.toggleSource('SAFE', false)
  assert.deepEqual(json(page.form.value.allowed_sources), ['BANK', 'DRAWER'])
})

test('invalid empty/unknown sources and fractional/negative budgets never POST', async () => {
  const cases = [
    { allowed_sources: [] },
    { allowed_sources: ['CARD'] },
    { budget_limit: 1.25 },
    { budget_limit: -1 },
    { budget_limit: '100 000' },
    { sort_order: '1.2' },
    { sort_order: '-1' },
    { name: '  ' },
    { code: '1BAD' },
  ]

  for (const invalid of cases) {
    const page = loadPage()

    ready(page)
    Object.assign(page.form.value, invalid)
    await page.submit()
    assert.equal(page.requests.length, 0)
    assert.ok(Object.keys(page.errors.value).length > 0)
    assert.equal(page.formOpen.value, true)
  }
})

test('double-submit, close, source change and alternate dialogs are guarded while saving', async () => {
  const pending = deferred()
  const page = loadPage({ transport: { post: () => pending.promise } })

  ready(page)

  const first = page.submit()

  await page.submit()
  page.closeForm()
  page.toggleSource('DRAWER', true)
  page.openCreate()
  page.openEdit(category())
  page.askDeactivate(category())
  assert.equal(page.requests.length, 1)
  assert.equal(page.formOpen.value, true)
  assert.equal(page.confirmOpen.value, false)
  assert.deepEqual(json(page.form.value.allowed_sources), ['SAFE', 'BANK'])
  pending.resolve({ data: { data: { category: category() } } })
  await first
  await page.submit()
  assert.equal(page.requests.filter(request => request.method === 'post').length, 1)
})

test('save errors remain visible and retain entered values for a deliberate retry', async () => {
  let attempts = 0

  const page = loadPage({
    transport: {
      post: async () => {
        attempts += 1
        if (attempts === 1)
          throw Object.assign(new Error('Category already exists.'), { response: { data: { errors: { name: ['Category already exists.'] } } } })
        return { data: { data: { category: category() } } }
      },
    },
  })

  ready(page)
  await page.submit()
  assert.equal(page.formError.value, 'Category already exists.')
  assert.equal(page.form.value.name, '  Utilities  ')
  assert.equal(page.formOpen.value, true)
  assert.equal(page.saving.value, false)
  page.form.value.allowed_sources = []
  await page.submit()
  assert.equal(page.formError.value, 'Category already exists.')
  assert.equal(attempts, 1)
  page.form.value.allowed_sources = ['SAFE']
  await page.submit()
  assert.equal(page.formError.value, '')
  assert.equal(page.formOpen.value, false)
  assert.equal(attempts, 2)
})

test('view-only users can list but cannot open or invoke category mutations', async () => {
  const page = loadPage({ permissions: ['expense.category.view'] })

  await page.mount()
  page.openCreate()
  page.openEdit(category())
  page.askDeactivate(category())
  assert.equal(page.formOpen.value, false)
  assert.equal(page.confirmOpen.value, false)
  page.formOpen.value = true
  page.form.value.name = 'Blocked'
  page.confirmOpen.value = true
  page.confirmRow.value = category()
  await page.submit()
  await page.doDeactivate()
  assert.deepEqual(page.requests.map(request => request.method), ['get'])
})

test('manage permission does not invent view permission or issue a denied GET', async () => {
  const page = loadPage({ permissions: ['expense.category.manage'] })

  await page.mount()
  assert.equal(page.canView.value, false)
  assert.equal(page.requests.length, 0)
  ready(page)
  await page.submit()
  assert.deepEqual(page.requests.map(request => request.method), ['post'])
})

test('permission loss before save blocks both write actions', async () => {
  const page = loadPage()

  ready(page)
  page.askDeactivate(category())
  page.permissionState.value = ['expense.category.view']
  await page.submit()
  await page.doDeactivate()
  assert.equal(page.requests.length, 0)
})

test('deactivate guards duplicates and closed dialogs, keeping server errors visible', async () => {
  const pending = deferred()
  const page = loadPage({ transport: { post: () => pending.promise } })

  page.askDeactivate(category(19))

  const first = page.doDeactivate()

  await page.doDeactivate()
  page.closeConfirm()
  assert.equal(page.confirmOpen.value, true)
  assert.equal(page.requests.length, 1)
  assert.equal(page.requests[0].url, '/expense-categories/19/deactivate')
  pending.reject({ response: { data: { message: 'Cannot deactivate now.' } } })
  await first
  assert.equal(page.deactivateError.value, 'Cannot deactivate now.')
  assert.equal(page.confirmOpen.value, true)
  assert.equal(page.deactivating.value, false)
  page.closeConfirm()
  await page.doDeactivate()
  assert.equal(page.requests.length, 1)
})

test('latest list request wins and stale errors cannot replace newer results', async () => {
  const first = deferred()
  const second = deferred()
  let calls = 0
  const page = loadPage({ transport: { get: () => (++calls === 1 ? first.promise : second.promise) } })
  const oldLoad = page.load()

  page.search.value = 'Utilities'

  const newLoad = page.load()

  second.resolve(response([category(23)]))
  await newLoad
  first.reject({ response: { data: { message: 'Old request failed' } } })
  await oldLoad
  assert.equal(page.items.value[0].id, 23)
  assert.equal(page.total.value, 1)
  assert.equal(page.loadError.value, '')
  assert.equal(page.loading.value, false)
})

test('unmount and view permission loss invalidate pending category reads', async () => {
  for (const event of ['unmount', 'permission-loss']) {
    const pending = deferred()
    const page = loadPage({ transport: { get: () => pending.promise } })
    const loading = page.load()

    if (event === 'unmount') {
      page.unmount()
    }
    else {
      page.permissionState.value = []
      await page.load()
    }
    pending.resolve(response([category()]))
    await loading
    assert.equal(page.items.value.length, 0)
  }
})

test('table labels react to locale changes', () => {
  const page = loadPage()

  assert.equal(page.columns.value[0].label, 'en:Code')
  page.locale.value = 'uz'
  assert.equal(page.columns.value[0].label, 'uz:Code')
})

test('empty search results have different copy from an empty category catalogue', () => {
  const page = loadPage()

  assert.equal(page.emptyTitle.value, 'en:expcat_empty_title')
  assert.equal(page.emptySubtitle.value, 'en:expcat_empty_subtitle')
  page.search.value = '   '
  assert.equal(page.emptyTitle.value, 'en:expcat_empty_title')
  page.search.value = '  Missing category  '
  assert.equal(page.emptyTitle.value, 'en:No matching categories')
  assert.equal(page.emptySubtitle.value, 'en:expcat_empty_search_hint')
  page.locale.value = 'uz'
  assert.equal(page.emptyTitle.value, 'uz:No matching categories')
  assert.equal(page.emptySubtitle.value, 'uz:expcat_empty_search_hint')
  page.search.value = ''
  assert.equal(page.emptyTitle.value, 'uz:expcat_empty_title')
})

test('list failures suppress the empty table and clear on a successful retry', async () => {
  let calls = 0

  const page = loadPage({
    transport: {
      get: async () => {
        calls += 1
        if (calls === 1)
          throw Object.assign(new Error('Unavailable'), { response: { data: { message: 'Categories unavailable.' } } })
        return response()
      },
    },
  })

  await page.load()
  assert.equal(page.loadError.value, 'Categories unavailable.')
  assert.equal(page.loading.value, false)
  assert.equal(page.items.value.length, 0)
  assert.match(descriptor.template.content, /<DataTable\s+[^>]*v-if="!loadError"/)
  assert.match(descriptor.template.content, /:empty-title="emptyTitle"/)
  assert.match(descriptor.template.content, /:empty-sub="emptySubtitle"/)
  await page.load()
  assert.equal(page.loadError.value, '')
  assert.equal(page.items.value.length, 0)
  assert.equal(page.emptyTitle.value, 'en:expcat_empty_title')
})

test('old HR route redirects to canonical editor with query and hash preserved', () => {
  const legacyFilename = path.join(root, 'src/pages/hr-expense-categories/index.vue')
  const legacy = parse(fs.readFileSync(legacyFilename, 'utf8'), { filename: legacyFilename }).descriptor
  const redirects = []
  const query = { source: 'SAFE' }

  const context = vm.createContext({
    exports: {},
    useRoute: () => ({ query, hash: '#categories' }),
    useRouter: () => ({ replace: target => redirects.push(json(target)) }),
  })

  vm.runInContext(compile(legacy.scriptSetup.content), context)
  assert.deepEqual(redirects, [{ name: 'expense-categories', query, hash: '#categories' }])
  assert.match(legacy.customBlocks[0].content, /action: manage[\s\S]*subject: all/)
  assert.match(legacy.customBlocks[0].content, /anyPermission:[\s\S]*expense.category.view[\s\S]*expense.category.manage/)
  assert.match(descriptor.customBlocks[0].content, /name: expense-categories/)
})

test('canonical categories page is permission-gated and discoverable outside HR', () => {
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')

  assert.match(read('src/navigation/access.ts'), /prefix: '\/expense-categories', anyPermission: EXPENSE_CATEGORY_PERMISSIONS/)
  assert.match(read('src/navigation/vertical/management.ts'), /to: 'expense-categories',[\s\S]*?anyPermission: EXPENSE_CATEGORY_PERMISSIONS/)
  assert.match(read('src/layouts/components/DesignSidebar.vue'), /to: '\/expense-categories', anyPermission: EXPENSE_CATEGORY_PERMISSIONS/)
  assert.doesNotMatch(read('src/navigation/vertical/hr.ts'), /to: 'hr-expense-categories'/)
})
