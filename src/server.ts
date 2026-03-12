// src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

import { BoletoSchema, ACBrParser } from './lib/ACBrParser.js';

// ==============================
// ENV
// ==============================
dotenv.config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.prod'
      : '.env.dev',
});

// ==============================
// FASTIFY
// ==============================
const server = Fastify({ logger: true });

await server.register(cors, { origin: true });

const PORT = Number(process.env.PORT || 3001);

// ==============================
// ACBr WORKER (isolado do processo HTTP)
// ==============================
function runAcbrWorker(iniPath: string, nomeArquivo: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const workerPath = path.resolve('./src/acbr-worker.ts');
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', workerPath, iniPath, nomeArquivo],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        try {
          const resultLine = stdout
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .reverse()
            .find(line => line.startsWith('__RESULT__'));

          if (!resultLine) {
            reject(new Error(`Worker concluiu sem linha de resultado. Saída: ${stdout.trim()}`));
            return;
          }

          const data = JSON.parse(resultLine.slice('__RESULT__'.length));
          if (!data?.pdfPath) {
            reject(new Error('Worker concluiu sem pdfPath'));
            return;
          }
          resolve(data.pdfPath);
          return;
        } catch (err: any) {
          reject(new Error(`Falha ao interpretar saída do worker: ${err?.message || err}`));
          return;
        }
      }

      const details = stderr.trim() || stdout.trim() || `exit=${code}`;
      reject(new Error(`Worker ACBr falhou: ${details}`));
    });
  });
}

async function runAcbrWorkerWithRetry(iniPath: string, nomeArquivo: string): Promise<string> {
  const max = 5;
  let lastErr: any;

  for (let i = 0; i < max; i++) {
    try {
      return await runAcbrWorker(iniPath, nomeArquivo);
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      const isSegfault = /139|segfault|signal 11|SIGSEGV/i.test(msg);
      if (!isSegfault || i === max - 1) break;
      console.warn(`⚠️ Worker ACBr caiu com segfault, retry ${i + 1}/${max}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw lastErr;
}

// ==============================
// HEALTH CHECK
// ==============================
server.get('/', async () => {
  return { status: '🚀 ACBr API Online' };
});

// ==============================
// EXEMPLO (helper para testes)
// ==============================
server.get('/api/gerar-boleto', async () => {
  return {
    NumeroDocumento: '000001',
    NossoNumero: '000001',
    Vencimento: '31/12/2026',
    Valor: 150.00,
    Sacado_Nome: 'João da Silva',
    Sacado_CNPJCPF: '123.456.789-09',
    Sacado_Logradouro: 'Rua das Flores',
    Sacado_Numero: '123',
    Sacado_Bairro: 'Centro',
    Sacado_Cidade: 'Porto Velho',
    Sacado_UF: 'RO',
    Sacado_CEP: '76801-000',
    Mensagem: 'Referente ao serviço prestado em Janeiro/2026',
    fileName: 'boleto-000001',  // opcional — nome do arquivo .ini temporário
  };
});

// ==============================
// REQUEST SCHEMA
// ==============================
const RequestSchema = BoletoSchema.extend({
  fileName: z.string().optional(),
});

type BoletoRequest = z.infer<typeof RequestSchema>;

// ==============================
// GERAR BOLETO
// ==============================
server.post('/api/gerar-boleto', async (request, reply) => {
  let iniPath: string | null = null;
  let pdfFinalPath: string | null = null;

  try {
    // ==========================
    // VALIDAÇÃO ZOD
    // ==========================
    const parseResult = RequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Dados inválidos',
        issues: parseResult.error.issues.map(e => ({
          campo: e.path.join('.'),
          mensagem: e.message,
        })),
      });
    }

    const body: BoletoRequest = parseResult.data;

    // ==========================
    // GERAR CONTEÚDO INI
    // ==========================
    const iniContent = ACBrParser.dadosParaIni(body);

    // ==========================
    // TEMP DIR
    // ==========================
    const tempDir = path.resolve('./temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const nomeArquivo = body.fileName || Date.now().toString();
    iniPath = path.join(tempDir, `${nomeArquivo}.ini`);

    fs.writeFileSync(iniPath, iniContent, 'utf8');
    console.log('📝 INI salvo:', iniPath);

    // ==========================
    // FLUXO ACBr (worker isolado)
    // ==========================
    pdfFinalPath = await runAcbrWorkerWithRetry(iniPath, nomeArquivo);

    console.log('✅ PDF gerado com sucesso!');

    return reply.send({
      sucesso: true,
      mensagem: 'Boleto gerado com sucesso',
      pdfPath: pdfFinalPath,
    });

  } catch (err: any) {
    console.error('🔥 ERRO:', err?.message ?? err);
    console.error(err?.stack);

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: err?.message || String(err),
    });

  } finally {
    // Em debug, mantenha o INI para comparar com exemplos reais de homologação
    const manterIni = process.env.DEBUG_KEEP_INI === '1';
    if (!manterIni && iniPath && fs.existsSync(iniPath)) {
      fs.unlinkSync(iniPath);
    }
  }
});

// ==============================
// START
// ==============================
server.listen({
  port: PORT,
  host: '0.0.0.0',
}).then(() => {
  console.log('🚀 Online');
});