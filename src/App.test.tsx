import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, vi } from 'vitest'

import App from './App'

vi.mock('./components/GraphCanvas', () => ({
  default: ({
    nodes,
    designModeEnabled,
    layout,
    onNodeSelect,
  }: {
    nodes: Array<{ id: string; displayTitle: string }>
    designModeEnabled: boolean
    layout: { version: number }
    onNodeSelect: (id: string) => void
  }) => (
    <div>
      <p data-testid="mock-node-count">nodes:{nodes.length}</p>
      <p data-testid="mock-design-mode">{designModeEnabled ? 'design:on' : 'design:off'}</p>
      <p data-testid="mock-layout-version">layout-version:{layout.version}</p>
      {nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onNodeSelect(node.id)}>
          {node.displayTitle}
        </button>
      ))}
    </div>
  ),
}))

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
}

beforeEach(() => {
  setViewportWidth(1280)
})

describe('App component integration', () => {
  it('검색 입력 시 그래프 데이터가 필터링된다', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: '포켓몬스터 적·녹' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '디아블로 II' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('게임 검색'), '포켓몬스터')

    expect(screen.getByRole('button', { name: '포켓몬스터 적·녹' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '디아블로 II' })).not.toBeInTheDocument()
  })

  it('노드 클릭 시 DetailPanel에 메타데이터가 표시된다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '포켓몬스터 적·녹' }))

    expect(screen.getByRole('heading', { name: /포켓몬스터 적·녹/ })).toBeInTheDocument()
    expect(screen.getByText('Pokemon Red and Green')).toBeInTheDocument()
    expect(screen.getByText('1996')).toBeInTheDocument()
    expect(screen.getByText(/Game Boy/)).toBeInTheDocument()
  })

  it('엣지 상세는 문장형 대신 요소형 텍스트를 보여준다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '포켓몬스터 적·녹' }))

    expect(screen.getAllByText(/^요소:/).length).toBeGreaterThan(0)
    expect(
      screen.queryByText('적 개체를 협상으로 동료화하는 구조가 포획형 수집 RPG 설계에 영향을 주었다.'),
    ).not.toBeInTheDocument()
  })

  it('모바일에서는 노드 클릭 시 상세가 팝업 다이얼로그로 열린다', async () => {
    setViewportWidth(390)

    const user = userEvent.setup()
    render(<App />)

    window.dispatchEvent(new Event('resize'))

    await user.click(screen.getByRole('button', { name: '포켓몬스터 적·녹' }))

    expect(screen.getByRole('dialog', { name: '포켓몬스터 적·녹 상세 정보' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '상세 닫기' }))

    expect(screen.queryByRole('dialog', { name: '포켓몬스터 적·녹 상세 정보' })).not.toBeInTheDocument()
  })

  it('선택 노드의 연결 근거 링크가 렌더링되고 클릭 가능한 href를 가진다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '포켓몬스터 적·녹' }))

    const link = screen.getAllByRole('link')[0]
    expect(link).toHaveAttribute('href')
    expect(link).toHaveAttribute('href', expect.stringMatching(/^https?:\/\//))
  })

  it('디자인 모드 토글 시 내보내기 버튼 활성 상태와 GraphCanvas 전달 props가 변경된다', async () => {
    const user = userEvent.setup()
    render(<App />)

    const toggleButton = screen.getByRole('button', { name: '디자인 모드 켜기' })
    const exportButton = screen.getByRole('button', { name: '레이아웃 내보내기' })

    expect(exportButton).toBeDisabled()
    expect(screen.getByTestId('mock-design-mode')).toHaveTextContent('design:off')
    expect(screen.getByTestId('mock-layout-version')).toHaveTextContent('layout-version:1')

    await user.click(toggleButton)

    expect(screen.getByRole('button', { name: '디자인 모드 끄기' })).toBeInTheDocument()
    expect(exportButton).toBeEnabled()
    expect(screen.getByTestId('mock-design-mode')).toHaveTextContent('design:on')
  })
})
