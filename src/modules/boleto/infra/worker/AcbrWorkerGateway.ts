import { spawn } from 'child_process';

import { getAppConfig } from '../../../../shared/config/appConfig.js';
import { AcbrIntegrationError } from '../../../../shared/errors/AppError.js';
import { createLogger } from '../../../../shared/logging/appLogger.js';
import type { BoletoWorkerGateway } from '../../application/ports/BoletoWorkerGateway.js';

type WorkerExecutor = (iniPath: string, nomeArquivo: string) => Promise<string>;
type WaitFn = (ms: number) => Promise<void>;

const logger = createLogger('acbr-worker-gateway');

function defaultWait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export function parseWorkerResult(stdout: string) {
  const resultLine = stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .reverse()
    .find(line => line.startsWith('__RESULT__'));

  if (!resultLine) {
    throw new AcbrIntegrationError('Worker concluiu sem linha de resultado', {
      stdout: stdout.trim(),
    });
  }

  const data = JSON.parse(resultLine.slice('__RESULT__'.length));
  if (!data?.pdfPath) {
    throw new AcbrIntegrationError('Worker concluiu sem pdfPath', { stdout: stdout.trim() });
  }

  return { pdfPath: String(data.pdfPath) };
}

export class AcbrWorkerGateway implements BoletoWorkerGateway {
  constructor(
    private readonly maxRetries = 5,
    private readonly executor?: WorkerExecutor,
    private readonly wait: WaitFn = defaultWait,
    private readonly workerPath = getAppConfig().runtime.workerPath
  ) {}

  async gerar(iniPath: string, nomeArquivo: string): Promise<string> {
    let lastErr: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      const startedAt = Date.now();
      try {
        logger.info('worker.attempt.start', { attempt, iniPath, nomeArquivo });
        const pdfPath = await this.executeWorker(iniPath, nomeArquivo);
        logger.info('worker.attempt.success', {
          attempt,
          nomeArquivo,
          durationMs: Date.now() - startedAt,
          pdfPath,
        });
        return pdfPath;
      } catch (error) {
        lastErr = error;
        const message = String((error as Error)?.message || error);
        const isSegfault = /139|segfault|signal 11|SIGSEGV/i.test(message);

        logger.error('worker.attempt.failed', error, {
          attempt,
          nomeArquivo,
          durationMs: Date.now() - startedAt,
          isSegfault,
        });

        if (!isSegfault || attempt === this.maxRetries) {
          break;
        }

        await this.wait(1000);
      }
    }

    throw lastErr;
  }

  private executeWorker(iniPath: string, nomeArquivo: string) {
    if (this.executor) {
      return this.executor(iniPath, nomeArquivo);
    }

    return this.runWorker(iniPath, nomeArquivo);
  }

  private runWorker(iniPath: string, nomeArquivo: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', this.workerPath, iniPath, nomeArquivo], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', chunk => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });

      child.on('error', error => {
        reject(
          new AcbrIntegrationError('Falha ao iniciar worker ACBr', {
            workerPath: this.workerPath,
            message: error.message,
          })
        );
      });

      child.on('close', code => {
        if (code === 0) {
          try {
            resolve(parseWorkerResult(stdout).pdfPath);
            return;
          } catch (error) {
            reject(error);
            return;
          }
        }

        reject(
          new AcbrIntegrationError('Worker ACBr falhou', {
            code,
            stderr: stderr.trim(),
            stdout: stdout.trim(),
          })
        );
      });
    });
  }
}
