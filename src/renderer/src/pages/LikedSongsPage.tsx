import { PageHeader } from '../components/common/PageHeader'
import { EmptyState } from '../components/common/EmptyState'

export function LikedSongsPage(): JSX.Element {
  return (
    <div>
      <PageHeader title="我喜欢的音乐" description="展示网易云“我喜欢的音乐”列表、搜索和同步入口。" />
      <EmptyState title="暂无歌曲数据" description="连接网易云账号并同步后，歌曲会展示在这里。" />
    </div>
  )
}
