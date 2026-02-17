import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import App from './App'

vi.mock('./components/GraphCanvas', () => ({
  default: ({
    nodes,
    onNodeSelect,
  }: {
    nodes: Array<{ id: string; displayTitle: string }>
    onNodeSelect: (id: string) => void
  }) => (
    <div>
      <p data-testid="mock-node-count">nodes:{nodes.length}</p>
      {nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onNodeSelect(node.id)}>
          {node.displayTitle}
        </button>
      ))}
    </div>
  ),
}))

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

  it('선택 노드의 연결 근거 링크가 렌더링되고 클릭 가능한 href를 가진다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '포켓몬스터 적·녹' }))

    const link = screen.getAllByRole('link')[0]
    expect(link).toHaveAttribute('href')
    expect(link).toHaveAttribute('href', expect.stringMatching(/^https?:\/\//))
  })
})
