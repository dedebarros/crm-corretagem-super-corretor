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
  const antigoSalvarCliente = salvarCliente;
  const antigosResultados = itensBuscaGlobalV10;
  const antigosDadosProcura = dadosRelatorioProcuraV12;
  const moeda = n => 'R$ ' + fmtMoney(Number(n) || 0);
  const ativo = c => !['Fechado', 'Perdido'].includes(c.status);
  const ultimaNota = c => {
    let ultima=null, dataMaisRecente=-Infinity;
    for(const nota of (Array.isArray(c.historico)?c.historico:[])) {
      if(!nota || nota.auto || !String(nota.texto||'').trim())continue;
      const data=dataLocal(nota.data), tempo=data?data.getTime():-Infinity;
      if(!ultima || tempo>=dataMaisRecente){ultima=nota;dataMaisRecente=tempo;}
    }
    return ultima;
  };
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

  function dadosResumoAtendimento(c) {
    const perfil=c.perfilBusca||{}, legado=c.imovel||{}, fins=Array.isArray(c.finalidade)?c.finalidade:[], nota=ultimaNota(c);
    const procura=fins.some(f=>f==='Compra'||f==='Investimento') || (fins.includes('Aluguel') && c.papelAluguel!=='Locador');
    const oferta=fins.includes('Venda') || (fins.includes('Aluguel') && ['Locador','Ambos'].includes(c.papelAluguel));
    const vinculado=oferta && c.imovelId ? imovelV5(c.imovelId) : null;
    const operacoes=fins.map(f=>f==='Compra'?'Comprar':f==='Venda'?'Vender':f==='Aluguel'?(c.papelAluguel==='Locador'?'Alugar (oferta)':c.papelAluguel==='Ambos'?'Alugar (procura e oferta)':'Alugar'):f==='Investimento'?'Investir':f);
    const tipo=procura?(perfil.tipo||legado.tipo||''):(legado.tipo||vinculado?.tipo||perfil.tipo||'');
    const regiao=procura?(perfil.bairros||legado.bairro||perfil.cidade||''):(legado.bairro||vinculado?.bairro||perfil.bairros||perfil.cidade||'');
    const formatarValor=v=>{const n=parseMoney(v);return n>0?'R$ '+fmtMoney(n):String(v||'');};
    const valores=[];
    if(procura && perfil.valorMax)valores.push('Orçamento até '+formatarValor(perfil.valorMax));
    else if(procura && fins.includes('Aluguel') && c.custoLocacao)valores.push('Custo de locação informado: '+formatarValor(c.custoLocacao));
    const valorVenda=legado.valorPedido||vinculado?.valorVenda||'';
    if(fins.includes('Venda') && valorVenda)valores.push('Venda: '+formatarValor(valorVenda));
    const valorAluguel=legado.aluguel||vinculado?.aluguel||'';
    if(fins.includes('Aluguel') && ['Locador','Ambos'].includes(c.papelAluguel) && valorAluguel)valores.push('Aluguel: '+formatarValor(valorAluguel)+'/mês');
    if(!valores.length && perfil.valorMax)valores.push('Valor informado: '+formatarValor(perfil.valorMax));
    const valor=valores.join(' · ');
    const pagamento=[perfil.pagamento,c.garantiaLocacao?'Garantia: '+c.garantiaLocacao:''].filter(Boolean).join(' · ');
    const proximo=[c.proximaAcao||(c.proximaAcaoData?'Ação não informada':''),c.proximaAcaoData?fmtDataCurta(c.proximaAcaoData)+(c.proximaAcaoHora?' às '+c.proximaAcaoHora:''):''].filter(Boolean).join(' · ');
    const ultimoContato=nota?.data&&dataLocal(nota.data)?(/^\d{4}-\d{2}-\d{2}$/.test(String(nota.data))?fmtDataCurta(nota.data):fmtData(nota.data)):'';
    const detalhes=[perfil.observacoesNecessidade,perfil.indispensaveis].filter(Boolean);
    const descricao=detalhes.length?[...new Set(detalhes)].join(' · '):String(perfil.textoGrupo||'');
    return {finalidade:operacoes.join(' / '),tipo,regiao,valor,pagamento,urgencia:c.timing||'',quartos:perfil.quartos?perfil.quartos+' quarto(s)':'',pedido:String(c.oQuePediu||''),descricao,nota:nota?.texto||'',ultimoContato,proximo};
  }
  function resumoAtendimentoHtml(c,pessoaId='') {
    const r=dadosResumoAtendimento(c);
    const campo=(titulo,valor)=>`<div class="resumo-360-campo"><small>${titulo}</small><span>${escHtml(valor||'Não informado')}</span></div>`;
    const identificacao=pessoaId?`<div class="entity-meta"><b>${escHtml(c.codigoCadastro||'Atendimento')}</b> · ${escHtml(r.finalidade||'Finalidade não informada')}</div>`:'';
    const nota=String(r.nota||'');
    return `<section class="resumo-360-atendimento" data-crm-resumo-card data-cliente-id="${escAttr(c.id)}" data-pessoa-id="${escAttr(pessoaId)}">${identificacao}<div class="resumo-360-grade">${campo('Finalidade',r.finalidade)}${campo('Tipo / região',[r.tipo,r.regiao,r.quartos].filter(Boolean).join(' · '))}${campo('Valor / orçamento',r.valor)}${campo('Pagamento / garantia',r.pagamento)}${campo('Urgência',r.urgencia)}${campo('Último contato',r.ultimoContato)}${campo('Última anotação de contato',nota.length>180?nota.slice(0,180)+'…':nota)}${campo('Próximo passo',r.proximo)}${r.descricao?campo('Descrição da procura',r.descricao.length>180?r.descricao.slice(0,180)+'…':r.descricao):''}</div><div class="resumo-360-pedido"><label for="resumo-pedido-${escAttr(c.id)}"><b>O que ele pediu?</b></label><input id="resumo-pedido-${escAttr(c.id)}" data-crm-resumo-pedido maxlength="200" type="text" value="${escAttr(r.pedido)}" placeholder="Resuma o pedido ou dúvida em uma linha">${acao('salvar-pedido-resumo',c.id,'Salvar pedido','verde')} ${acao('contato',c.id,'Registrar contato')}</div></section>`;
  }
  function faixaResumo(atendimentos,pessoaId='') {
    return `<div class="resumo-360-fixo" aria-label="Resumo do atendimento"><h3>🎯 Resumo do atendimento</h3>${atendimentos.map(c=>resumoAtendimentoHtml(c,pessoaId)).join('')}</div>`;
  }
  function rascunhosPedido() {
    return Array.from(document.querySelectorAll('#modal-detalhe [data-crm-resumo-card]')).flatMap(painel=>{
      const campo=painel.querySelector('[data-crm-resumo-pedido]'),cliente=state.clientes.find(c=>c.id===painel.dataset.clienteId);
      return campo && cliente && campo.value.trim()!==String(cliente.oQuePediu||'')?[{id:cliente.id,pessoaId:painel.dataset.pessoaId||'',valor:campo.value}]:[];
    });
  }
  function restaurarRascunhosPedido(rascunhos) {
    const paineis=Array.from(document.querySelectorAll('#modal-detalhe [data-crm-resumo-card]'));
    rascunhos.forEach(r=>{const campo=paineis.find(p=>p.dataset.clienteId===r.id && (p.dataset.pessoaId||'')===r.pessoaId)?.querySelector('[data-crm-resumo-pedido]');if(campo)campo.value=r.valor;});
  }
  function atualizarFichaAposAlteracao(id,pessoaId,aba,rolagem) {
    const modal=document.getElementById('modal-detalhe'),atualizado=state.clientes.find(c=>c.id===id);
    if(!atualizado){fecharModal('modal-detalhe');return;}
    if(pessoaId && pessoaV5(pessoaId))abrirVisao360PessoaV5(pessoaId);
    else {detalheClienteAtual=atualizado;renderDetalhe(atualizado);}
    if(aba)Array.from(modal?.querySelectorAll('.tab-btn')||[]).find(b=>b.dataset.tab===aba)?.click();
    if(modal)modal.scrollTop=rolagem;
  }
  function salvarPedidoResumo(botao) {
    const painel=botao.closest('[data-crm-resumo-card]'),id=painel?.dataset.clienteId,pessoaId=painel?.dataset.pessoaId||'';
    const cliente=state.clientes.find(c=>c.id===id),campo=painel?.querySelector('[data-crm-resumo-pedido]');
    if(!cliente||!campo)return toast('Não foi possível localizar este atendimento.');
    const pedido=campo.value.trim();
    if(pedido===String(cliente.oQuePediu||''))return toast('O pedido já está salvo.');
    const anterior=cliente.oQuePediu,modal=document.getElementById('modal-detalhe'),aba=modal?.querySelector('.tab-btn.active')?.dataset.tab,rolagem=modal?.scrollTop||0;
    cliente.oQuePediu=pedido;
    const salvo=salvar(state);
    if(!salvo && state.clientes.find(c=>c.id===id)===cliente){cliente.oQuePediu=anterior;return;}
    if(salvo){
      if(!pessoaId)detalheClienteAtual=state.clientes.find(c=>c.id===id)||null;
      render();toast('Pedido atualizado.');return;
    }
    atualizarFichaAposAlteracao(id,pessoaId,aba,rolagem);
    const novoPainel=Array.from(document.querySelectorAll('#modal-detalhe [data-crm-resumo-card]')).find(el=>el.dataset.clienteId===id && (el.dataset.pessoaId||'')===pessoaId);
    const novoCampo=novoPainel?.querySelector('[data-crm-resumo-pedido]');
    if(novoCampo){
      novoCampo.value=pedido;
      const aviso=document.createElement('div');
      aviso.className='notice';
      aviso.textContent='O pedido digitado não foi salvo. Confira o cadastro atualizado e salve novamente se desejar. Valor atualmente salvo: '+(state.clientes.find(c=>c.id===id)?.oQuePediu||'não informado')+'.';
      novoPainel.appendChild(aviso);
    }
  }
  function faixaPipeline(c, pessoaId='') {
    const nomeAtendimento=pessoaId ? `<small class="entity-meta" style="display:block">${escHtml(c.codigoCadastro||'Atendimento')} · ${escHtml((c.finalidade||[]).join(', ')||c.nome)}</small>` : '';
    return `<div class="card" data-crm-pipeline-card data-cliente-id="${escAttr(c.id)}" data-pessoa-id="${escAttr(pessoaId)}" style="margin:10px 0;padding:14px"><b>Etapa no Pipeline</b>${nomeAtendimento}<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px"><select data-crm-pipeline-select aria-label="Etapa do Pipeline de ${escAttr(c.nome)}" style="flex:1;min-width:180px">${STATUS_LIST.map(s=>`<option value="${escAttr(s)}" ${s===c.status?'selected':''}>${escHtml(s)}</option>`).join('')}</select>${acao('salvar-etapa-pipeline',c.id,'Salvar etapa','verde')}</div></div>`;
  }
  function salvarEtapaNaFicha(botao) {
    const painel=botao.closest('[data-crm-pipeline-card]');
    const id=painel?.dataset.clienteId, pessoaId=painel?.dataset.pessoaId||'';
    const cliente=state.clientes.find(c=>c.id===id), novaEtapa=painel?.querySelector('[data-crm-pipeline-select]')?.value;
    if(!cliente || !STATUS_LIST.includes(novaEtapa))return toast('Não foi possível localizar o atendimento ou a etapa.');
    if(cliente.status===novaEtapa)return toast('O atendimento já está nessa etapa.');
    const modal=document.getElementById('modal-detalhe');
    const aba=modal?.querySelector('.tab-btn.active')?.dataset.tab;
    const rolagem=modal?.scrollTop||0;
    const rascunhos=rascunhosPedido();
    atualizarStatusCliente(id,novaEtapa,'ficha do cliente');
    atualizarFichaAposAlteracao(id,pessoaId,aba,rolagem);
    restaurarRascunhosPedido(rascunhos);
  }
  abrirVisao360PessoaV5 = function(id) {
    antigoDetalhePessoa(id);
    const corpo = document.getElementById('detalhe-body');
    const atendimentos=state.clientes.filter(c=>c.pessoaId===id);
    const fechados=state.clientes.filter(c=>c.pessoaId===id && c.status==='Fechado' && !state.comissoes.some(x=>x.clienteId===c.id||x.legacyClienteId===c.id));
    if(corpo && atendimentos.length) corpo.insertAdjacentHTML('afterbegin',faixaResumo(atendimentos,id)+atendimentos.map(c=>faixaPipeline(c,id)).join('')+fechados.map(c=>`<div class="notice">Negócio fechado: ${escHtml(c.nome)} · ${acao('comissao-cliente',c.id,'Preparar comissão')}</div>`).join(''));
    corpo?.querySelectorAll('.stat-card').forEach(el => { if (el.textContent.includes('Avaliações AVP')) el.remove(); });
    corpo?.querySelectorAll('.tab-btn').forEach(el => { if (el.textContent.includes('Busca / AVP')) el.textContent = 'Busca'; });
    corpo?.querySelectorAll('h4').forEach(el => { if (el.textContent.includes('Avaliações AVP')) { const section=el.parentElement; section?.querySelectorAll('[onclick*="abrirFormAvaliacaoV5"]').forEach(b=>b.closest('.owner-row')?.remove()); el.remove(); } });
    corpo?.querySelectorAll('[onclick*="abrirFormAvaliacaoV5"]').forEach(el => el.remove());
  };
  renderDetalhe = function(c) {
    antigoDetalheCliente(c);
    const corpo=document.getElementById('detalhe-body');
    corpo?.insertAdjacentHTML('afterbegin', faixaResumo([c])+faixaPipeline(c));
    corpo?.querySelectorAll('[onclick*="irParaLoc"],[onclick*="abrirFormContratoV5"],[onclick*="abrirFormAvaliacaoV5"]').forEach(el=>el.closest('.owner-row')?.remove() || el.remove());
  };
  salvarCliente=function() {
    const id=document.getElementById('cliente-id')?.value||'';
    const modal=document.getElementById('modal-detalhe'),aberto=modal?.classList.contains('show');
    const resumo=aberto?Array.from(modal.querySelectorAll('[data-crm-resumo-card]')).find(el=>el.dataset.clienteId===id):null;
    const pessoaId=resumo?.dataset.pessoaId||'',aba=modal?.querySelector('.tab-btn.active')?.dataset.tab,rolagem=modal?.scrollTop||0;
    antigoSalvarCliente();
    if(id && aberto && resumo && !document.getElementById('modal-cliente')?.classList.contains('show'))atualizarFichaAposAlteracao(id,pessoaId,aba,rolagem);
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
    const modal=document.getElementById('modal-detalhe'),aberto=modal?.classList.contains('show');
    const painel=aberto?Array.from(modal.querySelectorAll('[data-crm-resumo-card]')).find(el=>el.dataset.clienteId===c.id):null;
    const pessoaId=painel?.dataset.pessoaId||'',aba=modal?.querySelector('.tab-btn.active')?.dataset.tab,rolagem=modal?.scrollTop||0;
    const rascunhos=aberto?rascunhosPedido():[];
    c.historico=c.historico||[];
    c.historico.push({data:hoje(),texto: texto + (resultado ? ' · ' + resultado : ''),auto:false,resultado});
    c.ultimaInteracao=hoje(); c.proximaAcao=proxima; c.proximaAcaoData=data; c.proximaAcaoHora=hora; c.situacaoFollowup=resultado;
    if(!salvar(state)) return;
    fecharModal('modal-interacao');
    if(aberto && painel){atualizarFichaAposAlteracao(c.id,pessoaId,aba,rolagem);restaurarRascunhosPedido(rascunhos);}
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
    const r=dadosResumoAtendimento(c);
    const perfil=[r.finalidade,r.tipo,r.regiao,r.quartos,r.valor].filter(Boolean).join(' · ');
    const complementos=[r.pagamento,r.urgencia?'Prazo: '+r.urgencia:''].filter(Boolean).join(' · ');
    const descricao=r.descricao.length>200?r.descricao.slice(0,200)+'…':r.descricao;
    return `<tr><td><b>${escHtml(c.nome)}</b><br><small>${escHtml(c.status||'')}</small></td><td style="min-width:220px">${r.pedido?`<b>${escHtml(r.pedido)}</b><br>`:descricao?`<b>Descrição da procura:</b> ${escHtml(descricao)}<br>`:''}${escHtml(perfil||(!r.pedido&&!descricao?'Detalhes ainda não informados':''))}${complementos?`<br><small>${escHtml(complementos)}</small>`:''}</td><td>${escHtml(r.ultimoContato||'Data não registrada')}${r.nota?`<br><small>${escHtml(r.nota)}</small>`:''}</td><td>${escHtml(r.proximo||'Sem próxima ação')}</td><td><div class="entity-actions">${acao('abrir-cliente',c.id,'Abrir')}${acao('contato',c.id,'Registrar contato')}${c.whatsapp?'<a class="btn small" target="_blank" rel="noopener noreferrer" href="'+whatsappLink(c.whatsapp)+'">WhatsApp</a>':''}</div></td></tr>`;
  }
  function tabelaAcompanhamento(lista) {
    return `<div class="card" style="overflow:auto"><table><thead><tr><th>Cliente</th><th>Resumo do atendimento</th><th>Último contato</th><th>Próximo passo</th><th>Ações</th></tr></thead><tbody>${lista.map(linhaCliente).join('') || '<tr><td colspan="5">Nenhum atendimento encontrado.</td></tr>'}</tbody></table></div>`;
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

  const MODALIDADES_BANCARIAS = {
    mercado_tr:'Financiamento imobiliário com taxas de mercado - Pós-fixado referenciado em TR',
    regulado_tr:'Financiamento imobiliário com taxas reguladas - Pós-fixado referenciado em TR'
  };
  const URL_TAXAS_BCB='https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosMensalPorMes';
  let taxasBancarias=null, modalidadeBancaria='mercado_tr', referenciaSelecionada=null, comparacaoBancaria=false;
  try { taxasBancarias=JSON.parse(localStorage.getItem('crm_taxas_bancos_v11')||'null'); } catch(e) {}
  const taxaBR=n=>Number(n).toFixed(2).replace('.',',');
  const nomeBuscaBanco=n=>normalizarBuscaV10(n).replace(/\bbco\b/g,'banco');
  function validarGrupoBancario(grupo,chave) {
    if(!grupo || grupo.modalidade!==MODALIDADES_BANCARIAS[chave] || !/^\d{4}-(0[1-9]|1[0-2])$/.test(grupo.competencia||'') || grupo.competencia>competenciaAnterior(1) || !Array.isArray(grupo.bancos))return null;
    const bancos=grupo.bancos.filter(b=>typeof b.instituicao==='string' && b.instituicao.trim() && b.taxaAnual!==null && b.taxaAnual!=='' && b.taxaAnual!==undefined && Number.isFinite(Number(b.taxaAnual)) && Number(b.taxaAnual)>=0 && Number(b.taxaAnual)<1000).map(b=>({instituicao:String(b.instituicao),cnpj8:String(b.cnpj8||''),taxaAnual:Number(b.taxaAnual),taxaMensal:Number(b.taxaMensal)}));
    if(!bancos.length)return null;
    return {modalidade:grupo.modalidade,competencia:grupo.competencia,bancos,consultadoEm:grupo.consultadoEm||grupo.atualizadoEm||null};
  }
  function obterGrupoBancario(chave) { return validarGrupoBancario(taxasBancarias?.modalidades?.[chave],chave); }
  function painelTaxasBancos() {
    const grupo=obterGrupoBancario(modalidadeBancaria), bancos=grupo?.bancos||[];
    const consulta=grupo?.consultadoEm ? new Date(grupo.consultadoEm).toLocaleString('pt-BR') : taxasBancarias?.atualizadoEm ? new Date(taxasBancarias.atualizadoEm).toLocaleString('pt-BR') : '';
    const data=grupo ? grupo.competencia.split('-').reverse().join('/') : 'indisponível';
    return `<div class="card"><h3>Comparar taxas de bancos</h3><p class="entity-meta">Médias mensais de operações contratadas por pessoas físicas, publicadas pelo Banco Central. Não são ofertas personalizadas nem substituem o CET da proposta. A simulação abaixo não projeta a TR. As médias podem incluir encargos; somar custos separados pode repetir valores.</p><div class="filtros"><label>Modalidade <select id="tb-modalidade" data-crm-filtro="taxa-modalidade"><option value="mercado_tr" ${modalidadeBancaria==='mercado_tr'?'selected':''}>Mercado + TR</option><option value="regulado_tr" ${modalidadeBancaria==='regulado_tr'?'selected':''}>Regulada + TR</option></select></label><input id="tb-busca" placeholder="Pesquisar banco" aria-label="Pesquisar banco"> ${acao('atualizar-taxas-bancos','','Buscar e atualizar taxas')} ${acao('comparar-taxas-bancos','','Comparar parcelas')}</div><div class="entity-meta">Fonte: <a href="https://www.bcb.gov.br/estatisticas/txjuros?swcfpc=1" target="_blank" rel="noopener noreferrer">Banco Central</a> · competência: ${escHtml(data)}${consulta?' · consulta: '+escHtml(consulta):''}. ${grupo?'Os bancos não informados no período não aparecem.':'Consulte as taxas para carregar a tabela.'}</div><div style="overflow:auto"><table><thead><tr><th>Banco</th><th>Taxa média anual</th><th>Modalidade</th><th>Ação</th></tr></thead><tbody>${bancos.map((b,i)=>`<tr data-banco-nome="${escAttr(nomeBuscaBanco(b.instituicao))}"><td>${escHtml(b.instituicao)}</td><td>${taxaBR(b.taxaAnual)}% ao ano</td><td>${modalidadeBancaria==='mercado_tr'?'Mercado + TR':'Regulada + TR'}</td><td>${acao('usar-taxa-banco',String(i),'Usar na simulação')}</td></tr>`).join('')||'<tr><td colspan="4">Nenhuma taxa disponível para esta modalidade.</td></tr>'}</tbody></table></div><div id="tb-comparacao"></div></div>`;
  }
  function redesenharTaxasBancos() {
    const el=document.getElementById('taxas-bancos-v11'); if(!el)return;
    const pesquisa=document.getElementById('tb-busca')?.value||'';
    el.innerHTML=painelTaxasBancos();
    const campo=document.getElementById('tb-busca');if(campo){campo.value=pesquisa;filtrarBancos(pesquisa);}
    if(comparacaoBancaria)compararBancos();
  }
  function filtrarBancos(q) {
    const termo=nomeBuscaBanco(q);
    document.querySelectorAll('#taxas-bancos-v11 [data-banco-nome]').forEach(tr=>{tr.hidden=!tr.dataset.bancoNome.includes(termo);});
  }
  function competenciaAnterior(offset) {
    const hoje=new Date(),data=new Date(hoje.getFullYear(),hoje.getMonth()-offset,1);
    return data.getFullYear()+'-'+String(data.getMonth()+1).padStart(2,'0');
  }
  async function consultarModalidade(chave) {
    for(let offset=1;offset<=12;offset++){
      const competencia=competenciaAnterior(offset), filtro=`anoMes eq '${competencia}' and Modalidade eq '${MODALIDADES_BANCARIAS[chave]}'`;
      const params=new URLSearchParams({'$format':'json','$top':'1000','$filter':filtro});
      const opcoes=typeof AbortSignal!=='undefined' && typeof AbortSignal.timeout==='function'?{signal:AbortSignal.timeout(15000)}:{};
      const resposta=await fetch(URL_TAXAS_BCB+'?'+params.toString().replace(/\+/g,'%20'),opcoes);
      if(!resposta.ok)throw new Error('Banco Central indisponível');
      const resultado=await resposta.json();
      if(!Array.isArray(resultado.value))throw new Error('Resposta inesperada');
      if(resultado['@odata.nextLink'])throw new Error('A resposta exige paginação; tabela anterior preservada');
      const bancos=resultado.value.filter(x=>x.anoMes===competencia && x.Modalidade===MODALIDADES_BANCARIAS[chave]).map(x=>({instituicao:x.InstituicaoFinanceira,cnpj8:x.cnpj8,taxaAnual:x.TaxaJurosAoAno,taxaMensal:x.TaxaJurosAoMes}));
      const grupo=validarGrupoBancario({modalidade:MODALIDADES_BANCARIAS[chave],competencia,bancos,consultadoEm:new Date().toISOString()},chave);
      if(grupo)return grupo;
    }
    throw new Error('Nenhum dado recente para a modalidade');
  }
  async function carregarTabelaPublica() {
    try {
      const r=await fetch('taxas-bancarias.json',{cache:'no-cache'});if(!r.ok)return false;
      const arquivo=await r.json(),modalidades={...(taxasBancarias?.modalidades||{})}; let adicionados=0;
      for(const chave of Object.keys(MODALIDADES_BANCARIAS)){
        const novo=validarGrupoBancario(arquivo?.modalidades?.[chave],chave),atual=validarGrupoBancario(modalidades[chave],chave);
        if(novo&&(!atual||novo.competencia>atual.competencia||(novo.competencia===atual.competencia && String(novo.consultadoEm||arquivo.atualizadoEm||'')>String(atual.consultadoEm||taxasBancarias?.atualizadoEm||'')))){modalidades[chave]=novo;adicionados++;}
      }
      if(adicionados){taxasBancarias={modalidades,atualizadoEm:arquivo.atualizadoEm};redesenharTaxasBancos();}
      return adicionados>0;
    }catch(e){return false;}
  }
  async function atualizarTaxasBancarias() {
    const botao=document.querySelector('[data-crm-acao="atualizar-taxas-bancos"]');if(botao){botao.disabled=true;botao.textContent='Consultando Banco Central…';}
    const chaves=Object.keys(MODALIDADES_BANCARIAS),respostas=await Promise.allSettled(chaves.map(consultarModalidade));
    const modalidades={...(taxasBancarias?.modalidades||{})};let sucesso=0;
    respostas.forEach((r,i)=>{if(r.status==='fulfilled'){modalidades[chaves[i]]=r.value;sucesso++;}});
    if(sucesso){taxasBancarias={modalidades,atualizadoEm:new Date().toISOString()};try{localStorage.setItem('crm_taxas_bancos_v11',JSON.stringify(taxasBancarias));}catch(e){}}
    if(sucesso<chaves.length)await carregarTabelaPublica();
    redesenharTaxasBancos();
    toast(sucesso===chaves.length?'Taxas atualizadas conforme os últimos dados publicados.':sucesso?'Atualização parcial; confira cada competência.':'Consulta indisponível. A última tabela disponível foi preservada.');
  }
  function usarTaxaBanco(indice) {
    const grupo=obterGrupoBancario(modalidadeBancaria),banco=grupo?.bancos[Number(indice)],campo=document.getElementById('fv5-taxa');if(!banco||!campo)return;
    const aplicada=Number(banco.taxaAnual).toFixed(2);
    campo.value=aplicada;
    referenciaSelecionada={fonte:'Banco Central',instituicao:banco.instituicao,cnpj8:banco.cnpj8,modalidade:grupo.modalidade,competencia:grupo.competencia,consultadoEm:grupo.consultadoEm,indexador:'TR',taxaOriginal:banco.taxaAnual,taxaAplicada:Number(aplicada)};
    atualizarReferenciaEscolhida();calcularFinanciamentoV5();
    document.getElementById('fv5-resultado')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function atualizarReferenciaEscolhida() {
    const el=document.getElementById('fv5-referencia-banco');if(!el)return;
    el.textContent=referenciaSelecionada ? `Referência: ${referenciaSelecionada.instituicao} · ${referenciaSelecionada.competencia} · ${referenciaSelecionada.modalidade}. Taxa arredondada para duas casas; a TR não é projetada.` : 'Taxa informada manualmente; confirme as condições com o banco.';
  }
  function compararBancos() {
    const area=document.getElementById('tb-comparacao'),grupo=obterGrupoBancario(modalidadeBancaria),campo=document.getElementById('fv5-taxa');if(!area||!campo)return;
    const anterior=campo.value, busca=nomeBuscaBanco(document.getElementById('tb-busca')?.value||'');
    const bancos=(grupo?.bancos||[]).filter(x=>nomeBuscaBanco(x.instituicao).includes(busca));
    const linhas=bancos.map(b=>{campo.value=Number(b.taxaAnual).toFixed(2);const d=dadosFinanciamentoV5();return {b,d};});campo.value=anterior;
    if(linhas.some(x=>x.d.valor<=0||x.d.entrada<0||x.d.entrada>x.d.valor||x.d.seguro<0||x.d.custos<0)){area.innerHTML='<div class="notice">Confira o valor do imóvel, a entrada e os custos antes de comparar.</div>';return;}
    area.innerHTML=`<div class="notice">Mesma entrada, prazo, seguro e sistema da simulação. Valores indicativos: não incluem projeção de TR e não são propostas nem CET.</div><table><thead><tr><th>Banco</th><th>Taxa média anual</th><th>Parcela inicial estimada</th><th>Parcela final estimada</th><th>Total estimado</th></tr></thead><tbody>${linhas.map(({b,d})=>`<tr><td>${escHtml(b.instituicao)}</td><td>${taxaBR(b.taxaAnual)}%</td><td>${moeda(d.parcelaInicial)}</td><td>${moeda(d.parcelaFinal)}</td><td>${moeda(d.total)}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum banco encontrado.</td></tr>'}</tbody></table>`;
  }
  renderSimuladoresV5=function(main) {
    referenciaSelecionada=null;comparacaoBancaria=false;
    antigoSimulador(main);
    main.insertAdjacentHTML('afterbegin','<div id="indices-v11">'+painelIndices()+'</div>');
    const financiamento=document.getElementById('fv5-resultado');
    if(financiamento) {
      financiamento.insertAdjacentHTML('beforebegin',`<div id="taxas-bancos-v11">${painelTaxasBancos()}</div><div class="form-grid">${fG('Banco da proposta (opcional)',fInput('fv5-banco-proposta',''),'two')}${fG('Indexador da proposta',`<select id="fv5-indexador"><option value="">Não informado</option><option>TR</option><option>IPCA</option><option>CDI</option><option>Prefixado</option></select>`)}${fG('CET anual da proposta (%)',fInput('fv5-cet','',{percent:true}))}${fG('Data da proposta',fInput('fv5-data-proposta','',{type:'date'}))}</div><div id="fv5-referencia-banco" class="entity-meta"></div><div class="notice">O CET é apenas registrado; não é usado como taxa de juros no cálculo. A simulação não projeta a TR, IPCA ou outros indexadores e não representa proposta bancária.</div><div class="actions">${acao('copiar-simulacao','','Copiar resumo')} ${acao('imprimir-simulacao','','Imprimir / PDF')}</div>`);
      atualizarReferenciaEscolhida();
      const taxa=document.getElementById('fv5-taxa');
      taxa?.addEventListener('input',()=>{referenciaSelecionada=null;atualizarReferenciaEscolhida();});
      ['fv5-valor','fv5-entrada','fv5-meses','fv5-seguro','fv5-custos','fv5-sistema'].forEach(id=>{const el=document.getElementById(id);el?.addEventListener('input',()=>{if(comparacaoBancaria)compararBancos();});el?.addEventListener('change',()=>{if(comparacaoBancaria)compararBancos();});});
      const imovel=document.getElementById('fv5-imovel');
      imovel?.addEventListener('change',()=>{const i=imovelV5(imovel.value);if(i?.valorVenda){document.getElementById('fv5-valor').value=i.valorVenda;calcularFinanciamentoV5();}});
      const salvos=financiamento.closest('.card')?.nextElementSibling;
      salvos?.querySelectorAll('.owner-row').forEach((row,i)=>{
        const s=state.simulacoesFinanciamento.slice(-8).reverse()[i];if(!s)return;
        const detalhes=[s.propostaBanco,s.indexador?'Indexador: '+s.indexador:'',s.propostaCET?'CET informado: '+s.propostaCET+'%':'',s.propostaData?'Proposta: '+fmtDataCurta(s.propostaData):'',s.referenciaBanco?'Média BCB '+s.referenciaBanco.competencia+' · '+s.referenciaBanco.modalidade:''].filter(Boolean);
        if(detalhes.length)row.insertAdjacentHTML('beforeend',`<small class="entity-meta">${escHtml(detalhes.join(' · '))}</small>`);
      });
      carregarTabelaPublica();
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
    const campoTaxa=document.getElementById('fv5-taxa'),el=document.getElementById('fv5-resultado');
    if(!campoTaxa||!el)return;
    const valor=parseMoney(locVal('fv5-valor')),entrada=parseMoney(locVal('fv5-entrada')),meses=Number(locVal('fv5-meses')),taxa=Number(campoTaxa.value),seguro=parseMoney(locVal('fv5-seguro')),custos=parseMoney(locVal('fv5-custos'));
    if(valor<=0||entrada<0||entrada>valor||!campoTaxa.value.trim()||!Number.isFinite(taxa)||taxa<0||!Number.isInteger(meses)||meses<1||seguro<0||custos<0){setSafeHTML(el,'<div class="notice">Confira valor, entrada, taxa, prazo e custos antes de simular.</div>');return;}
    antigoCalculoFinanciamento();
    const seletor=document.getElementById('fv5-sistema');
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
  salvarFinanciamentoV5=function(){
    const d=dadosFinanciamentoV5(),taxa=Number(locVal('fv5-taxa')),cet=locVal('fv5-cet');
    if(!d.valor||d.entrada<0||d.entrada>d.valor||!locVal('fv5-taxa')||!Number.isFinite(taxa)||taxa<0||!Number.isInteger(Number(locVal('fv5-meses')))||Number(locVal('fv5-meses'))<1||d.seguro<0||d.custos<0)return toast('Revise valor, entrada, taxa, prazo e custos.');
    if(cet && (parsePercentual(cet)<0 || parsePercentual(cet)>1000))return toast('Confira o CET informado.');
    state.simulacoesFinanciamento.push({id:uid(),imovelId:locVal('fv5-imovel'),pessoaId:locVal('fv5-pessoa'),...d,propostaBanco:locVal('fv5-banco-proposta'),propostaCET:cet,propostaData:locVal('fv5-data-proposta'),indexador:locVal('fv5-indexador'),referenciaBanco:referenciaSelecionada?{...referenciaSelecionada}:null,indicesReferencia:indicesV11?JSON.parse(JSON.stringify(indicesV11)):null,criadoEm:hoje()});
    if(!salvar(state))return;render();toast('Simulação de financiamento salva.');
  };
  salvarInvestimentoV5=function(){const d=dadosInvestimentoV5();if(!d.preco||d.incompleto)return toast('Confira os dados da simulação.');state.simulacoesInvestimento.push({id:uid(),imovelId:locVal('inv5-imovel'),pessoaId:locVal('inv5-pessoa'),...d,referencia:locVal('inv5-referencia'),indicesReferencia:indicesV11?JSON.parse(JSON.stringify(indicesV11)):null,criadoEm:hoje()});if(!salvar(state))return;render();toast('Simulação de investimento salva.');};

  document.addEventListener('click', e=>{
    const botao=e.target.closest('[data-crm-acao]'); if(!botao)return;
    e.preventDefault(); const id=botao.dataset.id, cmd=botao.dataset.crmAcao;
    if(cmd==='aba-clientes')irPaginaV5('clientes');
    else if(cmd==='aba-pessoas')irPaginaV5('pessoas');
    else if(cmd==='fila')abrirAcompanhamento(id);
    else if(cmd==='abrir-cliente')abrirDashboardLead(id);
    else if(cmd==='contato')abrirInteracao(id);
    else if(cmd==='salvar-pedido-resumo')salvarPedidoResumo(botao);
    else if(cmd==='salvar-etapa-pipeline')salvarEtapaNaFicha(botao);
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
    else if(cmd==='atualizar-taxas-bancos')atualizarTaxasBancarias();
    else if(cmd==='usar-taxa-banco')usarTaxaBanco(id);
    else if(cmd==='comparar-taxas-bancos'){comparacaoBancaria=true;compararBancos();}
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
    const campos=financiamento?[['Banco','fv5-banco-proposta'],['Indexador','fv5-indexador'],['CET informado (%)','fv5-cet'],['Data da proposta','fv5-data-proposta'],['Valor do imóvel','fv5-valor'],['Entrada','fv5-entrada'],['Taxa anual (%)','fv5-taxa'],['Prazo em meses','fv5-meses'],['Sistema','fv5-sistema'],['Seguro mensal','fv5-seguro'],['Taxas iniciais','fv5-custos']]:[['Valor do imóvel','inv5-preco'],['Capital próprio','inv5-entrada'],['Aluguel mensal','inv5-aluguel'],['Horizonte em anos','inv5-anos'],['Taxa anual do financiamento','inv5-juros-fin'],['Prazo do financiamento','inv5-prazo-fin']];
    const linhas=campos.map(([label,id])=>label+': '+(document.getElementById(id)?.value||'—'));
    const el=document.getElementById('fv5-resultado')||document.getElementById('inv5-resultado');
    const referencia=financiamento && referenciaSelecionada ? '\nTaxa de referência: '+referenciaSelecionada.instituicao+' · '+referenciaSelecionada.competencia+' · '+referenciaSelecionada.modalidade+' · Banco Central. TR não projetada.' : '';
    return (financiamento?'SIMULAÇÃO DE FINANCIAMENTO':'SIMULAÇÃO DE INVESTIMENTO')+'\n'+linhas.join('\n')+referencia+'\n\n'+(el?.innerText||'Sem resultado.');
  }
  document.addEventListener('change', e=>{
    if(e.target.dataset.crmFiltro==='acompanhamento'){filtroAcompanhamento=e.target.value;render();}
    else if(e.target.dataset.crmFiltro==='taxa-modalidade' && MODALIDADES_BANCARIAS[e.target.value]){modalidadeBancaria=e.target.value;comparacaoBancaria=false;redesenharTaxasBancos();}
  });
  document.addEventListener('input',e=>{if(e.target.id==='tb-busca'){filtrarBancos(e.target.value);if(comparacaoBancaria)compararBancos();}});
  document.addEventListener('keydown',e=>{if(e.key==='Enter' && e.target.matches?.('[data-crm-resumo-pedido]')){e.preventDefault();e.target.closest('[data-crm-resumo-card]')?.querySelector('[data-crm-acao="salvar-pedido-resumo"]')?.click();}});
  ['c-etapa-locacao','c-proposta-enviada-em'].forEach(id=>{const campo=document.getElementById(id);if(campo?.closest('.form-group'))campo.closest('.form-group').style.display='none';});
  render();
})();
