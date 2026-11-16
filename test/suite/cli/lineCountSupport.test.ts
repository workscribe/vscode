import * as assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LineCountSupport, lineCountArgs, listsLineCountFlags } from '../../../src/cli/lineCountSupport'
import { SUPPORT_RETRY_MS } from '../../../src/constants'

// The compiled tests run from out/test/suite/cli
const FIXTURES = join(__dirname, '..', '..', '..', '..', 'test', 'fixtures')
const helpOf = (name: string) => readFileSync(join(FIXTURES, name), 'utf8')

const BINARY = '/usr/local/bin/workscribe'
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

suite('listsLineCountFlags', () => {
  test('finds both flags in the help of CLI 3.3.0', () => {
    assert.strictEqual(listsLineCountFlags(helpOf('help_33.txt')), true)
  })

  test('finds neither in the help of CLI 3.2.0', () => {
    assert.strictEqual(listsLineCountFlags(helpOf('help_32.txt')), false)
  })

  test('does not take a longer flag that only contains the name', () => {
    const help = '  --skip-lines-added-check  x\n  --lines-added-total <n>  y\n  --no-lines-removed  z\n'

    assert.strictEqual(listsLineCountFlags(help), false)
  })

  test('needs both flags, not either', () => {
    const help = '  --lines-added [count]  lines a code_edit added\n'

    assert.strictEqual(listsLineCountFlags(help), false)
  })
})

suite('lineCountArgs', () => {
  test('passes both counts, as text', () => {
    assert.deepStrictEqual(lineCountArgs({ linesAdded: 3, linesRemoved: 0 }), [
      '--lines-added',
      '3',
      '--lines-removed',
      '0',
    ])
  })

  test('passes nothing when the counts are not known', () => {
    assert.deepStrictEqual(lineCountArgs(null), [])
  })
})

suite('LineCountSupport', () => {
  let probes: number
  let clock: number

  setup(() => {
    probes = 0
    clock = 1_000
  })

  /** A support check whose CLI prints `help` (or fails, for null), counting how often it was asked. */
  function supportFor(help: string | null): LineCountSupport {
    return new LineCountSupport({
      now: () => clock,
      readHelp: async () => {
        probes++
        if (help === null) throw new Error('timed out')
        return help
      },
    })
  }

  test('keeps a yes for good', async () => {
    const support = supportFor(helpOf('help_33.txt'))
    await support.supports(BINARY)

    clock += ONE_YEAR_MS
    const answer = await support.supports(BINARY)

    assert.strictEqual(answer, true)
    assert.strictEqual(probes, 1)
  })

  test('keeps a no until the retry interval has passed', async () => {
    const support = supportFor(helpOf('help_32.txt'))
    await support.supports(BINARY)

    clock += SUPPORT_RETRY_MS - 1
    const answer = await support.supports(BINARY)

    assert.strictEqual(answer, false)
    assert.strictEqual(probes, 1)
  })

  test('asks again once the retry interval has passed', async () => {
    const support = supportFor(helpOf('help_32.txt'))
    await support.supports(BINARY)

    clock += SUPPORT_RETRY_MS + 1
    await support.supports(BINARY)

    assert.strictEqual(probes, 2)
  })

  test('answers no when the CLI does not answer', async () => {
    const support = supportFor(null)

    assert.strictEqual(await support.supports(BINARY), false)
  })

  test('asks again after the retry interval when the CLI did not answer', async () => {
    const failing = supportFor(null)
    await failing.supports(BINARY)

    clock += SUPPORT_RETRY_MS + 1
    await failing.supports(BINARY)

    assert.strictEqual(probes, 2)
  })

  test('keeps one answer per binary path', async () => {
    const support = supportFor(helpOf('help_33.txt'))
    await support.supports('/old/workscribe')

    await support.supports('/new/workscribe')

    assert.strictEqual(probes, 2)
  })

  test('shares one probe between saves that arrive while it runs', async () => {
    const support = supportFor(helpOf('help_33.txt'))

    const answers = await Promise.all([support.supports(BINARY), support.supports(BINARY), support.supports(BINARY)])

    assert.deepStrictEqual(answers, [true, true, true])
    assert.strictEqual(probes, 1)
  })

  test('shares a failing probe too, and leaves nothing running once it has failed', async () => {
    const support = supportFor(null)

    const answers = await Promise.all([support.supports(BINARY), support.supports(BINARY)])
    clock += SUPPORT_RETRY_MS + 1
    await support.supports(BINARY)

    assert.deepStrictEqual(answers, [false, false])
    assert.strictEqual(probes, 2)
  })
})
