import { useEffect } from 'react'
import { usePath } from './lib/router'
import { GAMES } from './games'
import Hub from './pages/Hub'

export default function App() {
  const path = usePath()
  const game = GAMES.find(g => g.path === path)

  // page title + start each page at the top
  useEffect(() => {
    document.title = game ? game.title : 'The Toolbox'
    window.scrollTo(0, 0)
  }, [game])

  if (game) {
    const Page = game.component
    return <Page key={game.path} />
  }
  return <Hub />
}
