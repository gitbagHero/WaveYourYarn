import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'

export function NotFoundPage(): JSX.Element {
  return (
    <div>
      <PageHeader title="页面不存在" description="当前路由没有对应页面。" />
      <Link to="/" className="text-sm font-medium text-primary hover:underline">
        返回 Dashboard
      </Link>
    </div>
  )
}
