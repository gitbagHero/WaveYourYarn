import { PageHeader } from '../components/common/PageHeader'
import { EmptyState } from '../components/common/EmptyState'

export function ExportPage(): JSX.Element {
  return (
    <div>
      <PageHeader title="数据导出" description="后续支持导出 CSV、JSON 和 Markdown。" />
      <EmptyState title="暂无导出记录" description="完成第一次歌曲导出后，历史记录会显示在这里。" />
    </div>
  )
}
