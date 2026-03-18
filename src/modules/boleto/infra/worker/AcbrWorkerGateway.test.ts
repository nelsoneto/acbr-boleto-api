import test from 'node:test';
import assert from 'node:assert/strict';

import { AcbrWorkerGateway, parseWorkerResult } from './AcbrWorkerGateway.js';
import { AcbrIntegrationError } from '../../../../shared/errors/AppError.js';
import { resetAppConfigForTests } from '../../../../shared/config/appConfig.js';

function setBaseEnv() {
  process.env.NODE_ENV = 'test';
  process.env.CEDENTE_NOME = 'Empresa Teste';
  process.env.CEDENTE_NOME_BOLETO = 'Empresa Teste LTDA';
  process.env.CEDENTE_CNPJCPF = '11222333000181';
  process.env.CEDENTE_BANCO = '756';
  resetAppConfigForTests();
}

test.beforeEach(() => {
  setBaseEnv();
});

test('parseWorkerResult extrai pdfPath da saida do worker', () => {
  const result = parseWorkerResult('linha\n__RESULT__{"pdfPath":"/tmp/boleto.pdf"}\n');
  assert.equal(result.pdfPath, '/tmp/boleto.pdf');
});

test('parseWorkerResult falha quando o worker nao retorna marcador', () => {
  assert.throws(() => parseWorkerResult('sem resultado'), AcbrIntegrationError);
});

test('AcbrWorkerGateway faz retry quando detecta segfault', async () => {
  let attempts = 0;
  const waits: number[] = [];
  const gateway = new AcbrWorkerGateway(
    3,
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('Worker ACBr falhou: exit=139');
      }
      return '/tmp/final.pdf';
    },
    async ms => {
      waits.push(ms);
    },
    '/fake/worker.ts'
  );

  const pdfPath = await gateway.gerar('/tmp/input.ini', 'boleto');

  assert.equal(pdfPath, '/tmp/final.pdf');
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [1000, 1000]);
});
