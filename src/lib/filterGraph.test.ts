import { describe, expect, it } from 'vitest'

import { filterGraph } from './filterGraph'
import type { GraphData } from '../types/graph'

const fixture: GraphData = {
  nodes: [
    {
      id: 'a',
      displayTitle: '알파',
      titleOriginal: 'Alpha',
      releaseYear: 2000,
      platforms: ['PC'],
      summary: 'alpha',
      genreGroup: 'rpg',
      imagePath: 'images/fallback/rpg.svg',
    },
    {
      id: 'b',
      displayTitle: '베타',
      titleOriginal: 'Beta',
      releaseYear: 2001,
      platforms: ['PC'],
      summary: 'beta',
      genreGroup: 'rpg',
      imagePath: 'images/fallback/rpg.svg',
    },
    {
      id: 'c',
      displayTitle: '감마',
      titleOriginal: 'Gamma',
      releaseYear: 2002,
      platforms: ['PC'],
      summary: 'gamma',
      genreGroup: 'rpg',
      imagePath: 'images/fallback/rpg.svg',
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'a',
      target: 'b',
      summaryShort: '짧은 요약',
      summaryFull: '알파에서 베타로 연결되는 테스트 엣지',
      evidenceTitle: 'e1',
      evidenceUrl: 'https://example.com/e1',
      analysisRef: 'docs/research/edge-evidence.md#e1',
      reviewMode: 'internal_reviewed',
    },
    {
      id: 'e2',
      source: 'b',
      target: 'c',
      summaryShort: '짧은 요약2',
      summaryFull: '베타에서 감마로 연결되는 테스트 엣지',
      evidenceTitle: 'e2',
      evidenceUrl: 'https://example.com/e2',
      analysisRef: 'docs/research/edge-evidence.md#e2',
      reviewMode: 'internal_reviewed',
    },
  ],
}

describe('filterGraph', () => {
  it('검색어만 적용 시 매칭 노드와 인접 엣지를 반환한다', () => {
    const result = filterGraph(fixture, {
      query: '알파',
    })

    expect(result.nodes.map((node) => node.id).sort()).toEqual(['a', 'b'])
    expect(result.edges.map((edge) => edge.id)).toEqual(['e1'])
  })

  it('검색어가 없으면 전체 데이터를 유지한다', () => {
    const result = filterGraph(fixture, {
      query: '',
    })

    expect(result.nodes).toHaveLength(3)
    expect(result.edges).toHaveLength(2)
  })

  it('원문명으로도 검색이 동작한다', () => {
    const result = filterGraph(fixture, {
      query: 'gamma',
    })

    expect(result.nodes.map((node) => node.id).sort()).toEqual(['b', 'c'])
    expect(result.edges.map((edge) => edge.id)).toEqual(['e2'])
  })
})
