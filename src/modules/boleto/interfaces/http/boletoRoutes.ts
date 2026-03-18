import fs from 'fs';

import type { FastifyInstance } from 'fastify';

import { getAppConfig } from '../../../../shared/config/appConfig.js';
import { AppError, ResourceNotFoundError } from '../../../../shared/errors/AppError.js';
import { resolvePdfPath, sanitizeFileId } from '../../../../shared/files/boletoFiles.js';
import { createLogger } from '../../../../shared/logging/appLogger.js';
import { GenerateBoletoSchema } from '../../application/dto/GenerateBoletoRequest.js';
import { GenerateBoletoUseCase } from '../../application/use-cases/GenerateBoletoUseCase.js';
import { AcbrWorkerGateway } from '../../infra/worker/AcbrWorkerGateway.js';

const logger = createLogger('boleto-routes');

export async function registerBoletoRoutes(server: FastifyInstance) {
  const workerGateway = new AcbrWorkerGateway();
  const generateBoletoUseCase = new GenerateBoletoUseCase(workerGateway);

  server.get('/api/gerar-boleto', async () => {
    return {
      NumeroDocumento: '000001',
      NossoNumero: '000001',
      Vencimento: '31/12/2026',
      Valor: 150.0,
      Sacado_Nome: 'Joao da Silva',
      Sacado_CNPJCPF: '529.982.247-25',
      Sacado_Logradouro: 'Rua das Flores',
      Sacado_Numero: '123',
      Sacado_Bairro: 'Centro',
      Sacado_Cidade: 'Porto Velho',
      Sacado_UF: 'RO',
      Sacado_CEP: '76801000',
      Mensagem: 'Referente ao servico prestado em Janeiro/2026',
      fileName: 'boleto-000001',
    };
  });

  server.post('/api/gerar-boleto', async (request, reply) => {
    let iniPath: string | null = null;

    try {
      const parseResult = GenerateBoletoSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Dados invalidos',
          issues: parseResult.error.issues.map(issue => ({
            campo: issue.path.join('.'),
            mensagem: issue.message,
          })),
        });
      }

      const result = await generateBoletoUseCase.execute(parseResult.data);
      iniPath = result.iniPath;

      logger.info('boleto.generated', {
        requestId: request.id,
        fileId: result.fileId,
        downloadPath: result.downloadPath,
      });

      return reply.send({
        sucesso: true,
        mensagem: 'Boleto gerado com sucesso',
        requestId: request.id,
        boletoId: result.fileId,
        status: 'ready',
        downloadUrl: result.downloadPath,
      });
    } catch (error) {
      logger.error('boleto.generate.failed', error, { requestId: request.id });

      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          statusCode: error.statusCode,
          error: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        });
      }

      return reply.status(500).send({
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : String(error),
        requestId: request.id,
      });
    } finally {
      if (iniPath) {
        generateBoletoUseCase.cleanupIni(iniPath);
      }
    }
  });

  server.get('/api/boletos/:fileId/download', async (request, reply) => {
    const params = request.params as { fileId: string };
    const fileId = sanitizeFileId(params.fileId);
    const pdfPath = resolvePdfPath(getAppConfig().runtime.tempPdfDir, fileId);

    try {
      if (!fs.existsSync(pdfPath)) {
        throw new ResourceNotFoundError('Boleto nao encontrado', { fileId });
      }

      logger.info('boleto.download', { requestId: request.id, fileId });
      reply.header('Content-Disposition', `attachment; filename="${fileId}.pdf"`);
      reply.type('application/pdf');
      return reply.send(fs.createReadStream(pdfPath));
    } catch (error) {
      logger.error('boleto.download.failed', error, { requestId: request.id, fileId });

      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          statusCode: error.statusCode,
          error: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        });
      }

      return reply.status(500).send({
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : String(error),
        requestId: request.id,
      });
    }
  });
}
