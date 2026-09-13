/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

// Execute the real bootstrap in a fresh VM. URLs, credentials and storage are synthetic.
const sourcePath = path.resolve(__dirname, '../../src/bootstrap/loginLink.ts')
const json = value => JSON.parse(JSON.stringify(value))
const fixtureEmail = 'fixture+operator@example.test'
const fixturePassword = 'synthetic-password-only'
const expectedLink = { email: fixtureEmail, password: fixturePassword, invalid: false }
const fields = () => new URLSearchParams({ email: fixtureEmail, password: fixturePassword }).toString()

function setup(href) {
  const changes = []
  const storageWrites = []
  const reloads = []
  const listeners = []
  const state = { position: 4, fixture: true }
  const location = href === undefined ? undefined : new URL(href)
  if (location)
    location.reload = () => reloads.push(location.href)

  const storage = kind => ({
    getItem: () => null,
    setItem: (key, value) => storageWrites.push({ kind, key, value }),
    removeItem: () => undefined,
    clear: () => undefined,
  })

  const localStorage = storage('local')
  const sessionStorage = storage('session')

  const window = location && {
    location,
    localStorage,
    sessionStorage,
    addEventListener: (type, listener, capture) => listeners.push({ type, listener, capture }),
    history: {
      state,
      replaceState: (nextState, title, destination) => {
        changes.push({ state: nextState, title, destination })
        location.href = new URL(destination, location.href).href
      },
    },
  }

  const context = vm.createContext({
    exports: {},
    URL,
    URLSearchParams,
    localStorage,
    sessionStorage,
    ...(window ? { window } : {}),
    require: dependency => assert.fail(`Bootstrap must remain dependency-free; attempted import: ${dependency}`),
  })

  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText

  vm.runInContext(compiled, context, { filename: sourcePath })
  function dispatch(type) {
    let stopped = false

    for (const entry of listeners.filter(listener => listener.type === type)) {
      if (!stopped)
        entry.listener({ stopImmediatePropagation: () => { stopped = true } })
    }
    return { stopped }
  }

  return { ...context.exports, changes, storageWrites, state, location, listeners, reloads, dispatch }
}

function assertCleaned(service) {
  assert.equal(service.location.href, 'https://app-fixture.invalid/login')
  assert.equal(service.changes.length, 1)
  assert.equal(service.changes[0].state, service.state)
  assert.equal(service.changes[0].title, '')
  assert.equal(service.changes[0].destination, '/login')
  assert.deepEqual(service.storageWrites, [])
}

test('query credentials are captured and the entire URL is cleaned synchronously on import', () => {
  const service = setup(`https://app-fixture.invalid/login?${fields()}&to=%2Forders&source=fixture#private-fragment`)

  assertCleaned(service)
  assert.equal(service.hasLoginLink(), true)
  assert.deepEqual(json(service.takeLoginLink()), expectedLink)
})

test('fragment credentials and optional leading question mark are supported', () => {
  for (const prefix of ['#', '#?']) {
    const service = setup(`https://app-fixture.invalid/login?to=%2Forders${prefix}${fields()}`)

    assertCleaned(service)
    assert.deepEqual(json(service.takeLoginLink()), expectedLink)
  }
})

test('legacy email-question-mark-password links remain compatible', () => {
  for (const prefix of ['?', '#', '#?']) {
    const service = setup(`https://app-fixture.invalid/login${prefix}email=${encodeURIComponent(fixtureEmail)}?password=${encodeURIComponent(fixturePassword)}`)

    assertCleaned(service)
    assert.deepEqual(json(service.takeLoginLink()), expectedLink)
  }
})

test('encoded passwords retain reserved characters, Unicode and surrounding spaces exactly', () => {
  const password = ' synthetic + & ? = # % / \\ " \' пароль 🔐 '
  const email = 'Fixture+case@example.test'
  const encoded = new URLSearchParams({ email: ` ${email} `, password }).toString()

  for (const suffix of [`?${encoded}`, `#${encoded}`, `?email=${encodeURIComponent(email)}?password=${encodeURIComponent(password)}`]) {
    const service = setup(`https://app-fixture.invalid/login${suffix}`)

    assertCleaned(service)
    assert.deepEqual(json(service.takeLoginLink()), { email, password, invalid: false })
  }
})

