/* CRM de atendimento: todas as operações usam os registros existentes. */
(() => {
  'use strict';
  const antigaPaginaClientes = renderClientes;
  const antigaPaginaPessoas = renderPessoasV5;
  const antigoRelatorio = renderRelatorioProcuraV12;
  const antigoDetalhePessoa = abrirVisao360PessoaV5;
  const antigoDetalheCliente = renderDetalhe;
  const antigoImovel = abrirFormImovelV5;
  const antigosImoveis = renderImoveisV5;
  const antigoSimulador = renderSimuladoresV5;
  const antigoCalculoFinanciamento = calcularFinanciamentoV5;
  const antigaPaginaTarefas = renderTarefas;
  const antigoFormularioPessoa = abrirFormPessoaV5;
  const antigosResultados = itensBuscaGlobalV10;
  const antigosDadosProcura = dadosRelatorioProcuraV12;
  const moeda = n => 'R$ ' + fmtMoney(Number(n) || 0);
  const ativo = c => !['Fechado', 'Perdido'].includes(c.status);
  const ultimaNota = c => [...(c.historico || [])].reverse().find(h => !h.auto);
  const emAtraso = c => !!c.proximaAcaoData && (c.proximaAcaoData < hojeStr() || (c.proximaAcaoData === hojeStr() && !!c.proximaAcaoHora && dataAcaoV7(c) < new Date()));
  const semRetorno = c => !c.proximaAcaoData;
  const acao = (nome, id, texto, classe = 'secondary') => `<button type="button" class="btn ${classe} small" data-crm-acao="${nome}" data-id="${escAttr(id || '')}">${texto}</button>`;
  let filtroAcompanhamento = 'todos';
  let abaRelatorio = 'procura';
  let relatorioCompleto = false;

  function barraClientes(main, escolhida) {
    main.insertAdjacentHTML('afterbegin', `<div class="subnav-v5" style="margin-bottom:14px">${acao('aba-clientes','', 'Atendimentos', escolhida === 'clientes' ? '' : 'secondary')} ${acao('aba-pessoas','','Pessoas',escolhida === 'pessoas' ? '' : 'secondary')}</div>`);
    document.querySelector('[data-page="clientes"]')?.classList.add('active');
  }
  renderClientes = function(main) { antigaPaginaClientes(main); barraClientes(main, 'clientes'); };
  renderPessoasV5 = function(main) { antigaPaginaPessoas(main); barraClientes(main, 'pessoas'); };

  function faixaFollowup(c) {
    const nota = ultimaNota(c);
    return `<div class="notice" style="margin:10px 0"><b>Próximo acompanhamento</b><div>${escHtml(c.proximaAcao || 'Nenhuma próxima ação registrada')}${c.proximaAcaoData ? ' · ' + fmtDataCurta(c.proximaAcaoData) + (c.proximaAcaoHora ? ' às ' + escHtml(c.proximaAcaoHora) : '') : ''}</div><div class="entity-meta">${nota ? 'Último contato: ' + escHtml(nota.texto) : 'Nenhum contato registrado.'}</div>${acao('contato',c.id,'Registrar contato')}</div>`;
  }
  abrirVisao360PessoaV5 = function(id) {
    antigoDetalhePessoa(id);
    const corpo = document.getElementById('detalhe-body');
    const clientes = state.clientes.filter(c => c.pessoaId === id && ativo(c));
    if (corpo && clientes.length) corpo.insertAdjacentHTML('afterbegin', clientes.map(faixaFollowup).join(''));
    const fechados=state.clientes.filter(c=>c.pessoaId===id && c.status==='Fechado' && !state.comissoes.some(x=>x.clienteId===c.id||x.legacyClienteId===c.id));
    if(corpo && fechados.length) corpo.insertAdjacentHTML('afterbegin',fechados.map(c=>`<div class="notice">Negócio fechado: ${escHtml(c.nome)} · ${acao('comissao-cliente',c.id,'Preparar comissão')}</div>`).join(''));
    corpo?.querySelectorAll('.stat-card').forEach(el => { if (el.textContent.includes('Avaliações AVP')) el.remove(); });
    corpo?.querySelectorAll('.tab-btn').forEach(el => { if (el.textContent.includes('Busca / AVP')) el.textContent = 'Busca'; });
    corpo?.querySelectorAll('h4').forEach(el => { if (el.textContent.includes('Avaliações AVP')) { const section=el.parentElement; section?.querySelectorAll('[onclick*="abrirFormAvaliacaoV5"]').forEach(b=>b.closest('.owner-row')?.remove()); el.remove(); } });
    corpo?.querySelectorAll('[onclick*="abrirFormAvaliacaoV5"]').forEach(el => el.remove());
  };
  renderDetalhe = function(c) {
    antigoDetalheCliente(c);
    const corpo=document.getElementById('detalhe-body');
    corpo?.insertAdjacentHTML('afterbegin', faixaFollowup(c));
    corpo?.querySelectorAll('[onclick*="irParaLoc"],[onclick*="abrirFormContratoV5"],[onclick*="abrirFormAvaliacaoV5"]').forEach(el=>el.closest('.owner-row')?.remove() || el.remove());
  };
  abrirFormPessoaV5=function(...args) {
    antigoFormularioPessoa(...args);
    const corpo=document.getElementById('modal-loc-body');
    ['pv5-adm','pv5-dia-repasse'].forEach(id=>{const campo=document.getElementById(id);if(campo?.closest('.form-group'))campo.closest('.form-group').style.display='none';});
    corpo?.querySelectorAll('.card').forEach(el=>{if(el.textContent.includes('Avaliações AVP relacionadas'))el.remove();});
  };
  itensBuscaGlobalV10=function(q){return antigosResultados(q).filter(x=>x.tipo!=='contrato');};
  dadosRelatorioProcuraV12=function(){const lista=antigosDadosProcura();return (parseMoney(filtrosRelatorioProcuraV12.valorMin)||parseMoney(filtrosRelatorioProcuraV12.valorMax))?lista.filter(x=>x.valorNumero>0):lista;};
  htmlGruposProcuraV12=function(lista) {
    const grupos=new Map();
    lista.forEach(r=>{
      const limite=r.valorNumero?Math.ceil(r.valorNumero/100000)*100000:0;
      const faixa=limite?`orçamento até ${moeda(limite)} (faixa de ${moeda(Math.max(0,limite-100000))} a ${moeda(limite)})`:'orçamento não informado';
      const chave=[r.operacoes.join(' / ')||'Operação não informada',r.tipo||'Tipo não informado',r.bairro||'Região não informada',r.quartos?r.quartos+' quarto(s)':'Quartos não informados',faixa].join(' | ');
      if(!grupos.has(chave))grupos.set(chave,[]);grupos.get(chave).push(r);
    });
    return `<div class="entity-grid">${[...grupos.entries()].map(([chave,itens])=>`<article class="entity-card"><h3>${escHtml(chave)}</h3><p>${itens.map(x=>escHtml(x.nome)).join(', ')}</p><b>Total: ${itens.length} cliente(s)</b></article>`).join('')}</div>`;
  };

  abrirInteracao = function(id) {
    const c = state.clientes.find(x => x.id === id);
    if (!c) return toast('Selecione um atendimento para registrar o contato.');
    document.getElementById('int-cliente-id').value=id;
    document.getElementById('int-texto').value='';
    document.getElementById('int-resultado').value='';
    document.getElementById('int-proxima-acao').value=c.proximaAcao||'';
    document.getElementById('int-proxima-data').value=c.proximaAcaoData||'';
    document.getElementById('int-proxima-hora').value=c.proximaAcaoHora||'';
    abrirModal('modal-interacao');
  };
  salvarInteracao = function() {
    const c=state.clientes.find(x=>x.id===document.getElementById('int-cliente-id').value);
    const texto=document.getElementById('int-texto').value.trim();
    const resultado=document.getElementById('int-resultado').value;
    const proxima=document.getElementById('int-proxima-acao').value.trim();
    const data=document.getElementById('int-proxima-data').value;
    const hora=document.getElementById('int-proxima-hora').value;
    if(!c || !texto) return toast('Descreva o contato antes de salvar.');
    if(data && !proxima) return toast('Informe a próxima ação para o retorno agendado.');
    c.historico=c.historico||[];
    c.historico.push({data:hoje(),texto: texto + (resultado ? ' · ' + resultado : ''),auto:false,resultado});
    c.ultimaInteracao=hoje(); c.proximaAcao=proxima; c.proximaAcaoData=data; c.proximaAcaoHora=hora; c.situacaoFollowup=resultado;
    if(!salvar(state)) return;
    fecharModal('modal-interacao');
    if (document.getElementById('modal-detalhe').classList.contains('show')) {
      if(c.pessoaId && pessoaV5(c.pessoaId)) abrirVisao360PessoaV5(c.pessoaId); else renderDetalhe(c);
    }
    render(); toast('Contato registrado e próximo passo atualizado.');
  };
  function abrirAcompanhamento(filtro='todos') {
    filtroAcompanhamento=filtro; abaRelatorio='acompanhamento'; irPaginaV5('relatorio-procura');
  }
  function listaAcompanhamento(filtro) {
    return state.clientes.filter(ativo).filter(c => {
      if(filtro==='atrasados') return emAtraso(c);
      if(filtro==='hoje') return c.proximaAcaoData===hojeStr() && !emAtraso(c);
      if(filtro==='sem-retorno') return semRetorno(c);
      if(filtro==='visitas') return c.status==='Visita Agendada';
      if(filtro==='sem-resposta') return ['Sem resposta','Aguardando cliente'].includes(c.situacaoFollowup);
      if(filtro==='parados') return diasDesde(c.ultimaInteracao || getDataCadastro(c))>=7;
      if(filtro==='qualificacao') return scoreComercialV8(c).total===null;
      return true;
    }).sort((a,b)=>String(a.proximaAcaoData||'9999').localeCompare(String(b.proximaAcaoData||'9999')) || a.nome.localeCompare(b.nome,'pt-BR'));
  }
  function linhaCliente(c) {
    const nota=ultimaNota(c), p=c.perfilBusca||{};
    const perfil=[p.tipo,p.bairros,p.quartos ? p.quartos+' quartos':'',p.valorMax?'até R$ '+p.valorMax:''].filter(Boolean).join(' · ');
    return `<tr><td><b>${escHtml(c.nome)}</b><br><small>${escHtml(c.status||'')}</small></td><td>${escHtml(perfil||'Procura não informada')}</td><td>${escHtml(nota?.texto||'Sem contato registrado')}</td><td>${escHtml(c.proximaAcao||'Sem próxima ação')}<br><small>${c.proximaAcaoData?fmtDataCurta(c.proximaAcaoData)+(c.proximaAcaoHora?' · '+escHtml(c.proximaAcaoHora):''):'Sem data'}</small></td><td><div class="entity-actions">${acao('abrir-cliente',c.id,'Abrir')}${acao('contato',c.id,'Registrar contato')}${c.whatsapp?'<a class="btn small" target="_blank" rel="noopener noreferrer" href="'+whatsappLink(c.whatsapp)+'">WhatsApp</a>':''}</div></td></tr>`;
  }
  function tabelaAcompanhamento(lista) {
    return `<div class="card" style="overflow:auto"><table><thead><tr><th>Cliente</th><th>Procura</th><th>Último contato</th><th>Próximo passo</th><th>Ações</th></tr></thead><tbody>${lista.map(linhaCliente).join('') || '<tr><td colspan="5">Nenhum atendimento encontrado.</td></tr>'}</tbody></table></div>`;
  }
  renderHojeV7 = function(main) {
    const clientes=state.clientes.filter(ativo), atrasados=clientes.filter(emAtraso), hoje=clientes.filter(c=>c.proximaAcaoData===hojeStr()&&!emAtraso(c)), sem=clientes.filter(semRetorno), visitas=clientes.filter(c=>c.status==='Visita Agendada');
    const fila=[...clientes].filter(c=>emAtraso(c)||c.proximaAcaoData===hojeStr()||semRetorno(c)).sort((a,b)=>String(a.proximaAcaoData||'9999').localeCompare(String(b.proximaAcaoData||'9999')));
    const card=(rotulo,lista,filtro,cor)=>`<div class="stat-card ${cor} clickable-card" data-crm-acao="fila" data-id="${filtro}" role="button" tabindex="0"><div class="label">${rotulo}</div><div class="value">${lista.length}</div></div>`;
    main.innerHTML=`<div class="page-header"><div><h2>Meu dia</h2><small>Seus atendimentos e próximos passos em um só lugar.</small></div><div class="actions"><button class="btn verde" onclick="abrirModalCliente()">+ Novo atendimento</button><button class="btn secondary" onclick="irPaginaV5('kanban')">Pipeline</button></div></div><div class="stats-grid">${card('Retornos atrasados',atrasados,'atrasados','quente')}${card('Retornos de hoje',hoje,'hoje','morno')}${card('Sem retorno agendado',sem,'sem-retorno','')}${card('Visitas agendadas',visitas,'visitas','verde')}</div><h3 style="margin:18px 0 10px">Atendimentos que precisam de atenção</h3>${tabelaAcompanhamento(fila)}`;
  };
  function renderAcompanhamento(main) {
    const opcoes=[['todos','Todos os atendimentos ativos'],['atrasados','Retornos atrasados'],['hoje','Retornos de hoje'],['sem-retorno','Sem retorno agendado'],['visitas','Visitas agendadas'],['sem-resposta','Aguardando resposta'],['qualificacao','Qualificação incompleta'],['parados','Sem contato há 7 dias ou mais']];
    const lista=listaAcompanhamento(filtroAcompanhamento);
    main.innerHTML=`<div class="page-header"><div><h2>Relatório de acompanhamento</h2><small>${lista.length} atendimento(s) encontrado(s).</small></div></div><div class="subnav-v5">${acao('rel-procura','','Procura / Necessidade')}${acao('rel-acomp','','Acompanhamento','')}</div><div class="filtros"><label>Mostrar <select data-crm-filtro="acompanhamento">${opcoes.map(([v,l])=>`<option value="${v}" ${filtroAcompanhamento===v?'selected':''}>${l}</option>`).join('')}</select></label></div>${tabelaAcompanhamento(lista)}`;
  }
  renderTarefas=function(main) {
    antigaPaginaTarefas(main);
    const lista=listaAcompanhamento('todos').filter(c=>c.proximaAcao || c.proximaAcaoData);
    const painel=document.createElement('div');painel.innerHTML=`<h3 style="margin:18px 0 10px">Próximos contatos de clientes</h3>${tabelaAcompanhamento(lista)}`;
    main.insertBefore(painel,main.querySelector('.card'));
  };
  renderRelatorioProcuraV12 = function(main) {
    if (abaRelatorio==='acompanhamento') return renderAcompanhamento(main);
    antigoRelatorio(main);
    main.insertAdjacentHTML('afterbegin',`<div class="subnav-v5">${acao('rel-procura','','Procura / Necessidade','')} ${acao('rel-acomp','','Acompanhamento')}</div>`);
    const lista=dadosRelatorioProcuraV12(), tabela=main.querySelector('table');
    if(tabela) {
      tabela.querySelector('thead tr')?.insertAdjacentHTML('beforeend','<th>Último contato / próximo retorno</th><th>Imóveis</th>');
      tabela.querySelectorAll('tbody tr').forEach((tr,i)=>{const c=lista[i]?.cliente;if(!c)return;const nota=ultimaNota(c);tr.insertAdjacentHTML('beforeend',`<td>${escHtml(nota?.texto||'Sem contato')}<br><small>${escHtml(c.proximaAcao||'Sem próxima ação')}${c.proximaAcaoData?' · '+fmtDataCurta(c.proximaAcaoData):''}</small></td><td>${acao('imoveis-compativeis',c.id,'Buscar imóveis')}</td>`);});
      if(!relatorioCompleto)tabela.querySelectorAll('tr').forEach(tr=>[7,8,9,10,11].forEach(n=>{if(tr.children[n])tr.children[n].style.display='none';}));
    }
    main.querySelector('.filtros')?.insertAdjacentHTML('beforeend',acao('salvar-filtro','','Salvar filtros')+' '+acao('carregar-filtro','','Usar filtros salvos')+' '+acao('alternar-relatorio','',relatorioCompleto?'Visão resumida':'Visão completa'));
  };
  function imoveisParaCliente(id) {
    const c=state.clientes.find(x=>x.id===id); if(!c)return;
    const lista=imoveisCompativeisV10(c.perfilBusca||{}, c.finalidade||[]);
    abrirModalLoc('Imóveis possivelmente compatíveis',`<p>Confira preço, disponibilidade e detalhes antes de oferecer a ${escHtml(c.nome)}.</p>${lista.map(i=>`<div class="owner-row"><span><b>${escHtml(i.codigo||i.tipo||'Imóvel')}</b><br>${escHtml(enderecoImovelV5(i))}</span>${acao('imovel',i.id,'Abrir ficha')}</div>`).join('') || '<div class="empty">Nenhum imóvel encontrado com os critérios informados.</div>'}`,()=>fecharModal('modal-loc'));
  }
  function clientesParaImovel(id) {
    const i=imovelV5(id);if(!i)return;
    const lista=state.clientes.filter(ativo).filter(c=>imoveisCompativeisV10(c.perfilBusca||{},c.finalidade||[]).some(x=>x.id===id) && Object.values(c.perfilBusca||{}).some(Boolean));
    abrirModalLoc('Clientes possivelmente interessados',`<p>${escHtml(enderecoImovelV5(i))}. Confirme as preferências e os dados do imóvel com cada cliente.</p>${tabelaAcompanhamento(lista)}`,()=>fecharModal('modal-loc'));
  }
  abrirFormImovelV5 = function(id,...resto) {
    antigoImovel(id,...resto);
    const corpo=document.getElementById('modal-loc-body');
    corpo?.querySelectorAll('[onclick*="abrirFormAvaliacaoV5"],[onclick*="abrirFormContratoV5"]').forEach(e=>e.remove());
    corpo?.querySelectorAll('.result-box').forEach(e=>{if(/Avaliações AVP|Contratos/.test(e.textContent))e.remove();});
    if(id) corpo?.insertAdjacentHTML('afterbegin',acao('clientes-imovel',id,'Ver clientes interessados'));
  };
  renderImoveisV5 = function(main) {
    antigosImoveis(main);
    main.querySelectorAll('[onclick*="abrirFormAvaliacaoV5"]').forEach(el=>el.remove());
    main.querySelectorAll('.entity-meta').forEach(el=>{el.textContent=el.textContent.replace(/ · 📐 \d+ avaliação\(ões\)/,'');});
  };
  const antigoKanbanCard=renderKanbanCard;
  renderKanbanCard=function(c) {
    const html=antigoKanbanCard(c);
    const status=emAtraso(c)?'🔴 Atrasado':c.proximaAcaoData===hojeStr()?'🟡 Hoje':c.proximaAcaoData?'🟢 Agendado':'⚪ Sem retorno';
    return html.replace('<div class="meta">',`<div class="entity-meta">${status}</div><div class="meta">`);
  };

  function valoresComissao(c) {
    const bruto=parseMoney(c.valorBruto || c.valorPrevisto);
    const partes=['pctImobiliaria','pctParceiro','pctIndicador'].reduce((s,k)=>s+parsePercentual(c[k]),0);
    const proprio=c.valorBruto ? bruto*Math.max(0,100-partes)/100 : parseMoney(c.valorPrevisto);
    const recebido=Array.isArray(c.pagamentos) ? c.pagamentos.reduce((s,p)=>s+parseMoney(p.valor),0) : parseMoney(c.valorRecebido);
    return {bruto,proprio,recebido,saldo:Math.max(0,proprio-recebido)};
  }
  function comissaoConfirmada(c){return c.confirmada===true || (c.confirmada===undefined && ['Faturada','Parcialmente recebida','Recebida','Atrasada'].includes(c.status));}
  renderComissoesV5=function(main) {
    const lista=state.comissoes.filter(c=>c.status!=='Cancelada');
    const fechado=lista.filter(comissaoConfirmada), estimativa=lista.filter(c=>!comissaoConfirmada(c));
    const soma=(arr,k)=>arr.reduce((s,c)=>s+valoresComissao(c)[k],0);
    main.innerHTML=`<div class="page-header"><div><h2>Comissões</h2><small>Valores da sua parte em cada negócio.</small></div><button class="btn verde" data-crm-acao="nova-comissao">+ Nova comissão</button></div><div class="stats-grid"><div class="stat-card"><div class="label">Estimativas em andamento</div><div class="value">${moeda(soma(estimativa,'proprio'))}</div></div><div class="stat-card"><div class="label">Confirmadas</div><div class="value">${moeda(soma(fechado,'proprio'))}</div></div><div class="stat-card verde"><div class="label">Recebido</div><div class="value">${moeda(soma(lista,'recebido'))}</div></div><div class="stat-card quente"><div class="label">Confirmadas a receber</div><div class="value">${moeda(soma(fechado,'saldo'))}</div></div></div><div class="card" style="overflow:auto"><table><thead><tr><th>Negócio</th><th>Comissão bruta</th><th>Sua parte</th><th>Recebido</th><th>Saldo</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${state.comissoes.map(c=>{const v=valoresComissao(c),p=pessoaV5(c.pessoaId),i=imovelV5(c.imovelId);return `<tr><td><b>${escHtml(c.descricao||'Comissão')}</b><br><small>${escHtml(p?.nome||'')}${i?' · '+escHtml(enderecoImovelV5(i)):''}</small></td><td>${moeda(v.bruto)}</td><td>${moeda(v.proprio)}</td><td>${moeda(v.recebido)}</td><td>${moeda(v.saldo)}</td><td>${escHtml(c.status==='Cancelada'?'Cancelada':comissaoConfirmada(c)?'Confirmada':'Estimativa')}${c.vencimento?'<br><small>Previsão: '+fmtDataCurta(c.vencimento)+'</small>':''}</td><td>${acao('editar-comissao',c.id,'Editar')} ${c.status==='Cancelada'?'':acao('receber-comissao',c.id,'Registrar recebimento')}</td></tr>`}).join('')||'<tr><td colspan="7">Nenhuma comissão cadastrada.</td></tr>'}</tbody></table></div>`;
  };
  abrirFormComissaoV5=function(id, clienteId='') {
    const c=state.comissoes.find(x=>x.id===id)||{}, cliente=state.clientes.find(x=>x.id===clienteId);
    const selecionado=c.clienteId||c.legacyClienteId||clienteId;
    const opcoes=state.clientes.map(x=>`<option value="${escAttr(x.id)}" ${x.id===selecionado?'selected':''}>${escHtml(x.nome)} · ${escHtml(x.status||'')}</option>`).join('');
    const pagamentos=Array.isArray(c.pagamentos)?c.pagamentos:[];
    const html=`<div class="form-grid">${fG('Descrição *',fInput('cm-descricao',c.descricao|| (cliente ? 'Comissão · '+cliente.nome : '')),'two')}${fG('Atendimento',`<select id="cm-cliente"><option value="">Sem vínculo</option>${opcoes}</select>`,'two')}${fG('Imóvel',`<select id="cm-imovel">${opcoesImoveisV5(c.imovelId||cliente?.imovelId||'')}</select>`,'two')}${fG('Valor do negócio',fInput('cm-negocio',c.valorNegocio||cliente?.negocio?.valorVenda||'',{money:true}))}${fG('Comissão %',fInput('cm-percentual',c.percentual||cliente?.negocio?.comissaoPct||'',{percent:true}))}${fG('Comissão bruta',fInput('cm-bruto',c.valorBruto||c.valorPrevisto||cliente?.negocio?.comissaoValor||'',{money:true}))}${fG('Imobiliária (% da comissão)',fInput('cm-imobiliaria',c.pctImobiliaria||'',{percent:true}))}${fG('Parceiro (% da comissão)',fInput('cm-parceiro',c.pctParceiro||'',{percent:true}))}${fG('Indicador (% da comissão)',fInput('cm-indicador',c.pctIndicador||'',{percent:true}))}${fG('Previsão de recebimento',fInput('cm-vencimento',c.vencimento||'',{type:'date'}))}${fG('Situação',`<select id="cm-situacao"><option value="estimativa" ${!comissaoConfirmada(c)&&c.status!=='Cancelada'?'selected':''}>Estimativa</option><option value="confirmada" ${comissaoConfirmada(c)&&c.status!=='Cancelada'?'selected':''}>Confirmada</option><option value="cancelada" ${c.status==='Cancelada'?'selected':''}>Cancelada</option></select>`)}${fG('Parcelas previstas (uma por linha: AAAA-MM-DD; valor)',fTextarea('cm-parcelas',(c.parcelasPrevistas||[]).map(p=>p.data+'; '+p.valor).join('\n')),'full')}${fG('Observações',fTextarea('cm-obs',c.observacoes||''),'full')}</div><div class="notice" id="cm-resumo"></div><div class="card"><b>Recebimentos registrados</b>${pagamentos.map(p=>`<div class="owner-row"><span>${fmtDataCurta(p.data)} · ${moeda(parseMoney(p.valor))} ${escHtml(p.obs||'')}</span></div>`).join('') || `<div class="entity-meta">${parseMoney(c.valorRecebido)?'Valor recebido anteriormente: '+moeda(parseMoney(c.valorRecebido)):'Nenhum recebimento registrado.'}</div>`}</div>`;
    abrirModalLoc(id?'Editar comissão':'Nova comissão',html,()=>{
      const desc=locVal('cm-descricao'), negocioId=locVal('cm-cliente'), bruto=parseMoney(locVal('cm-bruto'));
      const porcentagens=['cm-imobiliaria','cm-parceiro','cm-indicador'].map(k=>parsePercentual(locVal(k)));
      if(!desc || bruto<=0) return toast('Informe a descrição e a comissão bruta.');
      if(porcentagens.some(n=>n<0||n>100)||porcentagens.reduce((a,b)=>a+b,0)>100) return toast('A soma das divisões deve ficar entre 0% e 100%.');
      if(valoresComissao(c).recebido>bruto*(100-porcentagens.reduce((a,b)=>a+b,0))/100+0.01)return toast('A sua parte não pode ser menor que o valor já recebido.');
      const linhas=locVal('cm-parcelas').split('\n').map(x=>x.trim()).filter(Boolean);
      const parcelasPrevistas=linhas.map(l=>{const [data,valor]=l.split(';').map(x=>x.trim());return {data,valor};});
      if(parcelasPrevistas.some(p=>!/^\d{4}-\d{2}-\d{2}$/.test(p.data||'')||parseMoney(p.valor)<=0))return toast('Use uma parcela por linha: AAAA-MM-DD; valor.');
      const pessoa=state.clientes.find(x=>x.id===negocioId);
      let registro=state.comissoes.find(x=>x.id===id);
      if(!registro){registro={id:uid(),criadoEm:hoje()};state.comissoes.push(registro);}
      const situacao=locVal('cm-situacao');
      Object.assign(registro,{descricao:desc,clienteId:negocioId,pessoaId:pessoa?.pessoaId||registro.pessoaId||'',imovelId:locVal('cm-imovel'),valorNegocio:locVal('cm-negocio'),percentual:locVal('cm-percentual'),valorBruto:locVal('cm-bruto'),pctImobiliaria:porcentagens[0],pctParceiro:porcentagens[1],pctIndicador:porcentagens[2],confirmada:situacao==='confirmada',status:situacao==='cancelada'?'Cancelada':situacao==='confirmada'?'Faturada':'Prevista',vencimento:locVal('cm-vencimento'),parcelasPrevistas,observacoes:locVal('cm-obs')});
      registro.valorPrevisto=fmtMoney(valoresComissao(registro).proprio);
      if(!salvar(state))return;fecharModal('modal-loc');render();toast('Comissão salva.');
    });
    const resumo=()=>{
      const bruto=parseMoney(locVal('cm-bruto')),parte=['cm-imobiliaria','cm-parceiro','cm-indicador'].reduce((s,k)=>s+parsePercentual(locVal(k)),0);
      document.getElementById('cm-resumo').textContent=parte>100?'A divisão ultrapassa 100%.':`Sua parte estimada: ${moeda(bruto*Math.max(0,100-parte)/100)} · divisão informada: ${parte}%`;
    };
    ['cm-bruto','cm-imobiliaria','cm-parceiro','cm-indicador'].forEach(k=>document.getElementById(k)?.addEventListener('input',resumo));
    ['cm-negocio','cm-percentual'].forEach(k=>document.getElementById(k)?.addEventListener('input',()=>{const n=parseMoney(locVal('cm-negocio')),p=parsePercentual(locVal('cm-percentual'));if(n&&p)document.getElementById('cm-bruto').value=fmtMoney(n*p/100);resumo();}));
    resumo();
  };
  function receberComissao(id) {
    const c=state.comissoes.find(x=>x.id===id);if(!c)return;
    abrirModalLoc('Registrar recebimento',`<div class="notice">Saldo atual: ${moeda(valoresComissao(c).saldo)}</div><div class="form-grid">${fG('Valor recebido',fInput('cm-rec-valor','',{money:true}))}${fG('Data',fInput('cm-rec-data',hojeStr(),{type:'date'}))}${fG('Observação',fInput('cm-rec-obs',''),'full')}</div>`,()=>{
      const valor=parseMoney(locVal('cm-rec-valor')),data=locVal('cm-rec-data');
      if(valor<=0||!data)return toast('Informe valor e data do recebimento.');
      if(valor>valoresComissao(c).saldo+0.01)return toast('O valor supera o saldo da comissão.');
      if(!Array.isArray(c.pagamentos)){const antigo=parseMoney(c.valorRecebido);c.pagamentos=antigo?[{valor:fmtMoney(antigo),data:'',obs:'Recebimento anterior'}]:[];}
      c.pagamentos.push({id:uid(),valor:fmtMoney(valor),data,obs:locVal('cm-rec-obs')});
      c.valorRecebido=fmtMoney(valoresComissao(c).recebido);
      c.confirmada=true;c.status=valoresComissao(c).saldo<=0.01?'Recebida':'Parcialmente recebida';
      if(!salvar(state))return;fecharModal('modal-loc');render();toast('Recebimento registrado.');
    });
  }

  const SERIES_INDICES = [
    {chave:'selic',nome:'Meta Selic',serie:432,unidade:'% ao ano'},
    {chave:'cdi',nome:'CDI',serie:12,unidade:'% ao dia'},
    {chave:'ipca',nome:'IPCA',serie:433,unidade:'% no mês'},
    {chave:'tr',nome:'TR',serie:226,unidade:'% no período'}
  ];
  let indicesV11=null;
  try { indicesV11=JSON.parse(localStorage.getItem('crm_indices_v11')||'null'); } catch(e) {}
  function painelIndices() {
    const dados=indicesV11?.dados||{};
    return `<div class="card"><h3>Referências econômicas</h3><small>Dados públicos para consulta; a taxa do financiamento deve ser informada conforme o banco.</small><div class="result-grid" style="margin-top:10px">${SERIES_INDICES.map(s=>{const v=dados[s.chave];return `<div class="result-box"><small>${s.nome}</small><b>${v?escHtml(v.valor)+' '+s.unidade:'Indisponível'}</b><small>${v?'Referência: '+escHtml(v.data):'Sem dado atualizado'}</small></div>`}).join('')}</div><div class="entity-meta">Fonte: Banco Central · última consulta: ${indicesV11?.atualizadoEm?escHtml(new Date(indicesV11.atualizadoEm).toLocaleString('pt-BR')):'ainda não realizada'}.</div>${acao('atualizar-indices','','Atualizar índices')}</div>`;
  }
  async function atualizarIndices() {
    const antes=indicesV11?.dados||{}, dados={...antes}; let atualizados=0;
    const opcoes=typeof AbortSignal!=='undefined' && typeof AbortSignal.timeout==='function'?{signal:AbortSignal.timeout(15000)}:{};
    const hojeLocal=new Date(), inicio=new Date(hojeLocal);inicio.setDate(inicio.getDate()-180);
    const dataBR=d=>[d.getDate(),d.getMonth()+1,d.getFullYear()].map((n,i)=>i<2?String(n).padStart(2,'0'):String(n)).join('/');
    const limite=`${hojeLocal.getFullYear()}-${String(hojeLocal.getMonth()+1).padStart(2,'0')}-${String(hojeLocal.getDate()).padStart(2,'0')}`;
    const respostas=await Promise.allSettled(SERIES_INDICES.map(s=>fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s.serie}/dados?formato=json&dataInicial=${dataBR(inicio)}&dataFinal=${dataBR(hojeLocal)}`,opcoes).then(r=>{if(!r.ok)throw Error(r.status);return r.json();})));
    respostas.forEach((r,i)=>{const itens=r.status==='fulfilled'&&Array.isArray(r.value)?r.value:[];const validos=itens.filter(x=>/^\d{2}\/\d{2}\/\d{4}$/.test(x.data||'')&&x.data.split('/').reverse().join('-')<=limite);const v=validos.at(-1);if(v?.data && v?.valor!==undefined){dados[SERIES_INDICES[i].chave]={data:String(v.data),valor:String(v.valor),fonte:'Banco Central'};atualizados++;}});
    if(atualizados){indicesV11={dados,atualizadoEm:new Date().toISOString()};try{localStorage.setItem('crm_indices_v11',JSON.stringify(indicesV11));}catch(e){}}
    else if(!indicesV11) {
      try{const r=await fetch('indices.json',{cache:'no-cache'});if(r.ok){const publico=await r.json();if(publico?.dados)indicesV11=publico;}}catch(e){}
    }
    const painel=document.getElementById('indices-v11');if(painel)painel.innerHTML=painelIndices();
    toast(atualizados===SERIES_INDICES.length?'Índices atualizados.':atualizados?'Atualização parcial; confira as datas.':'Sem conexão com a fonte; confira a data dos últimos valores.');
  }
  renderSimuladoresV5=function(main) {
    antigoSimulador(main);
    main.insertAdjacentHTML('afterbegin','<div id="indices-v11">'+painelIndices()+'</div>');
    const financiamento=document.getElementById('fv5-resultado');
    if(financiamento) {
      financiamento.insertAdjacentHTML('beforebegin',`<div class="notice">A taxa anual é uma estimativa informada por você. TR, IPCA e outros indexadores podem alterar parcelas e saldo; consulte o banco para o CET e condições reais.</div><div class="actions">${acao('copiar-simulacao','','Copiar resumo')} ${acao('imprimir-simulacao','','Imprimir / PDF')}</div>`);
      const imovel=document.getElementById('fv5-imovel');
      imovel?.addEventListener('change',()=>{const i=imovelV5(imovel.value);if(i?.valorVenda){document.getElementById('fv5-valor').value=i.valorVenda;calcularFinanciamentoV5();}});
    }
    const investimento=document.getElementById('inv5-resultado');
    if(investimento) {
      investimento.insertAdjacentHTML('beforebegin',`<div class="form-grid">${fG('Taxa anual do financiamento (%)',fInput('inv5-juros-fin','',{percent:true}))}${fG('Prazo do financiamento (meses)',fInput('inv5-prazo-fin','',{type:'number'}))}${fG('Comparar capital com',`<select id="inv5-referencia"><option value="">Sem comparação</option><option value="selic">Meta Selic</option><option value="cdi">CDI</option></select>`)}</div><div class="notice">Se houver financiamento, informe taxa e prazo para calcular os pagamentos e o saldo devedor.</div><div class="actions">${acao('copiar-simulacao','','Copiar resumo')} ${acao('imprimir-simulacao','','Imprimir / PDF')}</div>`);
      ['inv5-juros-fin','inv5-prazo-fin','inv5-referencia'].forEach(id=>{const el=document.getElementById(id);el?.addEventListener('input',calcularInvestimentoV5);el?.addEventListener('change',calcularInvestimentoV5);});
      const imovel=document.getElementById('inv5-imovel');imovel?.addEventListener('change',()=>{const i=imovelV5(imovel.value);if(i?.valorVenda){document.getElementById('inv5-preco').value=i.valorVenda;calcularInvestimentoV5();}});
    }
    if(!indicesV11?.atualizadoEm || Date.now()-new Date(indicesV11.atualizadoEm).getTime()>86400000) atualizarIndices();
  };
  calcularFinanciamentoV5=function() {
    antigoCalculoFinanciamento();
    const el=document.getElementById('fv5-resultado'), seletor=document.getElementById('fv5-sistema');
    if(!el||!seletor)return;
    const escolhido=seletor.value, atual=dadosFinanciamentoV5();
    if(atual.entrada>atual.valor)return;
    seletor.value=escolhido==='SAC'?'PRICE':'SAC'; const outro=dadosFinanciamentoV5(); seletor.value=escolhido;
    el.insertAdjacentHTML('beforeend',`<div class="card"><b>Comparação com ${escHtml(outro.sistema)}</b><div class="entity-meta">Primeira parcela: ${moeda(outro.parcelaInicial)} · última parcela: ${moeda(outro.parcelaFinal)} · custo estimado: ${moeda(outro.total)}</div></div>`);
  };
  dadosInvestimentoV5=function() {
    const preco=parseMoney(locVal('inv5-preco')),entrada=parseMoney(locVal('inv5-entrada')),custosPct=parsePercentual(locVal('inv5-custos')),reforma=parseMoney(locVal('inv5-reforma')),aluguel=parseMoney(locVal('inv5-aluguel')),vac=parsePercentual(locVal('inv5-vacancia'))/100,despesas=parseMoney(locVal('inv5-despesas')),val=parsePercentual(locVal('inv5-valorizacao'))/100,anos=Math.max(1,Math.round(parseNumeroBR(locVal('inv5-anos'))||1));
    const principal=Math.max(0,preco-entrada), taxa=parsePercentual(locVal('inv5-juros-fin'))/100, meses=Math.round(parseNumeroBR(locVal('inv5-prazo-fin'))||0), capital=entrada+preco*custosPct/100+reforma;
    const liquidoMes=aluguel*(1-vac)-despesas,liquidoAno=liquidoMes*12,valorFuturo=preco*Math.pow(1+val,anos);
    if(preco<=0 || entrada<0 || entrada>preco || custosPct<0 || reforma<0 || aluguel<0 || vac<0 || vac>1 || despesas<0 || val<=-1 || taxa<0 || (principal>0 && (!meses || meses<0 || !locVal('inv5-juros-fin')))) return {incompleto:true,entrada,preco};
    const taxaMes=Math.pow(1+taxa,1/12)-1, parcela=principal?(taxaMes?principal*taxaMes/(1-Math.pow(1+taxaMes,-meses)):principal/meses):0;
    const pagos=Math.min(anos*12,meses), saldo=principal?(taxaMes?principal*Math.pow(1+taxaMes,pagos)-parcela*(Math.pow(1+taxaMes,pagos)-1)/taxaMes:principal-parcela*pagos):0;
    const ganho=liquidoAno*anos-parcela*pagos+valorFuturo-Math.max(0,saldo)-capital;
    const roi=capital?ganho/capital*100:0,capRate=preco?liquidoAno/preco*100:0,cash=capital?(liquidoAno-parcela*12)/capital*100:0,payback=(liquidoAno-parcela*12)>0?capital/(liquidoAno-parcela*12):Infinity;
    return {preco,entrada,custosPct,reforma,aluguel,vac,despesas,val,anos,capital,liquidoMes,liquidoAno,valorFuturo,ganho,roi,capRate,cash,payback,principal,taxa,meses,parcela,saldo:Math.max(0,saldo)};
  };
  calcularInvestimentoV5=function() {
    const d=dadosInvestimentoV5(),el=document.getElementById('inv5-resultado');if(!el)return;
    if(d.incompleto){setSafeHTML(el,'<div class="notice">Confira a entrada e informe taxa e prazo se houver financiamento.</div>');return;}
    const ref=locVal('inv5-referencia'), indice=indicesV11?.dados?.[ref], num=indice?Number(indice.valor):NaN;
    const taxaRef=ref==='selic'?num/100:ref==='cdi'?Math.pow(1+num/100,252)-1:NaN;
    const comparacao=ref && Number.isFinite(taxaRef)?`<div class="notice">Referência ${ref==='selic'?'Meta Selic':'CDI anualizado'}: capital projetado em ${d.anos} ano(s) = ${moeda(d.capital*Math.pow(1+taxaRef,d.anos))}. Supõe índice constante; não inclui impostos, custos ou mudanças futuras. Dado de ${escHtml(indice.data)}.</div>`:ref?'<div class="notice">Referência indisponível. Atualize os índices.</div>':'';
    setSafeHTML(el,`<div class="result-grid"><div class="result-box"><small>Renda líquida mensal antes do financiamento</small><b>${moeda(d.liquidoMes)}</b></div><div class="result-box"><small>Parcela estimada</small><b>${moeda(d.parcela)}</b></div><div class="result-box"><small>Saldo devedor no período</small><b>${moeda(d.saldo)}</b></div><div class="result-box"><small>Valor futuro estimado</small><b>${moeda(d.valorFuturo)}</b></div><div class="result-box"><small>Retorno no período</small><b>${d.roi.toFixed(2)}%</b></div><div class="result-box"><small>Retorno anual sobre capital</small><b>${d.cash.toFixed(2)}%</b></div></div>${comparacao}<div class="notice">Estimativa com parcelas Price constantes e projeções informadas. Não inclui impostos de venda, indexadores variáveis ou garantia de renda e valorização.</div>`);
  };
  const salvarFinanciamentoAnterior=salvarFinanciamentoV5;
  salvarFinanciamentoV5=function(){const antes=state.simulacoesFinanciamento.length;salvarFinanciamentoAnterior();if(state.simulacoesFinanciamento.length>antes){const item=state.simulacoesFinanciamento.at(-1);item.indicesReferencia=indicesV11?JSON.parse(JSON.stringify(indicesV11)):null;salvar(state,{silencioso:true});}};
  salvarInvestimentoV5=function(){const d=dadosInvestimentoV5();if(!d.preco||d.incompleto)return toast('Confira os dados da simulação.');state.simulacoesInvestimento.push({id:uid(),imovelId:locVal('inv5-imovel'),pessoaId:locVal('inv5-pessoa'),...d,referencia:locVal('inv5-referencia'),indicesReferencia:indicesV11?JSON.parse(JSON.stringify(indicesV11)):null,criadoEm:hoje()});if(!salvar(state))return;render();toast('Simulação de investimento salva.');};

  document.addEventListener('click', e=>{
    const botao=e.target.closest('[data-crm-acao]'); if(!botao)return;
    e.preventDefault(); const id=botao.dataset.id, cmd=botao.dataset.crmAcao;
    if(cmd==='aba-clientes')irPaginaV5('clientes');
    else if(cmd==='aba-pessoas')irPaginaV5('pessoas');
    else if(cmd==='fila')abrirAcompanhamento(id);
    else if(cmd==='abrir-cliente')abrirDashboardLead(id);
    else if(cmd==='contato')abrirInteracao(id);
    else if(cmd==='rel-procura'){abaRelatorio='procura';render();}
    else if(cmd==='rel-acomp'){abaRelatorio='acompanhamento';filtroAcompanhamento='todos';render();}
    else if(cmd==='alternar-relatorio'){relatorioCompleto=!relatorioCompleto;render();}
    else if(cmd==='imoveis-compativeis')imoveisParaCliente(id);
    else if(cmd==='clientes-imovel')clientesParaImovel(id);
    else if(cmd==='imovel')abrirFormImovelV5(id);
    else if(cmd==='nova-comissao')abrirFormComissaoV5();
    else if(cmd==='editar-comissao')abrirFormComissaoV5(id);
    else if(cmd==='receber-comissao')receberComissao(id);
    else if(cmd==='comissao-cliente')abrirFormComissaoV5('',id);
    else if(cmd==='atualizar-indices')atualizarIndices();
    else if(cmd==='copiar-simulacao')copiarTextoV10(resumoSimulacao(),'Resumo copiado.');
    else if(cmd==='imprimir-simulacao'){
      const janela=window.open('','_blank');
      if(!janela)return toast('Permita pop-ups para imprimir a simulação.');
      const texto=resumoSimulacao();
      janela.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Simulação</title></head><body><h1>Simulação imobiliária</h1><p>Gerada em '+escHtml(new Date().toLocaleString('pt-BR'))+'</p><div style="white-space:pre-wrap;font-family:Arial,sans-serif">'+escHtml(texto)+'</div></body></html>');
      janela.document.close();janela.print();
    }
    else if(cmd==='salvar-filtro'){try{localStorage.setItem('crm_filtro_procura_v11',JSON.stringify(filtrosRelatorioProcuraV12));toast('Filtros salvos neste navegador.');}catch(err){toast('Não foi possível salvar os filtros.');}}
    else if(cmd==='carregar-filtro'){try{const f=JSON.parse(localStorage.getItem('crm_filtro_procura_v11')||'null');if(!f)return toast('Nenhum filtro salvo.');Object.assign(filtrosRelatorioProcuraV12,f);render();}catch(err){toast('Não foi possível carregar os filtros.');}}
  });
  function resumoSimulacao(){
    const financiamento=!!document.getElementById('fv5-resultado');
    const campos=financiamento?[['Valor do imóvel','fv5-valor'],['Entrada','fv5-entrada'],['Taxa anual (%)','fv5-taxa'],['Prazo em meses','fv5-meses'],['Sistema','fv5-sistema'],['Seguro mensal','fv5-seguro'],['Taxas iniciais','fv5-custos']]:[['Valor do imóvel','inv5-preco'],['Capital próprio','inv5-entrada'],['Aluguel mensal','inv5-aluguel'],['Horizonte em anos','inv5-anos'],['Taxa anual do financiamento','inv5-juros-fin'],['Prazo do financiamento','inv5-prazo-fin']];
    const linhas=campos.map(([label,id])=>label+': '+(document.getElementById(id)?.value||'—'));
    const el=document.getElementById('fv5-resultado')||document.getElementById('inv5-resultado');
    return (financiamento?'SIMULAÇÃO DE FINANCIAMENTO':'SIMULAÇÃO DE INVESTIMENTO')+'\n'+linhas.join('\n')+'\n\n'+(el?.innerText||'Sem resultado.');
  }
  document.addEventListener('change', e=>{if(e.target.dataset.crmFiltro==='acompanhamento'){filtroAcompanhamento=e.target.value;render();}});
  ['c-etapa-locacao','c-proposta-enviada-em'].forEach(id=>{const campo=document.getElementById(id);if(campo?.closest('.form-group'))campo.closest('.form-group').style.display='none';});
  render();
})();
