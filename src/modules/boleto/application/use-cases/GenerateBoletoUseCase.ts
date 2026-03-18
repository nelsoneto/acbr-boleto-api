import fs from 'fs';
import path from 'path';

import { ACBrParser } from '../../../../lib/ACBrParser.js';
import { getAppConfig } from '../../../../shared/config/appConfig.js';
import {
  buildUniqueFileId,
  cleanupExpiredFiles,
  ensureDirectory,
} from '../../../../shared/files/boletoFiles.js';
import { createLogger } from '../../../../shared/logging/appLogger.js';
import type { GenerateBoletoRequest } from '../dto/GenerateBoletoRequest.js';
import type { BoletoWorkerGateway } from '../ports/BoletoWorkerGateway.js';

const logger = createLogger('generate-boleto-use-case');

export type GenerateBoletoResult = {
  fileId: string;
  iniPath: string;
  pdfPath: string;
  downloadPath: string;
};

export class GenerateBoletoUseCase {
  constructor(
    private readonly workerGateway: BoletoWorkerGateway,
    private readonly tempDir = getAppConfig().runtime.tempDir,
    private readonly tempPdfDir = getAppConfig().runtime.tempPdfDir
  ) {}

  async execute(input: GenerateBoletoRequest): Promise<GenerateBoletoResult> {
    const config = getAppConfig();
    ensureDirectory(this.tempDir);
    ensureDirectory(this.tempPdfDir);
    cleanupExpiredFiles(this.tempDir, config.runtime.tempFileTtlHours, ['.ini']);
    cleanupExpiredFiles(this.tempPdfDir, config.runtime.tempFileTtlHours, ['.pdf']);

    const iniContent = ACBrParser.dadosParaIni(input);
    const fileId = buildUniqueFileId([this.tempDir, this.tempPdfDir], input.fileName || input.NumeroDocumento);
    const iniPath = path.join(this.tempDir, `${fileId}.ini`);

    fs.writeFileSync(iniPath, iniContent, 'utf8');
    logger.info('ini.created', { fileId, iniPath });

    const pdfPath = await this.workerGateway.gerar(iniPath, fileId);

    return {
      fileId,
      iniPath,
      pdfPath,
      downloadPath: `/api/boletos/${fileId}/download`,
    };
  }

  cleanupIni(iniPath: string) {
    const keepIni = getAppConfig().runtime.debugKeepIni;

    if (!keepIni && fs.existsSync(iniPath)) {
      fs.unlinkSync(iniPath);
      logger.info('ini.deleted', { iniPath });
    }
  }
}
