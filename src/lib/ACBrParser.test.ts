import test from 'node:test';
import assert from 'node:assert/strict';

import { ACBrParser, BoletoSchema } from './ACBrParser.js';
import { resetAppConfigForTests } from '../shared/config/appConfig.js';

function setBaseEnv() {
  process.env.NODE_ENV = 'test';
  process.env.CEDENTE_NOME = 'Empresa Teste';
  process.env.CEDENTE_NOME_BOLETO = 'Empresa Teste LTDA';
  process.env.CEDENTE_CNPJCPF = '11222333000181';
  process.env.CEDENTE_BANCO = '756';
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
  process.env.NOSSO_NUMERO_TAMANHO = '8';
  process.env.CEDENTE_LOGRADOURO = 'Rua do Cedente';
  process.env.CEDENTE_NUMERO = '10';
  process.env.CEDENTE_BAIRRO = 'Centro';
  process.env.CEDENTE_CIDADE = 'Porto Velho';
  process.env.CEDENTE_UF = 'RO';
  process.env.CEDENTE_CEP = '76801000';
  process.env.CEDENTE_TELEFONE = '69999999999';
  delete process.env.BOLETO_VERSAO_ARQUIVO;
  delete process.env.BOLETO_CNAB;
  delete process.env.BOLETO_NUMERO_CORRESPONDENTE;
  delete process.env.BOLETO_VERSAO_LOTE;
  delete process.env.TEMP_DIR;
  delete process.env.TEMP_PDF_DIR;
  resetAppConfigForTests();
}

test.beforeEach(() => {
  setBaseEnv();
});

test('BoletoSchema rejeita documento e vencimento invalidos', () => {
  const result = BoletoSchema.safeParse({
    NumeroDocumento: '123',
    Vencimento: '01/01/2020',
    Valor: 10,
    Sacado_Nome: 'Cliente Invalido',
    Sacado_CNPJCPF: '11111111111',
    Sacado_Logradouro: 'Rua A',
    Sacado_Numero: '1',
    Sacado_Bairro: 'Centro',
    Sacado_Cidade: 'Porto Velho',
    Sacado_UF: 'RO',
    Sacado_CEP: '123',
  });

  assert.equal(result.success, false);
  if (result.success) return;

  const messages = result.error.issues.map(issue => issue.message);
  assert.ok(messages.includes('Sacado_CNPJCPF deve conter um CPF ou CNPJ valido'));
  assert.ok(messages.includes('Sacado_CEP deve conter 8 digitos'));
  assert.ok(messages.includes('Vencimento deve ser hoje ou uma data futura valida'));
});

