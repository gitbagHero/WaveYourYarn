import { PageHeader } from '../components/common/PageHeader'
import { EmptyState } from '../components/common/EmptyState'

export function LoginPage(): JSX.Element {
  return (
    <div>
      <PageHeader title="网易云登录" description="扫码登录将在 v0.1.1 接入 api-enhanced 后实现。" />
      <EmptyState title="尚未连接网易云账号" description="后续会在这里展示二维码、扫码状态和当前用户信息。" />
    </div>
  )
}
