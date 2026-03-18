import fs from 'fs';
import path from 'path';

import ACBrBoleto from './lib/ACBrBoleto.js';
import { getAppConfig } from './shared/config/appConfig.js';
import { AcbrIntegrationError } from './shared/errors/AppError.js';
import { ensureDirectory, resolvePdfPath } from './shared/files/boletoFiles.js';
import { createLogger } from './shared/logging/appLogger.js';
import { loadEnv } from './shared/env/loadEnv.js';

const logger = createLogger('acbr-worker');

loadEnv();

async function main() {
  const iniPath = process.argv[2];
  const fileId = process.argv[3] || Date.now().toString();
  const config = getAppConfig();

  if (!iniPath) {
    throw new AcbrIntegrationError('Parametro iniPath nao informado');
  }

  if (!fs.existsSync(iniPath)) {
    throw new AcbrIntegrationError('INI nao encontrado', { iniPath });
  }

  ensureDirectory(config.runtime.tempPdfDir);

  const acbr = ACBrBoleto.getInstance();

  try {
    acbr.limparLista();
    acbr.incluirTitulos(iniPath);
    acbr.gerarPDF();

    const pdfBasePath = acbr.getConfiguredPdfPath();
    const pdfFinalPath = resolvePdfPath(config.runtime.tempPdfDir, fileId);
    let pdfOrigemPath = pdfBasePath;

    if (!fs.existsSync(pdfOrigemPath)) {
      const pdfs = fs
        .readdirSync(config.runtime.tempPdfDir)
        .filter(name => name.toLowerCase().endsWith('.pdf'))
        .map(name => {
          const fullPath = path.join(config.runtime.tempPdfDir, name);
          const stat = fs.statSync(fullPath);
          return { fullPath, mtimeMs: stat.mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

      if (pdfs.length === 0) {
        throw new AcbrIntegrationError('PDF nao encontrado apos geracao', {
          pdfBasePath,
          outputDir: config.runtime.tempPdfDir,
        });
      }

      pdfOrigemPath = pdfs[0].fullPath;
    }

    fs.copyFileSync(pdfOrigemPath, pdfFinalPath);
    logger.info('worker.pdf.ready', { fileId, pdfFinalPath });

    process.stdout.write(`__RESULT__${JSON.stringify({ fileId, pdfPath: pdfFinalPath })}\n`);
  } finally {
    acbr.finalizar();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('worker.failed', error, { message });
  process.stderr.write(message);
  process.exit(1);
});