test('BoletoSchema rejeita NossoNumero acima do tamanho configurado', () => {
  const result = BoletoSchema.safeParse({
    NumeroDocumento: '123',
    NossoNumero: '0002026004',
    Vencimento: '31/12/2099',
    Valor: 10,
    Sacado_Nome: 'Cliente Valido',
    Sacado_CNPJCPF: '529.982.247-25',
    Sacado_Logradouro: 'Rua A',
    Sacado_Numero: '1',
    Sacado_Bairro: 'Centro',
    Sacado_Cidade: 'Porto Velho',
    Sacado_UF: 'RO',
    Sacado_CEP: '76801000',
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.ok(
    result.error.issues.some(issue =>
      issue.path.join('.') === 'NossoNumero'
      && issue.message === 'NossoNumero efetivo deve conter no maximo 8 digitos para a configuracao atual'
    )
  );
});

test('BoletoSchema rejeita NumeroDocumento acima do tamanho configurado quando vira NossoNumero', () => {
  const result = BoletoSchema.safeParse({
    NumeroDocumento: '0002026004',
    Vencimento: '31/12/2099',
    Valor: 10,
    Sacado_Nome: 'Cliente Valido',
    Sacado_CNPJCPF: '529.982.247-25',
    Sacado_Logradouro: 'Rua A',
    Sacado_Numero: '1',
    Sacado_Bairro: 'Centro',
    Sacado_Cidade: 'Porto Velho',
    Sacado_UF: 'RO',
    Sacado_CEP: '76801000',
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.ok(
    result.error.issues.some(issue =>
      issue.path.join('.') === 'NumeroDocumento'
      && issue.message === 'NossoNumero efetivo deve conter no maximo 8 digitos para a configuracao atual'
    )
  );
});

test('dadosParaIni usa configuracao do cedente e normaliza dados', () => {
  const parsed = BoletoSchema.parse({
    NumeroDocumento: '12345',
    NossoNumero: '99',
    Vencimento: '31/12/2099',
    Valor: 150.25,
    Sacado_Nome: 'Cliente Valido',
    Sacado_CNPJCPF: '529.982.247-25',
    Sacado_Logradouro: 'Rua A',
    Sacado_Numero: '100',
    Sacado_Bairro: 'Centro',
    Sacado_Cidade: 'Porto Velho',
    Sacado_UF: 'ro',
    Sacado_CEP: '76801-000',
    Mensagem: 'Mensagem teste',
  });

  const ini = ACBrParser.dadosParaIni(parsed, new Date('2026-01-02T00:00:00Z'));

  // Secoes obrigatorias no formato Modo 2 (Cedente_Titulos.INI)
  assert.match(ini, /\[Cedente\]/);
  assert.match(ini, /\[Conta\]/);
  assert.match(ini, /\[Banco\]/);
  assert.match(ini, /\[Titulo1\]/);

  // Campos do [Cedente]
  assert.match(ini, /Nome=Empresa Teste LTDA/);
  assert.match(ini, /TipoPessoa=1/);
  assert.match(ini, /CodigoCedente=123456/);
  assert.match(ini, /RespEmis=1/);

  // Campos do [Conta] com nomes corretos da documentacao
  assert.match(ini, /Agencia=1234/);
  assert.match(ini, /DigitoAgencia=1/);
  assert.match(ini, /Conta=99999/);
  assert.match(ini, /DigitoConta=0/);

  // Campos do [Banco]
  assert.match(ini, /Numero=756/);
  assert.match(ini, /CNAB=1/);
  assert.match(ini, /TipoCobranca=0/);
  assert.match(ini, /NumeroCorrespondente=0/);
  assert.match(ini, /VersaoLote=0/);

  // Campos do [Titulo1]
  assert.match(ini, /Sacado\.CNPJCPF=52998224725/);
  assert.match(ini, /Sacado\.UF=RO/);
  assert.match(ini, /NossoNumero=00000099/);
  assert.match(ini, /ValorDocumento=150,25/);
  assert.match(ini, /Sacado\.Pessoa=0/);
  assert.match(ini, /Especie=DM/);
  assert.match(ini, /EspecieMod=R\$/);
  assert.match(ini, /Aceite=1/);
  assert.match(ini, /Parcela=1/);
  assert.match(ini, /TotalParcelas=1/);
  assert.match(ini, /Quantidade=/);
  assert.match(ini, /Mensagem=Mensagem teste/);

  // Campos que nao devem aparecer no novo formato
  assert.doesNotMatch(ini, /Cedente\.Agencia=/);
  assert.doesNotMatch(ini, /Cedente\.AgenciaDigito=/);
  assert.doesNotMatch(ini, /Cedente\.Conta=/);
  assert.doesNotMatch(ini, /Cedente\.ContaDigito=/);
  assert.doesNotMatch(ini, /Cedente\.Banco=/);
  assert.doesNotMatch(ini, /Cedente\.CodigoTransmissao=/);
  assert.doesNotMatch(ini, /TipoInscricaoCedente=/);
  assert.doesNotMatch(ini, /TipoInscricaoSacado=/);
  assert.doesNotMatch(ini, /Cedente\.TipoInscricao=/);
  assert.doesNotMatch(ini, /CodBanco=/);
  assert.doesNotMatch(ini, /CodigoBanco=/);
  assert.doesNotMatch(ini, /BancoNumero=/);
  assert.doesNotMatch(ini, /Moeda=/);
  assert.doesNotMatch(ini, /Valor=150,25/);
});

test('dadosParaIni omite VersaoArquivo quando nao configurado', () => {
  const parsed = BoletoSchema.parse({
    NumeroDocumento: '1',
    Vencimento: '31/12/2099',
    Valor: 10,
    Sacado_Nome: 'Cliente Valido',
    Sacado_CNPJCPF: '529.982.247-25',
    Sacado_Logradouro: 'Rua A',
    Sacado_Numero: '1',
    Sacado_Bairro: 'Centro',
    Sacado_Cidade: 'Porto Velho',
    Sacado_UF: 'RO',
    Sacado_CEP: '76801000',
  });

  const ini = ACBrParser.dadosParaIni(parsed);
  assert.doesNotMatch(ini, /VersaoArquivo=/);
});

test('dadosParaIni inclui VersaoArquivo quando configurado', () => {
  process.env.BOLETO_VERSAO_ARQUIVO = '810';
  resetAppConfigForTests();

  const parsed = BoletoSchema.parse({
    NumeroDocumento: '1',
    Vencimento: '31/12/2099',
    Valor: 10,
    Sacado_Nome: 'Cliente Valido',
    Sacado_CNPJCPF: '529.982.247-25',
    Sacado_Logradouro: 'Rua A',
    Sacado_Numero: '1',
    Sacado_Bairro: 'Centro',
    Sacado_Cidade: 'Porto Velho',
    Sacado_UF: 'RO',
    Sacado_CEP: '76801000',
  });

  const ini = ACBrParser.dadosParaIni(parsed);
  assert.match(ini, /VersaoArquivo=810/);
});
