import * as assert from 'node:assert'
import { diffLineCounts } from '../../../src/capture/lineDiff'

/** `count` lines that differ from every other, and from the lines made with another prefix. */
function distinctLines(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`)
}

suite('diffLineCounts', () => {
  test('counts nothing for identical text', () => {
    assert.deepStrictEqual(diffLineCounts('a\nb\nc\n', 'a\nb\nc\n'), { linesAdded: 0, linesRemoved: 0 })
  })

  test('counts lines added at the end', () => {
    assert.deepStrictEqual(diffLineCounts('a\nb\n', 'a\nb\nc\nd\n'), { linesAdded: 2, linesRemoved: 0 })
  })

  test('counts lines removed from the end', () => {
    assert.deepStrictEqual(diffLineCounts('a\nb\nc\nd\n', 'a\nb\n'), { linesAdded: 0, linesRemoved: 2 })
  })

  test('counts a replaced line as one added and one removed', () => {
    assert.deepStrictEqual(diffLineCounts('a\nb\nc\n', 'a\nX\nc\n'), { linesAdded: 1, linesRemoved: 1 })
  })

  test('counts a moved block as the lines on each side that are not in the common order', () => {
    assert.deepStrictEqual(diffLineCounts('a\nb\nc\nd\n', 'c\nd\na\nb\n'), { linesAdded: 2, linesRemoved: 2 })
  })

  test('counts every line of a new file as added', () => {
    assert.deepStrictEqual(diffLineCounts('', 'a\nb\n'), { linesAdded: 2, linesRemoved: 0 })
  })

  test('counts every line of an emptied file as removed', () => {
    assert.deepStrictEqual(diffLineCounts('a\nb\n', ''), { linesAdded: 0, linesRemoved: 2 })
  })

  test('counts nothing from empty to empty', () => {
    assert.deepStrictEqual(diffLineCounts('', ''), { linesAdded: 0, linesRemoved: 0 })
  })

  test('counts the same last line with and without its newline as a change, as git does', () => {
    assert.deepStrictEqual(diffLineCounts('a\nb', 'a\nb\n'), { linesAdded: 1, linesRemoved: 1 })
  })

  test('counts a last line given a newline and a line after it', () => {
    assert.deepStrictEqual(diffLineCounts('a', 'a\nb'), { linesAdded: 2, linesRemoved: 1 })
  })

  test('counts every line of a file written without a final newline as added', () => {
    assert.deepStrictEqual(diffLineCounts('', 'a\nb'), { linesAdded: 2, linesRemoved: 0 })
  })

  test('counts lines added with CRLF line endings', () => {
    assert.deepStrictEqual(diffLineCounts('a\r\nb\r\n', 'a\r\nb\r\nc\r\n'), { linesAdded: 1, linesRemoved: 0 })
  })

  test('counts every line of a CRLF to LF conversion as changed, as git does', () => {
    assert.deepStrictEqual(diffLineCounts('a\r\nb\r\n', 'a\nb\n'), { linesAdded: 2, linesRemoved: 2 })
  })

  test('counts a few edits exactly however far apart they are in a long file', () => {
    const lines = distinctLines('line', 10_000)
    const edited = [...lines]
    edited[5000] = 'changed'
    edited.splice(7000, 0, 'inserted')

    assert.deepStrictEqual(diffLineCounts(lines.join('\n'), edited.join('\n')), { linesAdded: 2, linesRemoved: 1 })
  })

  test('overstates the diff when the deadline passes', () => {
    let tick = 0
    const slowClock = () => tick++

    const counts = diffLineCounts('a\nb\nc\nd\n', 'a\nX\nc\nY\n', { now: slowClock, deadlineMs: 1 })

    assert.deepStrictEqual(counts, { linesAdded: 3, linesRemoved: 3 })
  })

  test('is exact when the deadline does not pass', () => {
    const counts = diffLineCounts('a\nb\nc\nd\n', 'a\nX\nc\nY\n', { now: () => 0, deadlineMs: 1 })

    assert.deepStrictEqual(counts, { linesAdded: 2, linesRemoved: 2 })
  })

  test('overstates the diff when the deadline passes in the middle of a long pass', () => {
    // 'm' is the one line both sides share, so an exact diff would say 400 and 400
    const before = [...distinctLines('x', 400), 'm'].join('\n')
    const after = ['m', ...distinctLines('y', 400)].join('\n')
    let tick = 0
    const clockThatRunsOutInThePass = () => (tick++ < 3 ? 0 : 1_000)

    const counts = diffLineCounts(before, after, { now: clockThatRunsOutInThePass, deadlineMs: 500 })

    assert.deepStrictEqual(counts, { linesAdded: 401, linesRemoved: 401 })
  })
})
