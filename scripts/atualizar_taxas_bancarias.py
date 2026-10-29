#!/usr/bin/env python3
"""Publica taxas médias mensais oficiais por instituição, sem dados de clientes."""

import datetime as dt
import json
import math
import pathlib
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ARQUIVO = pathlib.Path(__file__).resolve().parent.parent / "taxas-bancarias.json"
ENDPOINT = "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosMensalPorMes"
MODALIDADES = {
    "mercado_tr": "Financiamento imobiliário com taxas de mercado - Pós-fixado referenciado em TR",
    "regulado_tr": "Financiamento imobiliário com taxas reguladas - Pós-fixado referenciado em TR",
}
LIMITE_PAGINA = 200
LIMITE_PAGINAS = 10
LIMITE_MESES = 12


def meses_anteriores(hoje):
    """Consulta competências concluídas, da mais recente até um ano atrás."""
    numero = hoje.year * 12 + hoje.month - 1
    for deslocamento in range(1, LIMITE_MESES + 1):
        ano, mes_zero = divmod(numero - deslocamento, 12)
        yield f"{ano:04d}-{mes_zero + 1:02d}"


def consultar(competencia, modalidade):
    bancos = []
    for pagina in range(LIMITE_PAGINAS):
        parametros = urllib.parse.urlencode({
            "$filter": f"anoMes eq '{competencia}' and Modalidade eq '{modalidade}'",
            "$top": LIMITE_PAGINA,
            "$skip": pagina * LIMITE_PAGINA,
            "$format": "json",
        }, quote_via=urllib.parse.quote)
        requisicao = urllib.request.Request(f"{ENDPOINT}?{parametros}", headers={"Accept": "application/json"})
        with urllib.request.urlopen(requisicao, timeout=30) as resposta:
            documento = json.load(resposta)
        itens = documento.get("value")
        if not isinstance(itens, list):
            raise ValueError("Resposta do Banco Central sem lista de taxas")
        for item in itens:
            if item.get("anoMes") != competencia or item.get("Modalidade") != modalidade:
                raise ValueError("Resposta do Banco Central contém modalidade ou mês inesperado")
            instituicao = str(item.get("InstituicaoFinanceira") or "").strip()
            taxa_anual = float(item["TaxaJurosAoAno"])
            taxa_mensal = float(item["TaxaJurosAoMes"])
            if not instituicao or not all(math.isfinite(x) and x >= 0 for x in (taxa_anual, taxa_mensal)):
                raise ValueError("Taxa ou instituição inválida na resposta")
            bancos.append({
                "instituicao": instituicao,
                "cnpj8": str(item.get("cnpj8") or ""),
                "taxaAnual": taxa_anual,
                "taxaMensal": taxa_mensal,
            })
        if len(itens) < LIMITE_PAGINA:
            return bancos
    raise ValueError("Consulta excedeu o limite de páginas")


def atualizar():
    try:
        anterior = json.loads(ARQUIVO.read_text(encoding="utf-8"))
        if not isinstance(anterior, dict) or not isinstance(anterior.get("modalidades", {}), dict):
            raise ValueError("Arquivo anterior inválido")
    except FileNotFoundError:
        anterior = {"modalidades": {}}
    except (OSError, ValueError) as erro:
        raise SystemExit(f"Arquivo anterior não pôde ser lido; preservado: {erro}") from erro

    modalidades = dict(anterior.get("modalidades", {}))
    hoje = dt.datetime.now(ZoneInfo("America/Porto_Velho")).date()
    atualizadas = 0
    falhas = []
    for chave, descricao in MODALIDADES.items():
        try:
            bancos = []
            for competencia in meses_anteriores(hoje):
                bancos = consultar(competencia, descricao)
                if bancos:
                    break
            if not bancos:
                raise ValueError("Nenhuma competência disponível no último ano")
            dados_anteriores = modalidades.get(chave, {})
            if dados_anteriores.get("competencia", "") > competencia:
                print(f"{chave}: competência anterior mais recente preservada")
                continue
            modalidades[chave] = {
                "competencia": competencia,
                "modalidade": descricao,
                "consultadoEm": dt.datetime.now(dt.timezone.utc).isoformat(),
                "bancos": bancos,
            }
            atualizadas += 1
            print(f"{chave}: {competencia}, {len(bancos)} instituições")
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as erro:
            falhas.append(chave)
            print(f"{chave}: consulta indisponível; dados anteriores preservados ({erro})")

    if atualizadas:
        resultado = {
            "atualizadoEm": dt.datetime.now(dt.timezone.utc).isoformat(),
            "modalidades": modalidades,
        }
        temporario = ARQUIVO.with_suffix(".json.tmp")
        temporario.write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporario.replace(ARQUIVO)
    if falhas:
        raise SystemExit("Falha ao atualizar: " + ", ".join(falhas))
    if not atualizadas:
        print("Nenhum dado novo; arquivo anterior preservado.")


if __name__ == "__main__":
    atualizar()
