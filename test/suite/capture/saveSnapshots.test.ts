import * as assert from 'node:assert'
import { SaveSnapshots } from '../../../src/capture/saveSnapshots'
import { MAX_TRACKED_FILE_CHARS, MAX_TRACKED_FILES } from '../../../src/constants'

const FILE = '/work/app/file.ts'

suite('SaveSnapshots', () => {
  let snapshots: SaveSnapshots

  setup(() => {
    snapshots = new SaveSnapshots()
  })

  test('counts a save against the version seen when the file was opened', () => {
    snapshots.track(FILE, 'a\nb\n')

    assert.deepStrictEqual(snapshots.countsOnSave(FILE, 'a\nX\nc\n'), { linesAdded: 2, linesRemoved: 1 })
  })

  test('counts the next save against the last one, so no edit is counted twice', () => {
    snapshots.track(FILE, 'a\n')
    snapshots.countsOnSave(FILE, 'a\nb\n')

    assert.deepStrictEqual(snapshots.countsOnSave(FILE, 'a\nb\nc\n'), { linesAdded: 1, linesRemoved: 0 })
  })

  test('sends no counts for a file it never saw open, then counts the next save against that one', () => {
    assert.strictEqual(snapshots.countsOnSave(FILE, 'a\n'), null)

    assert.deepStrictEqual(snapshots.countsOnSave(FILE, 'a\nb\n'), { linesAdded: 1, linesRemoved: 0 })
  })

  test('counts a save into a file that was empty', () => {
    snapshots.track(FILE, '')

    assert.deepStrictEqual(snapshots.countsOnSave(FILE, 'a\nb\n'), { linesAdded: 2, linesRemoved: 0 })
  })

  test('keeps the snapshot while you type, so the save counts everything typed since the last version', () => {
    snapshots.track(FILE, 'a\nb\n')

    snapshots.documentChanged({ path: FILE, text: 'a\nb\nc\n', changeCount: 1, isDirty: true })

    assert.deepStrictEqual(snapshots.countsOnSave(FILE, 'a\nb\nc\nd\n'), { linesAdded: 2, linesRemoved: 0 })
  })

  test('does not start tracking a file from a typing event', () => {
    snapshots.documentChanged({ path: FILE, text: 'a\nb\n', changeCount: 1, isDirty: true })

    assert.strictEqual(snapshots.countsOnSave(FILE, 'a\nb\nc\n'), null)
  })

  test('takes the new text after an outside change, so the save counts only what was typed after it', () => {
    snapshots.track(FILE, 'a\nb\n')

    snapshots.documentChanged({ path: FILE, text: 'x\ny\n', changeCount: 1, isDirty: false })

    assert.deepStrictEqual(snapshots.countsOnSave(FILE, 'x\ny\nz\n'), { linesAdded: 1, linesRemoved: 0 })
  })

  test('leaves the snapshot alone for the empty change event around a save', () => {
    snapshots.track(FILE, 'a\nb\n')

    snapshots.documentChanged({ path: FILE, text: 'a\nb\nc\n', changeCount: 0, isDirty: false })

    assert.deepStrictEqual(snapshots.countsOnSave(FILE, 'a\nb\nc\n'), { linesAdded: 1, linesRemoved: 0 })
  })

  test('sends no counts for a binary file', () => {
    snapshots.track(FILE, 'a\u0000b')

    assert.strictEqual(snapshots.countsOnSave(FILE, 'a\u0000bc'), null)
  })

  test('sends no counts for a file over the size limit', () => {
    snapshots.track(FILE, 'x'.repeat(MAX_TRACKED_FILE_CHARS + 1))

    assert.strictEqual(snapshots.countsOnSave(FILE, 'x'.repeat(MAX_TRACKED_FILE_CHARS + 2)), null)
  })

  test('sends no counts for a save that grew the file past the limit', () => {
    snapshots.track(FILE, 'a\nb\n')

    assert.strictEqual(snapshots.countsOnSave(FILE, 'x'.repeat(MAX_TRACKED_FILE_CHARS + 1)), null)
  })

  test('drops the old snapshot of a file that grew too big, rather than diffing against stale text', () => {
    snapshots.track(FILE, 'a\nb\n')
    snapshots.countsOnSave(FILE, 'x'.repeat(MAX_TRACKED_FILE_CHARS + 1))

    assert.strictEqual(snapshots.countsOnSave(FILE, 'a\nb\nc\n'), null)
  })

  test('forgets a file that was closed', () => {
    snapshots.track(FILE, 'a\n')

    snapshots.forget(FILE)

    assert.strictEqual(snapshots.countsOnSave(FILE, 'a\nb\n'), null)
  })

  test('evicts the least recently used file past the limit, and a file used again just before stays', () => {
    for (let index = 0; index < MAX_TRACKED_FILES; index++) snapshots.track(`/work/file${index}.ts`, 'a\n')
    snapshots.documentChanged({ path: '/work/file0.ts', text: 'a\nb\n', changeCount: 1, isDirty: true })

    snapshots.track('/work/one-more.ts', 'a\n')

    assert.strictEqual(snapshots.countsOnSave('/work/file1.ts', 'a\nb\n'), null)
    assert.deepStrictEqual(snapshots.countsOnSave('/work/file0.ts', 'a\nb\n'), { linesAdded: 1, linesRemoved: 0 })
  })
})
