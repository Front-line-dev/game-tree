import { describe, expect, it } from 'vitest'

import { validateGraphData } from './validateGraphData'
import type { GraphData } from '../types/graph'

const baseData: GraphData = {
  nodes: [
    {
      id: 'n1',
      displayTitle: '테스트 1',
      titleOriginal: 'Test 1',
      releaseYear: 2001,
      platforms: ['PC'],
      summary: 'n1',
      genreGroup: 'rpg',
      imagePath: 'images/fallback/rpg.svg',
    },
    {
      id: 'n2',
      displayTitle: '테스트 2',
      titleOriginal: 'Test 2',
      releaseYear: 2002,
      platforms: ['PC'],
      summary: 'n2',
      genreGroup: 'rpg',
      imagePath: 'images/fallback/rpg.svg',
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      summaryShort: '테스트',
      summaryFull: '테스트용 풀 설명',
      evidenceTitle: 'test',
      evidenceUrl: 'https://example.com',
      analysisRef: 'docs/research/edge-evidence.md#e1',
      reviewMode: 'internal_reviewed',
    },
  ],
}

describe('validateGraphData', () => {
  it('중복 노드 ID를 탐지한다', () => {
    const result = validateGraphData({
      ...baseData,
      nodes: [baseData.nodes[0], baseData.nodes[0]],
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.join('\n')).toContain('Duplicate node IDs')
  })

  it('존재하지 않는 source/target 참조를 탐지한다', () => {
    const result = validateGraphData({
      ...baseData,
      edges: [
        {
          ...baseData.edges[0],
          source: 'missing-source',
          target: 'missing-target',
        },
      ],
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.join('\n')).toContain('missing source node')
    expect(result.errors.join('\n')).toContain('missing target node')
  })

  it('same_series_exception은 edge-review-log 참조가 필요하다', () => {
    const result = validateGraphData({
      ...baseData,
      edges: [
        {
          ...baseData.edges[0],
          reviewMode: 'same_series_exception',
          analysisRef: 'docs/research/edge-evidence.md#e1',
        },
      ],
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.join('\n')).toContain('same_series_exception')
  })

  it('analysisRef는 docs/research 경로와 anchor를 가져야 한다', () => {
    const result = validateGraphData({
      ...baseData,
      edges: [
        {
          ...baseData.edges[0],
          analysisRef: 'edge-evidence.md',
        },
      ],
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.join('\n')).toContain('analysisRef')
  })
})
