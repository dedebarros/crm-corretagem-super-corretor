#!/usr/bin/env python3
"""Atualiza somente indicadores públicos, sem acessar dados do CRM."""
import datetime
import json
import pathlib
import urllib.request
from zoneinfo import ZoneInfo

ARQUIVO = pathlib.Path(__file__).resolve().parent.parent / "indices.json"
SERIES = {"selic": 432, "cdi": 12, "ipca": 433, "tr": 226}

try:
    anterior = json.loads(ARQUIVO.read_text(encoding="utf-8"))
except (OSError, ValueError):
    anterior = {"dados": {}}

dados = dict(anterior.get("dados", {}))
atualizados = 0
hoje = datetime.datetime.now(ZoneInfo("America/Porto_Velho")).date()
inicio = hoje - datetime.timedelta(days=180)
intervalo = f"dataInicial={inicio.strftime('%d/%m/%Y')}&dataFinal={hoje.strftime('%d/%m/%Y')}"
for nome, numero in SERIES.items():
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{numero}/dados?formato=json&{intervalo}"
    try:
        with urllib.request.urlopen(url, timeout=30) as resposta:
            itens = json.load(resposta)
        vigentes = [item for item in itens if datetime.datetime.strptime(item["data"], "%d/%m/%Y").date() <= hoje]
        valor = vigentes[-1]
        if not valor.get("data") or valor.get("valor") is None:
            raise ValueError("resposta incompleta")
        dados[nome] = {"data": str(valor["data"]), "valor": str(valor["valor"]), "fonte": "Banco Central"}
        atualizados += 1
    except (OSError, ValueError, KeyError, IndexError, TypeError) as erro:
        print(f"{nome}: consulta indisponível ({erro})")

if not atualizados:
    raise SystemExit("Nenhum índice foi atualizado; arquivo anterior preservado.")

resultado = {"dados": dados, "atualizadoEm": datetime.datetime.now(datetime.timezone.utc).isoformat()}
ARQUIVO.write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{atualizados} indicador(es) atualizado(s).")
