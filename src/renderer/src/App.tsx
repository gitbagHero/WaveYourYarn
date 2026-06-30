import { useRoutes } from 'react-router-dom'
import { routes } from './routes'

export function App(): JSX.Element {
  return useRoutes(routes) ?? <div />
}
