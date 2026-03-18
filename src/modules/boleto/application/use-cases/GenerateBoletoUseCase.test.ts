import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { GenerateBoletoUseCase } from './GenerateBoletoUseCase.js';
import { resetAppConfigForTests } from '../../../../shared/config/appConfig.js';

function setBaseEnv(root: string) {
  process.env.NODE_ENV = 'test';
  process.env.CEDENTE_NOME = 'Empresa Teste';
  process.env.CEDENTE_NOME_BOLETO = 'Empresa Teste LTDA';
  process.env.CEDENTE_CNPJCPF = '11222333000181';
  process.env.CEDENTE_BANCO = '756';
  process.env.CEDENTE_AGENCIA = '1234';
  process.env.CEDENTE_CONTA = '99999';
  process.env.CEDENTE_CONTA_DIGITO = '0';
  process.env.CEDENTE_CARTEIRA = '1';
  process.env.CEDENTE_MODALIDADE = '1';
  process.env.CEDENTE_TIPO_CARTEIRA = '1';
  process.env.CEDENTE_TIPO_DOCUMENTO = 'DM';
  process.env.CEDENTE_RESPON_EMISSAO = '1';
  process.env.CEDENTE_LOGRADOURO = 'Rua do Cedente';
  process.env.CEDENTE_NUMERO = '10';
  process.env.CEDENTE_BAIRRO = 'Centro';
  process.env.CEDENTE_CIDADE = 'Porto Velho';
  process.env.CEDENTE_UF = 'RO';
  process.env.CEDENTE_CEP = '76801000';
  process.env.CEDENTE_TELEFONE = '69999999999';
  process.env.TEMP_DIR = path.join(root, 'temp');
  process.env.TEMP_PDF_DIR = path.join(root, 'temp', 'pdf');
  process.env.TEMP_FILE_TTL_HOURS = '24';
  process.env.DEBUG_KEEP_INI = '0';
  resetAppConfigForTests();
}

test('GenerateBoletoUseCase cria ini e retorna rota de download', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acbr-use-case-'));
  setBaseEnv(root);

  const workerCalls: Array<{ iniPath: string; nomeArquivo: string }> = [];
  const useCase = new GenerateBoletoUseCase(
    {
      async gerar(iniPath, nomeArquivo) {
        workerCalls.push({ iniPath, nomeArquivo });
        const pdfPath = path.join(process.env.TEMP_PDF_DIR!, `${nomeArquivo}.pdf`);
        fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
        fs.writeFileSync(pdfPath, 'pdf');
        return pdfPath;
      },
    },
    process.env.TEMP_DIR!,
    process.env.TEMP_PDF_DIR!
  );

  const result = await useCase.execute({
    NumeroDocumento: '12345',
    Vencimento: '31/12/2099',
    Valor: 99.9,
    Sacado_Nome: 'Cliente Teste',
    Sacado_CNPJCPF: '529.982.247-25',
    Sacado_Logradouro: 'Rua A',
    Sacado_Numero: '10',
    Sacado_Bairro: 'Centro',
    Sacado_Cidade: 'Porto Velho',
    Sacado_UF: 'RO',
    Sacado_CEP: '76801000',
    fileName: 'boleto-cliente',
  });

  assert.equal(workerCalls.length, 1);
  assert.ok(fs.existsSync(result.iniPath));
  assert.equal(result.downloadPath, `/api/boletos/${result.fileId}/download`);
  assert.equal(path.basename(result.pdfPath), `${result.fileId}.pdf`);

  useCase.cleanupIni(result.iniPath);
  assert.equal(fs.existsSync(result.iniPath), false);
});
