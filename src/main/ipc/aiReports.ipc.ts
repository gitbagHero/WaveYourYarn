import type { AIReportGenerationService } from '../services/AIReportGenerationService'
import type { AIReportService } from '../services/AIReportService'
import { AIReportsIpcHandlers } from './aiReports.handlers'
import { registerIpcHandler } from './registerIpcHandler'

export function registerAIReportsIpc(
  reports: AIReportService,
  generation: AIReportGenerationService
): void {
  const handlers = new AIReportsIpcHandlers(reports, generation)

  registerIpcHandler('ai-reports:list', () => handlers.list())
  registerIpcHandler('ai-reports:get', (_event, payload: unknown) => handlers.get(payload))
  registerIpcHandler('ai-reports:get-by-job', (_event, payload: unknown) =>
    handlers.getByJob(payload)
  )
  registerIpcHandler('ai-reports:start', (_event, payload: unknown) => handlers.start(payload))
  registerIpcHandler('ai-reports:rename', (_event, payload: unknown) => handlers.rename(payload))
  registerIpcHandler('ai-reports:delete', (_event, payload: unknown) => handlers.delete(payload))
}
