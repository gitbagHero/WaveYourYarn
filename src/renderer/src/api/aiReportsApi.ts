import type {
  AIReportIdRequest,
  AIReportJobIdRequest,
  RenameAIReportRequest,
  StartAIReportGenerationRequest
} from '../../../main/types/aiReport'
import { getPreloadApi } from './preloadClient'

export const aiReportsApi = {
  list: () => getPreloadApi().aiReports.list(),
  get: (request: AIReportIdRequest) => getPreloadApi().aiReports.get(request),
  getByJob: (request: AIReportJobIdRequest) => getPreloadApi().aiReports.getByJob(request),
  start: (request: StartAIReportGenerationRequest) => getPreloadApi().aiReports.start(request),
  rename: (request: RenameAIReportRequest) => getPreloadApi().aiReports.rename(request),
  delete: (request: AIReportIdRequest) => getPreloadApi().aiReports.delete(request)
}
