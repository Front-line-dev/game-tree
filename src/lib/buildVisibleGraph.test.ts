import { describe, expect, it } from 'vitest'

import { buildVisibleGraph } from './buildVisibleGraph'
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
      summaryShort: '요소',
      evidenceTitle: 'e1',
      evidenceUrl: 'https://example.com/e1',
      analysisRef: 'docs/research/edge-evidence.md#e1',
      reviewMode: 'internal_reviewed',
    },
  ],
}

describe('buildVisibleGraph', () => {
  it('유효 엣지 endpoint에 없는 노드는 기본 표시에서 제외한다', () => {
    const result = buildVisibleGraph(fixture)

    expect(result.edges).toHaveLength(1)
    expect(result.nodes.map((node) => node.id).sort()).toEqual(['a', 'b'])
  })
})