test('email-only and empty-password links clean the URL and support prefill without a password', () => {
  for (const suffix of [
    `?email=${encodeURIComponent(fixtureEmail)}`,
    `?email=${encodeURIComponent(fixtureEmail)}&password=`,
    `#email=${encodeURIComponent(fixtureEmail)}`,
    `#email=${encodeURIComponent(fixtureEmail)}&password=`,
  ]) {
    const service = setup(`https://app-fixture.invalid/login${suffix}`)

    assertCleaned(service)
    assert.deepEqual(json(service.takeLoginLink()), { email: fixtureEmail, password: '', invalid: false })
  }
})

test('missing or malformed email links are cleaned and do not retain either credential', () => {
  for (const suffix of [
    `?password=${fixturePassword}`,
    `#password=${fixturePassword}`,
    `?email=&password=${fixturePassword}`,
    `?email=not-an-email&password=${fixturePassword}`,
    `?email=fixture%20name%40example.test&password=${fixturePassword}`,
    `?email=fixture%3Fname%40example.test&password=${fixturePassword}`,
    `?email=fixture%40example%40test&password=${fixturePassword}`,
    `?email=${'x'.repeat(255)}%40example.test&password=${fixturePassword}`,
  ]) {
    const service = setup(`https://app-fixture.invalid/login${suffix}`)

    assertCleaned(service)
    assert.equal(service.hasLoginLink(), true)
    assert.deepEqual(json(service.takeLoginLink()), { email: '', password: '', invalid: true })
  }
})

test('duplicate credential keys are rejected even if the repeated values agree', () => {
  for (const prefix of ['?', '#']) {
    for (const repeated of [`email=${encodeURIComponent(fixtureEmail)}`, `password=${fixturePassword}`, 'email=', 'password=']) {
      const service = setup(`https://app-fixture.invalid/login${prefix}${fields()}&${repeated}`)

      assertCleaned(service)
      assert.deepEqual(json(service.takeLoginLink()), { email: '', password: '', invalid: true })
    }
  }
})

test('mixed query and fragment credential fields are rejected and both locations are stripped', () => {
  for (const suffix of [
    `?${fields()}#${fields()}`,
    `?email=${encodeURIComponent(fixtureEmail)}#password=${fixturePassword}`,
    `?password=${fixturePassword}#email=${encodeURIComponent(fixtureEmail)}`,
    `?${fields()}#email=`,
  ]) {
    const service = setup(`https://app-fixture.invalid/login${suffix}`)

    assertCleaned(service)
    assert.deepEqual(json(service.takeLoginLink()), { email: '', password: '', invalid: true })
  }
})

test('oversized or control-character passwords are cleaned and discarded', () => {
  for (const password of ['x'.repeat(1025), 'fixture\u0000password', 'fixture\rpassword', 'fixture\npassword']) {
    const params = new URLSearchParams({ email: fixtureEmail, password })
    const service = setup(`https://app-fixture.invalid/login?${params}`)

    assertCleaned(service)
    assert.deepEqual(json(service.takeLoginLink()), { email: '', password: '', invalid: true })
  }
})

test('taking a link is one-shot while active remains true until login finishes', () => {
  const service = setup(`https://app-fixture.invalid/login?${fields()}`)

  assert.equal(service.hasLoginLink(), true)
  assert.deepEqual(json(service.takeLoginLink()), expectedLink)
  assert.equal(service.takeLoginLink(), null)
  assert.equal(service.hasLoginLink(), true)
  service.finishLoginLink()
  assert.equal(service.hasLoginLink(), false)
  assert.equal(service.takeLoginLink(), null)
  service.finishLoginLink()
  assert.equal(service.hasLoginLink(), false)
  assertCleaned(service)
})

test('finishing before consumption discards the pending credentials permanently', () => {
  const service = setup(`https://app-fixture.invalid/login#${fields()}`)

  service.finishLoginLink()
  assert.equal(service.hasLoginLink(), false)
  assert.equal(service.takeLoginLink(), null)
  assertCleaned(service)
})

test('normal and non-login URLs are ignored without navigation or storage writes', () => {
  for (const suffix of [
    '/login',
    '/login?to=%2Forders#heading',
    '/login?emailAddress=fixture&passcode=fixture',
    `/?${fields()}`,
    `/orders?${fields()}`,
    `/login/extra?${fields()}`,
  ]) {
    const href = `https://app-fixture.invalid${suffix}`
    const service = setup(href)

    assert.equal(service.hasLoginLink(), false)
    assert.equal(service.takeLoginLink(), null)
    assert.equal(service.location.href, href)
    assert.deepEqual(service.changes, [])
    assert.deepEqual(service.storageWrites, [])
  }
})

