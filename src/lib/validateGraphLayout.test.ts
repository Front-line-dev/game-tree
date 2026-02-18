import { describe, expect, it } from 'vitest'

import { validateGraphLayout } from './validateGraphLayout'

describe('validateGraphLayout', () => {
  it('정상 레이아웃을 유효로 판정한다', () => {
    const result = validateGraphLayout(
      {
        version: 1,
        nodes: {
          n1: { x: 10, y: 20 },
        },
        viewport: { x: 3, y: 4, k: 1.2 },
        meta: {
          exportedAt: '2026-02-18T00:00:00.000Z',
          nodeCount: 1,
        },
      },
      new Set(['n1']),
    )

    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.layout.nodes.n1).toEqual({ x: 10, y: 20 })
    expect(result.layout.viewport).toEqual({ x: 3, y: 4, k: 1.2 })
    expect(result.layout.meta).toEqual({
      exportedAt: '2026-02-18T00:00:00.000Z',
      nodeCount: 1,
    })
  })

  it('좌표 또는 viewport 값이 잘못되면 실패한다', () => {
    const result = validateGraphLayout({
      version: 1,
      nodes: {
        n1: { x: 'bad', y: 20 },
      },
      viewport: { x: 0, y: 0, k: 0 },
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.join('\n')).toContain('nodes.n1')
    expect(result.errors.join('\n')).toContain('viewport.k must be a finite positive number')
  })

  it('현재 노드 ID 집합에 없는 좌표는 자동 제외한다', () => {
    const result = validateGraphLayout(
      {
        version: 1,
        nodes: {
          n1: { x: 10, y: 20 },
          n2: { x: 30, y: 40 },
        },
        viewport: { x: 0, y: 0, k: 1 },
      },
      new Set(['n1']),
    )

    expect(result.isValid).toBe(true)
    expect(result.layout.nodes.n1).toEqual({ x: 10, y: 20 })
    expect(result.layout.nodes.n2).toBeUndefined()
  })
})
