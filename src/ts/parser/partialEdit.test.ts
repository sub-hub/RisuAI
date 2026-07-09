import { describe, expect, it } from 'vitest'
import {
    replaceRange,
    findAllOriginalRangesFromText,
    findAllOriginalRangesFromHtml,
    type RangeResult,
} from './partialEdit'

// ── replaceRange ──────────────────────────────────────────────────

describe('replaceRange', () => {
    const makeRange = (start: number, end: number): RangeResult => ({
        start,
        end,
        method: 'exact',
        confidence: 1.0,
    })

    it('replaces text at start', () => {
        expect(replaceRange('hello world', makeRange(0, 5), 'hi')).toBe('hi world')
    })

    it('replaces text at end', () => {
        expect(replaceRange('hello world', makeRange(6, 11), 'earth')).toBe('hello earth')
    })

    it('replaces middle of text', () => {
        expect(replaceRange('hello beautiful world', makeRange(5, 15), '')).toBe('hello world')
    })

    it('replaces entire text', () => {
        expect(replaceRange('hello', makeRange(0, 5), 'goodbye')).toBe('goodbye')
    })

    it('replaces with empty string (delete)', () => {
        expect(replaceRange('hello world', makeRange(5, 11), '')).toBe('hello')
    })

    it('inserts at position (start === end)', () => {
        expect(replaceRange('hello', makeRange(5, 5), ' world')).toBe('hello world')
    })
})

// ── findAllOriginalRangesFromText ──────────────────────────────────

describe('findAllOriginalRangesFromText', () => {
    it('finds exact match in simple text', () => {
        const result = findAllOriginalRangesFromText('hello world', 'hello')
        expect(result).toHaveLength(1)
        expect(result[0].start).toBe(0)
        expect(result[0].end).toBe(5)
        expect(result[0].method).toBe('exact')
        expect(result[0].confidence).toBeCloseTo(1.0)
    })

    it('returns empty array for no match', () => {
        const result = findAllOriginalRangesFromText('hello world', 'xyzzy')
        expect(result).toHaveLength(0)
    })

    it('handles exact match with newlines', () => {
        const original = 'line1\nline2\nline3'
        const result = findAllOriginalRangesFromText(original, 'line2')
        expect(result).toHaveLength(1)
        expect(result[0].start).toBe(6)
        expect(result[0].end).toBe(11)
    })

    it('matches through typographic quotes (normalisation)', () => {
        const original = '\u201Chello\u201D world'
        const plain = '"hello" world'
        const result = findAllOriginalRangesFromText(original, plain)
        expect(result).toHaveLength(1)
        expect(result[0].method).toBe('exact')
    })

    it('matches through CBS pattern {{ruby::X::Y}} (normalisation)', () => {
        const original = '{{ruby::漢字::かんじ}} text'
        const plain = '漢字(かんじ) text'
        const result = findAllOriginalRangesFromText(original, plain)
        expect(result.length).toBeGreaterThanOrEqual(1)
    })
})

// ── findAllOriginalRangesFromHtml ─────────────────────────────────

describe('findAllOriginalRangesFromHtml', () => {
    it('extracts plain text from HTML and delegates matching', () => {
        const result = findAllOriginalRangesFromHtml(
            'hello world',
            '<div><span>hello</span> <b>world</b></div>',
        )
        expect(result).toHaveLength(1)
        expect(result[0].start).toBe(0)
        expect(result[0].end).toBe(11)
    })
})