test('a trailing login slash is supported and normalizes to the clean login route', () => {
  const service = setup(`https://app-fixture.invalid/login/?${fields()}`)

  assertCleaned(service)
  assert.deepEqual(json(service.takeLoginLink()), expectedLink)
})

test('case-insensitive login paths match the real router and scrub credentials into the canonical route', () => {
  for (const route of ['/LOGIN', '/Login', '/lOgIn/']) {
    for (const prefix of ['?', '#']) {
      const service = setup(`https://app-fixture.invalid${route}${prefix}${fields()}`)

      assertCleaned(service)
      assert.deepEqual(json(service.takeLoginLink()), expectedLink)
      assert.deepEqual(service.reloads, [])
    }
  }
})

test('repeated native credential fragments reload once before later navigation listeners can observe them', () => {
  const first = setup(`https://app-fixture.invalid/login#${fields()}`)

  assertCleaned(first)
  first.takeLoginLink()
  first.finishLoginLink()
  assert.deepEqual(first.listeners.map(({ type, capture }) => ({ type, capture })), [
    { type: 'popstate', capture: true }, { type: 'hashchange', capture: true },
  ])

  const nextLink = { email: 'next+fixture@example.test', password: 'next-synthetic-password', invalid: false }
  const nextFields = new URLSearchParams({ email: nextLink.email, password: nextLink.password })
  const nextUrl = `https://app-fixture.invalid/login#${nextFields}`

  first.location.href = nextUrl
  assert.equal(first.dispatch('popstate').stopped, true)
  assert.equal(first.dispatch('hashchange').stopped, true)
  assert.equal(first.dispatch('hashchange').stopped, true)
  assert.deepEqual(first.reloads, [nextUrl])
  assert.equal(first.location.href, nextUrl)
  assert.deepEqual(first.storageWrites, [])
  assert.equal(first.takeLoginLink(), null)

  // A new document receives the fragment, captures it once and cleans the URL.
  const reloaded = setup(first.reloads[0])

  assertCleaned(reloaded)
  assert.deepEqual(json(reloaded.takeLoginLink()), nextLink)
  assert.deepEqual(reloaded.reloads, [])
})

test('hashchange-only native links and invalid credential links also receive a clean fresh document', () => {
  for (const fragment of [`${fields()}`, 'email=not-an-email&password=synthetic']) {
    const service = setup('https://app-fixture.invalid/login')

    service.location.href = `https://app-fixture.invalid/Login#${fragment}`
    assert.equal(service.dispatch('hashchange').stopped, true)
    assert.equal(service.reloads.length, 1)

    const reloaded = setup(service.reloads[0])

    assertCleaned(reloaded)
    assert.equal(reloaded.hasLoginLink(), true)
    assert.deepEqual(reloaded.reloads, [])
  }
})

test('ordinary hashes and unrelated history navigation are not intercepted or reloaded', () => {
  const service = setup('https://app-fixture.invalid/login')

  for (const destination of ['/login#help', '/login?to=%2Forders', '/orders#details', '/orders#password=synthetic']) {
    service.location.href = `https://app-fixture.invalid${destination}`
    assert.equal(service.dispatch('popstate').stopped, false)
    assert.equal(service.dispatch('hashchange').stopped, false)
  }
  assert.deepEqual(service.reloads, [])
  assert.deepEqual(service.changes, [])
  assert.deepEqual(service.storageWrites, [])
})

test('pure parsing works without a browser and never activates or persists a pending link', () => {
  const service = setup()

  assert.equal(service.hasLoginLink(), false)
  assert.deepEqual(json(service.parseLoginLink(`/login?${fields()}`)), expectedLink)
  assert.equal(service.hasLoginLink(), false)
  assert.equal(service.takeLoginLink(), null)
  assert.deepEqual(service.changes, [])
  assert.deepEqual(service.storageWrites, [])
})

test('a reload after URL cleanup cannot recover the previously captured password', () => {
  const first = setup(`https://app-fixture.invalid/login?${fields()}`)
  const reloaded = setup(first.location.href)

  assertCleaned(first)
  assert.equal(reloaded.hasLoginLink(), false)
  assert.equal(reloaded.takeLoginLink(), null)
  assert.deepEqual(reloaded.storageWrites, [])
})
