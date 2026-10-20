/* ═══════════ RESUMO DA SEMANA — Gastos da Casa (20/10/2026) ═══════════
   Toda semana (segunda a domingo que acabou), diz onde o dinheiro mais
   vazou e o que fazer na semana que começa. Usado em dois lugares:
     · cartão no topo da tela inicial do app (index.html)
     · seção "Semana passada" do relatório completo (relatorio-gastos.html)

   "Vazou" = gastou mais do que o SEU normal naquele lugar. O normal é a
   média semanal das 12 semanas anteriores. Assim o que aparece é o que
   fugiu do padrão, não o que sempre custa caro (aluguel do mercado).

   Só lê os dados; não grava nada além de "fechei o cartão desta semana".
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  var NOMES = { carro:'Carro', diversos:'Diversos', mercado:'Supermercado', viagens:'Viagens' };
  var SUBS  = { gas:'Gasolina', oleo:'Óleo', div:'Diversos', 'gas-rr':'Gasolina (Range Rover)', 'gas-pilot':'Gasolina (Pilot)', pneu:'Pneu', pecas:'Peças', outros:'Outros' };
  var MESC = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var PEQ = 25, SEMANAS_BASE = 12;

  function iso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
  function dt(s){ return new Date(s+'T12:00:00') }
  function add(s,n){ var d=dt(s); d.setDate(d.getDate()+n); return iso(d) }
  function nd(a,b){ return Math.round((dt(b)-dt(a))/864e5)+1 }
  function fD(s){ var d=dt(s); return d.getDate()+' '+MESC[d.getMonth()] }
  function m0(n){ n=Math.round(+n||0); return (n<0?'-':'')+'CA$ '+String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}) }
  function addMeses(s,k){ var p=s.split('-'), a=+p[0], m=+p[1]-1+k, d=+p[2]; var na=a+Math.floor(m/12); m=((m%12)+12)%12;
    return na+'-'+String(m+1).padStart(2,'0')+'-'+String(Math.min(d,new Date(na,m+1,0).getDate())).padStart(2,'0') }
  function val(l){ return parseFloat(l.valor)||0 }
  function comum(l){ return l && l.data && !l.parcela && l.cat!=='parcelados' }
  function sub(l){
    if(l.cat==='mercado') return l.loja || 'Mercado sem loja';
    if(l.cat==='carro')   return l.sub ? (SUBS[l.sub]||l.sub) : 'Carro sem tipo';
    return l.divsub || (l.desc?String(l.desc).trim():'') || (NOMES[l.cat]||l.cat)+' sem tipo';
  }
  function limpo(s){ return String(s).replace(/^[^\wÀ-ÿ]+/,'').trim() }    // tira o emoji do começo
  function ehOutros(nome){ return /^outros$|sem (tipo|loja)$/i.test(limpo(nome)) }

  /* o ciclo do app que contém a data */
  function cicloDe(per, h){
    var k=0; while(h > addMeses(per.fim,k) && k<36) k++;
    while(h < addMeses(per.inicio,k) && k>-36) k--;
    return {inicio:addMeses(per.inicio,k), fim:addMeses(per.fim,k)};
  }

  function analisar(d, hoje){
    hoje = hoje || iso(new Date());
    var del = d.deleted_ids || [];
    var L = (d.lancamentos||[]).filter(function(l){ return comum(l) && del.indexOf(l.id)===-1 });
    if(!L.length) return null;
    var w = dt(hoje).getDay();                                   // 0=dom
    var seg = add(hoje, -((w+6)%7) - 7), dom = add(seg, 6);     // semana fechada mais recente
    var base0 = add(seg, -7*SEMANAS_BASE), primeiro = L.reduce(function(a,l){ return l.data<a?l.data:a }, hoje);
    var semBase = Math.max(1, Math.min(SEMANAS_BASE, Math.floor(nd(primeiro<base0?base0:primeiro, add(seg,-1))/7)));
    var iniBase = add(seg, -7*semBase);

    var per = d.periodo || {inicio:hoje.slice(0,8)+'01', fim:hoje.slice(0,8)+'28'};
    var cic = cicloDe(per, hoje), diasCic = nd(cic.inicio, cic.fim);
    var lim = +d.limite||0, orc = d.orcamentos||{};
    var alvoSem = lim*7/diasCic;

    var S = L.filter(function(l){ return l.data>=seg && l.data<=dom });
    var B = L.filter(function(l){ return l.data>=iniBase && l.data<seg });
    var tot = S.reduce(function(s,l){ return s+val(l) },0);
    var normalTot = B.reduce(function(s,l){ return s+val(l) },0)/semBase;

    /* por lugar: semana × normal */
    var m = {};
    function k(l){ return l.cat+'|'+limpo(sub(l)).toLowerCase() }
    S.forEach(function(l){ var x=m[k(l)]||(m[k(l)]={nome:sub(l), cat:l.cat, sem:0, n:0, base:0, nb:0}); x.sem+=val(l); x.n++ });
    B.forEach(function(l){ var x=m[k(l)]||(m[k(l)]={nome:sub(l), cat:l.cat, sem:0, n:0, base:0, nb:0}); x.base+=val(l); x.nb++ });
    var lugares = Object.keys(m).map(function(q){ var x=m[q]; x.normal=x.base/semBase; x.nNormal=x.nb/semBase; x.exc=x.sem-x.normal; return x });
    var vaz = lugares.filter(function(x){ return x.exc > Math.max(10, x.normal*.15) }).sort(function(a,b){ return b.exc-a.exc });

    /* por categoria: semana × orçamento semanal */
    var cats = Object.keys(NOMES).map(function(c){
      var s = S.filter(function(l){ return l.cat===c }).reduce(function(a,l){ return a+val(l) },0);
      var o = (+orc[c]||0)*7/diasCic;
      return {cat:c, nome:NOMES[c], sem:s, orcSem:o, exc:o? s-o : 0};
    }).filter(function(c){ return c.sem>0 || c.orcSem>0 });

    /* hábitos */
    var peq = S.filter(function(l){ return val(l)<PEQ }), peqT = peq.reduce(function(a,l){ return a+val(l) },0);
    var merc = S.filter(function(l){ return l.cat==='mercado' }).length;
    var mercNormal = B.filter(function(l){ return l.cat==='mercado' }).length/semBase;
    var dias = {}; S.forEach(function(l){ dias[l.data]=1 });
    var outros = S.filter(function(l){ return ehOutros(sub(l)) }).reduce(function(a,l){ return a+val(l) },0);
    var assin = lugares.filter(function(x){ return /subscri|assinat|netflix|spotify|disney|prime|apple/i.test(x.nome) && x.exc>5 })[0];

    /* ciclo atual */
    var noCic = L.filter(function(l){ return l.data>=cic.inicio && l.data<=hoje }).reduce(function(a,l){ return a+val(l) },0);
    var decor = nd(cic.inicio, hoje), resta = Math.max(0, diasCic-decor);
    var ideal = lim*decor/diasCic, livre = lim-noCic, porDia = resta? Math.max(0,livre)/resta : 0;

    /* ações: no máximo 4, da mais importante para a menos */
    var acoes = [];
    vaz.slice(0,2).forEach(function(x){
      var nome = limpo(x.nome);
      if(/restaur|lanche|caf[eé]|coffee|tim ?hortons|fast|pizza|delivery|uber ?eats|skip/i.test(nome))
        acoes.push('<b>'+esc(nome)+'</b>: '+x.n+' vezes na semana passada ('+m0(x.sem)+'). O seu normal é '+Math.max(1,Math.round(x.nNormal))+' por semana. Esta semana, no máximo <b>'+Math.max(1,Math.round(x.nNormal))+'</b>, com teto de <b>'+m0(x.normal)+'</b>.');
      else if(ehOutros(x.nome))
        acoes.push('<b>'+esc(nome)+' ('+NOMES[x.cat]+')</b> subiu para '+m0(x.sem)+'. Ao lançar, escolha a subcategoria certa: sem saber onde foi, não dá para cortar.');
      else
        acoes.push('<b>'+esc(nome)+'</b>: '+m0(x.sem)+' em '+x.n+(x.n===1?' compra':' compras')+', '+m0(x.exc)+' acima do seu normal. Teto para esta semana: <b>'+m0(Math.max(x.normal,0))+'</b>.');
    });
    if(lim>0 && resta>0){
      if(noCic>ideal) acoes.push('Ciclo '+fD(cic.inicio)+' – '+fD(cic.fim)+': '+m0(noCic-ideal)+' adiantado. Para fechar no limite, gaste no máximo <b>'+m0(porDia)+' por dia</b> nos próximos '+resta+' dias.');
      else acoes.push('Ciclo '+fD(cic.inicio)+' – '+fD(cic.fim)+': você tem '+m0(ideal-noCic)+' de folga. Dá para gastar até <b>'+m0(porDia)+' por dia</b> até o fim do ciclo e ainda fechar no limite.');
    }
    if(merc >= Math.round(mercNormal)+2) acoes.push('Foram <b>'+merc+' idas ao mercado</b> (normal: '+Math.round(mercNormal)+'). Junte as compras: lista pronta e 1 ou 2 idas na semana.');
    if(peq.length>=6 && (peqT>=60 || peqT>tot*.15)) acoes.push('<b>'+peq.length+' compras pequenas</b> (abaixo de CA$ '+PEQ+') somaram '+m0(peqT)+'. Antes de uma compra pequena por impulso, espere um dia.');
    if(outros>tot*.2 && outros>40 && !vaz.slice(0,2).some(function(x){ return ehOutros(x.nome) })) acoes.push(m0(outros)+' ('+Math.round(outros/tot*100)+'% da semana) foram lançados como <b>"Outros"</b>. Escolha a subcategoria ao lançar.');
    if(assin) acoes.push('<b>Assinaturas</b> subiram para '+m0(assin.sem)+'. Revise se todas ainda valem a pena.');
    if(Object.keys(dias).length>=6) acoes.push('Houve gasto em <b>'+Object.keys(dias).length+' dos 7 dias</b>. Marque 2 dias sem gasto nesta semana.');
    if(!acoes.length) acoes.push('Semana dentro do seu normal. Mantenha o ritmo.');

    return {seg:seg, dom:dom, semBase:semBase, tot:tot, n:S.length, normalTot:normalTot, alvoSem:alvoSem, lim:lim,
      vaz:vaz.slice(0,3), cats:cats, peq:peq.length, peqT:peqT, merc:merc, mercNormal:mercNormal, diasGasto:Object.keys(dias).length,
      outros:outros, ciclo:cic, noCic:noCic, ideal:ideal, resta:resta, porDia:porDia, acoes:acoes.slice(0,4)};
  }

  function status(r){
    var ref = r.alvoSem>0 ? r.alvoSem : r.normalTot;
    return r.tot>ref*1.05 ? 'bad' : r.tot<ref*.95 ? 'good' : 'mid';
  }

  /* cartão da tela inicial */
  function cartao(r){
    var st=status(r), cor = st==='bad'?'#dc2626':st==='good'?'#16a34a':'#b26b00';
    var ref = r.alvoSem>0 ? 'alvo '+m0(r.alvoSem) : 'seu normal '+m0(r.normalTot);
    var v = r.vaz[0];
    return '<div id="semCard" style="background:#fff;border-radius:16px;padding:14px 16px;margin:0 0 12px;box-shadow:0 2px 12px rgba(0,0,0,.06);border-left:5px solid '+cor+';position:relative">'+
      '<button type="button" id="semFechar" aria-label="Fechar" style="position:absolute;top:8px;right:8px;border:0;background:none;font-size:18px;color:#9ca3af;cursor:pointer;padding:4px 8px">×</button>'+
      '<div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:#6b7280;text-transform:uppercase">📌 Semana '+fD(r.seg)+' – '+fD(r.dom)+'</div>'+
      '<div style="font-size:20px;font-weight:800;margin:4px 0 2px;color:'+cor+'">'+m0(r.tot)+' <span style="font-size:13px;font-weight:600;color:#6b7280">· '+ref+'</span></div>'+
      (v? '<div style="font-size:13px;color:#374151;margin-top:4px">Maior vazamento: <b>'+esc(limpo(v.nome))+'</b>, '+m0(v.sem)+' (normal '+m0(v.normal)+')</div>' : '<div style="font-size:13px;color:#374151;margin-top:4px">Nenhum lugar fugiu do seu normal.</div>')+
      '<div style="font-size:13px;color:#374151;margin-top:6px">👉 '+r.acoes[0]+'</div>'+
      '<a href="./relatorio-gastos.html#semana" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:700;color:#1d4ed8;text-decoration:none">Ver todas as ações ›</a>'+
    '</div>';
  }
  function pintarCartao(d){
    var tela=document.getElementById('tela-inicio'); if(!tela) return;
    var alvo=tela.querySelector('.conteudo'); if(!alvo) return;
    var r=null; try{ r=analisar(d) }catch(e){ console.warn('semana:', e && e.message) }
    var velho=document.getElementById('semCard'); if(velho) velho.remove();
    if(!r || !r.n) return;
    var chave='sem_fechado';
    try{ if(localStorage.getItem(chave)===r.seg) return }catch(e){}
    alvo.insertAdjacentHTML('afterbegin', cartao(r));
    var b=document.getElementById('semFechar');
    if(b) b.onclick=function(){ try{ localStorage.setItem(chave, r.seg) }catch(e){} var c=document.getElementById('semCard'); if(c) c.remove() };
  }

  /* seção do relatório */
  function secao(r){
    if(!r) return '';
    var st=status(r); if(st==='mid') st='warn';
    var ref = r.alvoSem>0 ? 'Alvo da semana pelo limite: <b>'+m0(r.alvoSem)+'</b>' : 'Sem limite definido';
    var linhas = r.vaz.length ? r.vaz.map(function(x){
        return '<tr><td class="t"><b>'+esc(limpo(x.nome))+'</b> <span class="note">'+NOMES[x.cat]+'</span></td><td>'+m0(x.sem)+'</td><td>'+m0(x.normal)+'</td><td class="bad">+'+m0(x.exc)+'</td><td>'+x.n+'</td></tr>' }).join('')
      : '<tr><td class="t" colspan="5">Nenhum lugar ficou acima do seu normal.</td></tr>';
    var catsH = r.cats.filter(function(c){ return c.orcSem>0 }).map(function(c){
        return '<span style="margin-right:14px;white-space:nowrap">'+c.nome+': <b class="'+(c.exc>0?'bad':'good')+'">'+m0(c.sem)+'</b> / '+m0(c.orcSem)+'</span>' }).join('');
    return '<section class="card alvo" id="semana" style="border-left-color:'+(st==='bad'?'var(--bad)':st==='good'?'var(--good)':'var(--warn)')+'">'+
      '<div class="ch"><h2>Semana passada: '+fD(r.seg)+' – '+fD(r.dom)+'</h2><span class="note">"vazou" = acima do seu normal (média das '+r.semBase+' semanas anteriores)</span></div>'+
      '<p style="margin:0 0 6px">Gasto comum: <b class="'+st+'">'+m0(r.tot)+'</b> em '+r.n+' lançamentos · '+ref+' · Seu normal: '+m0(r.normalTot)+'</p>'+
      (catsH? '<p class="note" style="margin:0 0 10px">Categorias na semana × orçamento semanal: '+catsH+'</p>' : '')+
      '<div class="tw"><table><thead><tr><th>Onde mais vazou</th><th>Semana</th><th>Normal</th><th>A mais</th><th>Compras</th></tr></thead><tbody>'+linhas+'</tbody></table></div>'+
      '<h3 style="font-size:15px;margin:14px 0 4px">O que fazer nesta semana</h3><ol style="margin:4px 0 0">'+r.acoes.map(function(a){ return '<li>'+a+'</li>' }).join('')+'</ol>'+
    '</section>';
  }

  window.SemanaGastos = {analisar:analisar, cartao:cartao, pintarCartao:pintarCartao, secao:secao};
})();
