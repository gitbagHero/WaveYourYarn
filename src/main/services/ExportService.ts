import { ExportRecordRepository } from '../db/repositories/ExportRecordRepository'

export class ExportService {
  constructor(private readonly exportRecordRepository = new ExportRecordRepository()) {}

  getExportRecordCount(): number {
    return this.exportRecordRepository.count()
  }
}
