/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { parse } = require('@vue/compiler-sfc')
const { computed, ref } = require('vue')
const ts = require('typescript')

// Exercise the real shared modal logic without a browser or backend. These
// checks complement visual tests of the full-screen supplier invoice editor.
const root = path.resolve(__dirname, '../..')
const filename = path.join(root, 'src/components/design/Modal.vue')
const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename })

assert.deepEqual(errors, [])
assert.ok(descriptor.scriptSetup)

const compiledModal = ts.transpileModule(`${descriptor.scriptSetup.content}\nexport { maxWidthStyle, onKey, onBackdropDown, modalRef }`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText

function loadModal(overrides = {}) {
  const events = []
  const document = { activeElement: null }

  const context = vm.createContext({
    exports: {},
    ref,
    computed,
    document,
    defineProps: () => ({ open: true, ...overrides }),
    withDefaults: (props, defaults) => ({ ...defaults, ...props }),
    defineEmits: () => (...event) => events.push(event),
    useI18n: () => ({ t: key => key }),
    watch: () => undefined,
    onMounted: () => undefined,
    onBeforeUnmount: () => undefined,
    require: request => {
      if (request === './IconAction.vue')
        return {}
      assert.equal(request, './ids')
      return { designId: prefix => `${prefix}-test` }
    },
  })

  vm.runInContext(compiledModal, context, { filename })
  return { ...context.exports, events, document }
}

function keyEvent(key, overrides = {}) {
  return {
    key,
    defaultPrevented: false,
    shiftKey: false,
    preventDefault() { this.defaultPrevented = true },
    ...overrides,
  }
}

test('regular modals retain their default, numeric and string width contracts', () => {
  assert.equal(loadModal().maxWidthStyle.value, undefined)
  assert.equal(loadModal({ width: 680 }).maxWidthStyle.value.maxWidth, '680px')
  assert.equal(loadModal({ width: '75vw' }).maxWidthStyle.value.maxWidth, '75vw')
  assert.equal(loadModal({ fullscreen: false, width: 520 }).maxWidthStyle.value.maxWidth, '520px')
})

test('full-screen mode takes priority over any regular dialog width', () => {
  for (const width of [undefined, 1120, '75vw']) {
    const modal = loadModal({ fullscreen: true, width })

    assert.equal(modal.maxWidthStyle.value, undefined)
  }
})

test('Escape handled by an open select does not also close its parent modal', () => {
  const modal = loadModal()

  modal.onKey(keyEvent('Escape', { defaultPrevented: true }))
  assert.deepEqual(modal.events, [])
})

test('unhandled Escape closes an enabled open modal with both existing events', () => {
  const modal = loadModal()

  modal.onKey(keyEvent('Escape'))
  assert.deepEqual(modal.events, [['close'], ['update:open', false]])
})

test('closed and Escape-disabled modals do not react to Escape', () => {
  for (const props of [{ open: false }, { closeOnEsc: false }]) {
    const modal = loadModal(props)

    modal.onKey(keyEvent('Escape'))
    assert.deepEqual(modal.events, [])
  }
})

test('backdrop clicks retain existing opt-out and inside-click behavior', () => {
  const target = {}
  const ignored = loadModal({ closeOnBackdrop: false })

  ignored.onBackdropDown({ target, currentTarget: target })
  assert.deepEqual(ignored.events, [])

  const enabled = loadModal()

  enabled.onBackdropDown({ target: {}, currentTarget: target })
  assert.deepEqual(enabled.events, [])
  enabled.onBackdropDown({ target, currentTarget: target })
  assert.deepEqual(enabled.events, [['close'], ['update:open', false]])
})

test('full-screen modals retain forward and reverse keyboard focus wrapping', () => {
  const modal = loadModal({ fullscreen: true })

  const makeItem = () => ({
    tagName: 'BUTTON',
    offsetParent: {},
    focus() { modal.document.activeElement = this },
  })

  const first = makeItem()
  const last = makeItem()

  modal.modalRef.value = {
    querySelectorAll: () => [first, last],
    contains: item => item === first || item === last,
  }
  modal.document.activeElement = last

  const forward = keyEvent('Tab')

  modal.onKey(forward)
  assert.equal(forward.defaultPrevented, true)
  assert.equal(modal.document.activeElement, first)

  const reverse = keyEvent('Tab', { shiftKey: true })

  modal.onKey(reverse)
  assert.equal(reverse.defaultPrevented, true)
  assert.equal(modal.document.activeElement, last)
  assert.deepEqual(modal.events, [])
})
