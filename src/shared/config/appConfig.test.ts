import test from 'node:test';
import assert from 'node:assert/strict';

import { getAppConfig, resetAppConfigForTests } from './appConfig.js';

function setBaseEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  process.env.CEDENTE_NOME = 'Empresa Teste';
  process.env.CEDENTE_NOME_BOLETO = 'Empresa Teste LTDA';
  process.env.CEDENTE_CNPJCPF = '11222333000181';
  process.env.CEDENTE_BANCO = '341';
  process.env.CEDENTE_AGENCIA = '1234';
  process.env.CEDENTE_AGENCIA_DIGITO = '1';
  process.env.CEDENTE_CONTA = '99999';
  process.env.CEDENTE_CONTA_DIGITO = '0';
  process.env.CEDENTE_CARTEIRA = '1';
  process.env.CEDENTE_CONVENIO = '123456';
  process.env.CEDENTE_CODIGO_CEDENTE = '123456';
  process.env.CEDENTE_CODIGO_TRANSMISSAO = '123456';
  process.env.CEDENTE_MODALIDADE = '1';
  process.env.CEDENTE_TIPO_CARTEIRA = '1';
  process.env.CEDENTE_TIPO_DOCUMENTO = '0';
  process.env.CEDENTE_ESPECIE_DOC = 'DM';
  process.env.CEDENTE_RESPON_EMISSAO = '1';
  process.env.CEDENTE_LOGRADOURO = 'Rua do Cedente';
  process.env.CEDENTE_NUMERO = '10';
  process.env.CEDENTE_BAIRRO = 'Centro';
  process.env.CEDENTE_CIDADE = 'Porto Velho';
  process.env.CEDENTE_UF = 'RO';
  process.env.CEDENTE_CEP = '76801000';
  process.env.CEDENTE_TELEFONE = '69999999999';
  process.env.TIPO_COBRANCA = '0';
  delete process.env.BOLETO_VERSAO_ARQUIVO;
  resetAppConfigForTests();
}

test.beforeEach(() => {
  setBaseEnv();
});

test('aceita configuracao base quando dados obrigatorios estao presentes', () => {
  const config = getAppConfig();

  assert.equal(config.cedente.banco, '341');
  assert.equal(config.cedente.convenio, '123456');
});

test('exige convenio para Bancoob/Sicoob', () => {
  process.env.CEDENTE_BANCO = '756';
  process.env.TIPO_COBRANCA = '9';
  process.env.CEDENTE_CONVENIO = '';
  resetAppConfigForTests();

  assert.throws(
    () => getAppConfig(),
    /CEDENTE_CONVENIO e obrigatorio para Bancoob\/Sicoob gerar linha digitavel e codigo de barras/
  );
});

test('exige codigo do cedente para Bancoob/Sicoob', () => {
  process.env.CEDENTE_BANCO = '756';
  process.env.TIPO_COBRANCA = '9';
  process.env.CEDENTE_CODIGO_CEDENTE = '';
  resetAppConfigForTests();

  assert.throws(() => getAppConfig(), /CEDENTE_CODIGO_CEDENTE e obrigatorio para Bancoob\/Sicoob/);
});