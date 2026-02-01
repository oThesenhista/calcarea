var clientesSalvos = clientesSalvos || [];
const LAYOUT_CONFIG = {
    'a4-18': { limit: 21 }, 'a4-4': { limit: 4 }, 'a4-2': { limit: 2 }, 'a4-1': { limit: 1 },
    'thermal-60x30': { limit: 999 }, 'thermal-25x10': { limit: 999 }, 'thermal-custom': { limit: 999 }
};

// --- CONFIGURAÇÃO DEFINITIVA (APPS SCRIPT) ---
// Cole abaixo a URL gerada no passo "Implantar" do Google Apps Script
// Deve terminar com /exec
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlbophlaM3QbSb5zV7VRUb5j3hD85t82RGbEgBmVsU70_H0htbVlMAtI9ixctOctbl/exec"; 

window.addEventListener('load', () => {
    const seletorArquivo = document.getElementById('seletorArquivo');
    const infoDados = document.getElementById('info-dados');
    const caixaBusca = document.getElementById('caixaBusca');
    const areaResultados = document.getElementById('resultados');
    const areaOrcamentoItens = document.getElementById('orcamento-itens');
    const areaOrcamentoTotal = document.getElementById('orcamento-total');
    const btnImprimirOrcamento = document.getElementById('btn-imprimir-orcamento');
    const btnSalvarClientes = document.getElementById('btn-salvar-clientes');
    const btnLimparOrcamento = document.getElementById('btn-limpar-orcamento');
    const modal = document.getElementById('modal-qtde');
    const modalProdutoNome = document.getElementById('modal-produto-nome');
    const inputQtde = document.getElementById('input-qtde');
    const btnConfirmarQtde = document.getElementById('btn-confirmar-qtde');
    const inputNomeCliente = document.getElementById('cliente-nome');
    const inputEnderecoCliente = document.getElementById('cliente-endereco');
    const inputTelefoneCliente = document.getElementById('cliente-telefone');
    const inputCpfCliente = document.getElementById('cliente-cpf');
    const inputResponsavelCliente = document.getElementById('cliente-responsavel');
    const camposClienteInputs = document.querySelectorAll('#dados-cliente .valor-input');
    const listaClientesDataList = document.getElementById('lista-clientes');
    const selectVendedor = document.getElementById('select-vendedor');
    const vendedorPrintSpan = document.getElementById('vendedor-print');
    const caixaBuscaClientes = document.getElementById('caixaBuscaClientes');
    const btnNovoCliente = document.getElementById('btn-novo-cliente');
    const btnExportarClientes = document.getElementById('btn-exportar-clientes');
    const listaClientesWrapper = document.getElementById('lista-clientes-wrapper');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabButtonsDireita = document.querySelectorAll('.tab-button-direita');
    const tabContentsDireita = document.querySelectorAll('.tab-content-direita');
    const selectLayoutEtiqueta = document.getElementById('select-layout-etiqueta');
    const btnImprimirEtiquetas = document.getElementById('btn-imprimir-etiquetas');
    const btnLimparEtiquetas = document.getElementById('btn-limpar-etiquetas');
    const etiquetasContainer = document.getElementById('etiquetas-container');
    const checkEtiquetaUnica = document.getElementById('check-etiqueta-unica');
    const divCheckSimples = document.getElementById('div-check-simples');
    const btnScan = document.getElementById('btn-scan');
    const customDimensionsDiv = document.getElementById('custom-dimensions');
    const inputCustomWidth = document.getElementById('custom-width');
    const inputCustomHeight = document.getElementById('custom-height');
    const modalScanner = document.getElementById('modal-scanner');
    const btnCancelarScan = document.getElementById('btn-cancelar-scan');
    const numeroPedidoSpan = document.getElementById('numero-pedido-valor');

    let orcamento = [], etiquetas = [], produtoSelecionado = null, modoEdicao = false, scanner = null;
    let listaDeClientes = [...clientesSalvos], fullProductList = [], filteredProductList = [], renderedProductCount = 0;
    const ROWS_PER_BATCH = 50;
    let isRenderingBatch = false;

    selectLayoutEtiqueta.addEventListener('change', () => {
        customDimensionsDiv.style.display = selectLayoutEtiqueta.value === 'thermal-custom' ? 'flex' : 'none';
        onLayoutChange();
    });

    function gerarIDPedido() {
        if (!numeroPedidoSpan.textContent) {
            const letra = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            const nums = Date.now().toString().slice(-5);
            numeroPedidoSpan.textContent = `${letra}${nums}`;
        }
    }

    // --- CARREGAMENTO VIA APPS SCRIPT ---
    async function carregarProdutosAutomatico() {
        if (infoDados) {
            infoDados.style.display = 'inline';
            infoDados.textContent = "Sincronizando...";
            infoDados.className = 'status-info';
        }

        // Verifica se o usuário configurou a URL
        if (APPS_SCRIPT_URL.includes("COLE_AQUI")) {
            console.warn("URL do Apps Script não configurada.");
            carregarFallbackLocal();
            return;
        }

        try {
            const response = await fetch(APPS_SCRIPT_URL);
            
            if (response.ok) {
                const texto = await response.text();
                // Verifica se retornou erro do script ou HTML válido
                if (texto.startsWith("Erro:")) throw new Error(texto);
                
                if (texto.includes('<table') || texto.includes('<tr')) {
                    processarConteudoHTML(texto, true);
                    return; 
                }
            }
            throw new Error("Erro na resposta do servidor");
        } catch (e) {
            console.warn("Falha ao sincronizar, usando local...", e);
            carregarFallbackLocal();
        }
    }

    async function carregarFallbackLocal() {
        if (infoDados) infoDados.textContent = "Usando Local...";
        try {
            const respLocal = await fetch('produtos.html');
            if (respLocal.ok) {
                processarConteudoHTML(await respLocal.text(), true);
            } else {
                throw new Error("Arquivo local não encontrado");
            }
        } catch (errLocal) {
            carregarDadosDaMemoria();
        }
    }

    function fecharScanner() {
        if (scanner) scanner.stop().then(() => { scanner = null; modalScanner.style.display = 'none'; }).catch(e => { scanner = null; modalScanner.style.display = 'none'; });
        else modalScanner.style.display = 'none';
    }

    btnScan.addEventListener('click', () => {
        modalScanner.style.display = 'flex';
        if (scanner) return;
        scanner = new Html5Qrcode("reader");
        scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 200 }, aspectRatio: 1.0 }, 
            (decodedText) => { caixaBusca.value = decodedText; buscar(); fecharScanner(); },
            (err) => {}
        ).catch(err => { alert("Erro ao acessar câmera: " + err); modalScanner.style.display = 'none'; });
    });

    btnCancelarScan.addEventListener('click', fecharScanner);
    modalScanner.addEventListener('click', (e) => { if (e.target === modalScanner) fecharScanner(); });

    function limparOrcamento() {
        if ((orcamento.length > 0 || inputNomeCliente.value.trim() !== '') && confirm("Deseja limpar todos os dados?")) {
            orcamento = []; renderizarOrcamento();
            camposClienteInputs.forEach(input => input.value = '');
            numeroPedidoSpan.textContent = '';
        }
    }

    function carregarClientes() {
        listaClientesDataList.innerHTML = "";
        listaDeClientes.forEach(c => {
            const opt = document.createElement('option'); opt.value = c.nome; listaClientesDataList.appendChild(opt);
        });
        renderizarListaClientes(listaDeClientes);
    }

    function renderizarListaClientes(clientes) {
        if (clientes.length === 0) { listaClientesWrapper.innerHTML = '<p class="placeholder">Nenhum cliente encontrado.</p>'; return; }
        const linhas = clientes.map((c, i) => `<tr data-index="${i}"><td>${c.nome}</td><td>${c.telefone||''}</td><td>${c.cpf||''}</td></tr>`).join('');
        listaClientesWrapper.innerHTML = `<table><thead><tr><th>Nome</th><th>Telefone</th><th>CPF/CNPJ</th></tr></thead><tbody>${linhas}</tbody></table>`;
    }

    function buscarClientes() {
        const termo = caixaBuscaClientes.value.toLowerCase();
        renderizarListaClientes(listaDeClientes.filter(c => c.nome.toLowerCase().includes(termo) || (c.cpf && c.cpf.toLowerCase().includes(termo))));
    }

    function preencherDadosClienteOrcamento(index) {
        const c = listaDeClientes[index];
        if (c) {
            inputNomeCliente.value = c.nome||''; inputEnderecoCliente.value = c.endereco||''; 
            inputTelefoneCliente.value = c.telefone||''; inputCpfCliente.value = c.cpf||''; inputResponsavelCliente.value = c.responsavel||'';
        }
    }

    function preencherDadosCliente(nome) {
        const c = listaDeClientes.find(cli => cli.nome.toLowerCase() === nome.toLowerCase());
        if (c) {
            inputEnderecoCliente.value = c.endereco||''; inputTelefoneCliente.value = c.telefone||''; 
            inputCpfCliente.value = c.cpf||''; inputResponsavelCliente.value = c.responsavel||'';
        }
    }

    function atualizarClienteNaLista() {
        const nome = inputNomeCliente.value.trim();
        if (!nome) return;
        const dados = { nome, endereco: inputEnderecoCliente.value.trim(), telefone: inputTelefoneCliente.value.trim(), cpf: inputCpfCliente.value.trim(), responsavel: inputResponsavelCliente.value.trim() };
        const idx = listaDeClientes.findIndex(c => c.nome.toLowerCase() === nome.toLowerCase());
        if (idx > -1) listaDeClientes[idx] = dados; else listaDeClientes.push(dados);
        carregarClientes();
    }

    function exportarClientes() {
        atualizarClienteNaLista();
        if (listaDeClientes.length === 0) return;
        const blob = new Blob([`var clientesSalvos = ${JSON.stringify(listaDeClientes, null, 2)};`], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'clientes-db.js'; a.click(); URL.revokeObjectURL(url);
    }

    function carregarDadosDaMemoria() {
        const dados = localStorage.getItem('meusProdutos');
        if (dados) {
            fullProductList = JSON.parse(dados); filteredProductList = [...fullProductList];
            const btn = document.querySelector('.upload-button'); btn.classList.remove('status-green','status-yellow','status-red');
            let dataSalva = localStorage.getItem('dataAtualizacao');
            if (!dataSalva) dataSalva = new Date();
            const dif = Math.ceil((new Date() - new Date(dataSalva)) / 86400000);
            btn.classList.add(dif <= 1 ? 'status-green' : dif <= 7 ? 'status-yellow' : 'status-red');
            caixaBusca.disabled = false; loadNextBatch(true);
        }
    }

    function processarConteudoHTML(html, silencioso) {
        const doc = new DOMParser().parseFromString(html, 'text/html'), arr = [];
        doc.querySelectorAll('body table tr').forEach(tr => {
            const td = tr.querySelectorAll('td');
            if (td.length === 3) arr.push({ codigo: td[0].textContent.trim(), nome: td[1].textContent.trim(), preco: td[2].textContent.trim() });
        });
        if (arr.length > 0) {
            localStorage.setItem('meusProdutos', JSON.stringify(arr)); 
            localStorage.setItem('dataAtualizacao', new Date().toLocaleString('pt-BR'));
            
            if (!silencioso) { 
                alert(`${arr.length} produtos carregados!`); 
                location.reload(); 
            } else { 
                fullProductList = arr; 
                filteredProductList = [...fullProductList]; 
                
                if (infoDados) {
                    infoDados.textContent = "Sincronizado (Drive)";
                    infoDados.style.color = "green";
                }
                const btn = document.querySelector('.upload-button');
                if(btn) {
                    btn.classList.remove('status-green','status-yellow','status-red');
                    btn.classList.add('status-green');
                }
                loadNextBatch(true); 
            }
        }
    }

    function buscar() {
        const t = caixaBusca.value.toLowerCase();
        filteredProductList = t.length === 0 ? [...fullProductList] : fullProductList.filter(p => p.nome.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t));
        loadNextBatch(true);
    }

    function renderBatch(batch) {
        return batch.map(p => `<tr data-codigo="${p.codigo}"><td>${p.codigo}</td><td>${p.nome}</td><td>${p.preco}</td><td class="col-acoes"><button class="btn-acao-etiqueta" data-codigo="${p.codigo}"><img src="img/label_icon.svg" class="icon-sm"></button></td></tr>`).join("");
    }
    
    function loadNextBatch(clear) {
        if (isRenderingBatch) return;
        isRenderingBatch = true;
        if (clear) { renderedProductCount = 0; areaResultados.innerHTML = ""; }
        const batch = filteredProductList.slice(renderedProductCount, renderedProductCount + ROWS_PER_BATCH);
        if (renderedProductCount === 0 && batch.length === 0) { areaResultados.innerHTML = '<p class="placeholder">Nenhum produto encontrado.</p>'; isRenderingBatch = false; return; }
        if (batch.length === 0) { isRenderingBatch = false; return; }
        if (renderedProductCount === 0) areaResultados.innerHTML = `<table><thead><tr><th>Código</th><th>Nome</th><th>Preço</th><th class="col-acoes">Ações</th></tr></thead><tbody></tbody></table>`;
        areaResultados.querySelector('tbody').insertAdjacentHTML('beforeend', renderBatch(batch));
        renderedProductCount += batch.length;
        isRenderingBatch = false;
    }

    function abrirModal(p, qtde = 1) { produtoSelecionado = p; modalProdutoNome.textContent = p.nome; inputQtde.value = qtde; modal.style.display = 'flex'; inputQtde.focus(); inputQtde.select(); }
    function fecharModal() { modal.style.display = 'none'; produtoSelecionado = null; modoEdicao = false; }
    function salvarQuantidade() {
        const q = parseFloat(inputQtde.value);
        if (q > 0 && produtoSelecionado) modoEdicao ? atualizarOrcamento(produtoSelecionado, q) : adicionarAoOrcamento(produtoSelecionado, q);
        fecharModal();
    }

    function adicionarAoOrcamento(p, q) {
        const item = orcamento.find(i => i.codigo === p.codigo);
        item ? item.qtde += q : orcamento.push({ ...p, qtde: q });
        renderizarOrcamento();
    }

    function atualizarOrcamento(p, nq) { const item = orcamento.find(i => i.codigo === p.codigo); if (item) item.qtde = nq; renderizarOrcamento(); }
    function atualizarQuantidade(e) {
        const val = parseFloat(e.target.textContent.replace(',','.'));
        const item = orcamento.find(i => i.codigo === e.target.dataset.codigo);
        if (!isNaN(val) && val >= 0 && item) { item.qtde = val; renderizarOrcamento(); } else if (item) e.target.textContent = item.qtde;
    }
    function removerDoOrcamento(cod) { orcamento = orcamento.filter(i => i.codigo !== cod); renderizarOrcamento(); }
    function atualizarPreco(e) {
        const val = parseFloat(e.target.textContent.replace('R$','').replace('.','').replace(',','.').trim());
        const item = orcamento.find(i => i.codigo === e.target.dataset.codigo);
        if (!isNaN(val) && item) { item.preco = `R$ ${val.toFixed(2).replace('.',',')}`; renderizarOrcamento(); } else if (item) e.target.textContent = item.preco;
    }

    function renderizarOrcamento() {
        if (orcamento.length === 0) { areaOrcamentoItens.innerHTML = '<p class="placeholder">Nenhum item adicionado.</p>'; areaOrcamentoTotal.textContent = "Total: R$ 0,00"; return; }
        let total = 0;
        const linhas = orcamento.map(i => {
            const st = parseFloat(i.preco.replace('R$','').replace('.','').replace(',','.').trim()) * i.qtde;
            total += st;
            return `<tr><td class="col-qtde" contenteditable="true" data-codigo="${i.codigo}">${i.qtde}</td><td class="col-produto">${i.nome}</td><td class="col-preco" contenteditable="true" data-codigo="${i.codigo}">${i.preco}</td><td class="col-preco">R$ ${st.toFixed(2).replace('.',',')}</td><td class="col-acoes"><button class="btn-acao remove-btn" data-codigo="${i.codigo}"><img src="img/deny_icon.svg" class="icon-sm"></button></td></tr>`;
        }).join('');
        areaOrcamentoItens.innerHTML = `<table class="orcamento-tabela"><thead><tr><th>Qtde</th><th>Produto</th><th class="col-preco">V. Unitário</th><th class="col-preco">V. Total</th><th class="col-acoes">Ações</th></tr></thead><tbody>${linhas}</tbody></table>`;
        areaOrcamentoTotal.textContent = `Total: R$ ${total.toFixed(2).replace('.',',')}`;
    }

    function adicionarNaEtiqueta(cod) {
        const item = etiquetas.find(p => p.codigo === cod);
        if (item) item.qtde++; else { const p = fullProductList.find(x => x.codigo === cod); if (p) etiquetas.push({ ...p, qtde: 1 }); }
        renderizarEtiquetas(); alternarAbaDireita('etiquetas');
    }
    function removerDaEtiqueta(idx) { etiquetas.splice(idx, 1); renderizarEtiquetas(); }
    function atualizarQuantidadeEtiqueta(idx, val) { const q = parseInt(val); etiquetas[idx].qtde = q > 0 ? q : 1; }
    
    function sincronizarEdicoes() {
        document.querySelectorAll('.etiqueta').forEach(c => {
            const idx = parseInt(c.querySelector('.etiqueta-qtde-input')?.dataset.index);
            if (etiquetas[idx]) {
                const n = c.querySelector('.etiqueta-nome'), p = c.querySelector('.etiqueta-preco span[contenteditable="true"]') || c.querySelector('.etiqueta-preco');
                if (n) etiquetas[idx].nome = n.textContent.trim();
                if (p) etiquetas[idx].preco = p.textContent.includes('R$') ? p.textContent.trim() : "R$ " + p.textContent.trim();
            }
        });
    }

    function renderizarParaImpressao() {
        const exp = []; etiquetas.forEach(i => { for(let x=0; x<i.qtde; x++) exp.push(i); });
        const layout = selectLayoutEtiqueta.value; etiquetasContainer.className = `layout-${layout}`; etiquetasContainer.innerHTML = '';
        let opts, cls, logo = false, name = true;
        if (layout === 'a4-18') { cls = 'etiqueta-simples'; opts = { format: "EAN13", displayValue: true, fontSize: 62, margin: 2, height: 85, width: 10 }; }
        else if (layout === 'a4-4') { cls = 'etiqueta-pequena'; logo = true; opts = { format: "EAN13", displayValue: true, fontSize: 20, margin: 10, height: 100, width: 8 }; }
        else if (layout === 'a4-2') { cls = 'etiqueta-media'; logo = true; opts = { format: "EAN13", displayValue: true, fontSize: 20, margin: 10, height: 100, width: 4 }; }
        else if (layout === 'a4-1') { cls = 'etiqueta-grande'; logo = true; opts = { format: "EAN13", displayValue: true, fontSize: 22, margin: 10, height: 100, width: 5 }; }
        else if (layout === 'thermal-60x30') { cls = 'etiqueta-simples'; opts = { format: "EAN13", displayValue: true, fontSize: 20, margin: 2, height: 40, width: 2 }; }
        else if (layout === 'thermal-25x10') { cls = 'etiqueta-mini'; name = false; opts = { format: "EAN13", displayValue: false, margin: 0, height: 25, width: 1.5 }; }
        else { cls = 'etiqueta-custom'; opts = { format: "EAN13", displayValue: true, fontSize: 14, margin: 2, height: 30, width: 2 }; }
        
        exp.forEach(p => {
            const div = document.createElement('div'); div.className = `etiqueta ${cls}`;
            if (layout === 'thermal-custom') { div.style.width = (inputCustomWidth.value||50)+'mm'; div.style.height = (inputCustomHeight.value||30)+'mm'; div.style.maxHeight = div.style.height; }
            let h = '';
            if (logo) h += `<div class="etiqueta-logo"><img src="img/logo.png"></div><div class="etiqueta-info-bloco">`;
            if (name) h += `<span class="etiqueta-nome">${p.nome}</span>`;
            h += `<span class="etiqueta-preco">${logo ? `<span class="currency-symbol">R$</span><span>${p.preco.replace('R$','').trim()}</span>` : p.preco}</span>`;
            if (logo) h += `<span class="etiqueta-parcelamento">ou em até 6x sem juros</span></div>`;
            h += `<svg class="etiqueta-barcode"></svg>`;
            div.innerHTML = h; etiquetasContainer.appendChild(div);
            try { JsBarcode(div.querySelector('.etiqueta-barcode'), p.codigo, { ...opts, text: p.codigo }); } catch(e){}
        });
    }

    function renderizarEtiquetas() {
        const layout = selectLayoutEtiqueta.value; etiquetasContainer.className = `layout-${layout}`; divCheckSimples.style.display = (layout === 'a4-18') ? 'inline-block' : 'none';
        if (etiquetas.length === 0) { etiquetasContainer.innerHTML = '<p class="placeholder">Nenhuma etiqueta.</p>'; return; }
        etiquetasContainer.innerHTML = '';
        let opts, cls, logo = false, name = true;
        if (layout === 'a4-18') { cls = 'etiqueta-simples'; opts = { format: "EAN13", displayValue: true, fontSize: 62, margin: 2, height: 85, width: 10 }; }
        else if (layout === 'a4-4') { cls = 'etiqueta-pequena'; logo = true; opts = { format: "EAN13", displayValue: true, fontSize: 20, margin: 10, height: 100, width: 8 }; }
        else if (layout === 'a4-2') { cls = 'etiqueta-media'; logo = true; opts = { format: "EAN13", displayValue: true, fontSize: 20, margin: 10, height: 100, width: 4 }; }
        else if (layout === 'a4-1') { cls = 'etiqueta-grande'; logo = true; opts = { format: "EAN13", displayValue: true, fontSize: 22, margin: 10, height: 100, width: 5 }; }
        else if (layout === 'thermal-60x30') { cls = 'etiqueta-simples'; opts = { format: "EAN13", displayValue: true, fontSize: 20, margin: 2, height: 40, width: 2 }; }
        else if (layout === 'thermal-25x10') { cls = 'etiqueta-mini'; name = false; opts = { format: "EAN13", displayValue: false, margin: 0, height: 25, width: 1.5 }; }
        else { cls = 'etiqueta-custom'; opts = { format: "EAN13", displayValue: true, fontSize: 14, margin: 2, height: 30, width: 2 }; }

        etiquetas.forEach((p, i) => {
            const div = document.createElement('div'); div.className = `etiqueta ${cls}`;
            if (layout === 'thermal-custom') { div.style.width = (inputCustomWidth.value||50)+'mm'; div.style.height = (inputCustomHeight.value||30)+'mm'; div.style.border = "1px dashed #333"; }
            let h = `<button class="btn-acao etiqueta-remove-btn" data-index="${i}"><img src="img/deny_icon.svg" class="icon-sm"></button><input type="number" class="etiqueta-qtde-input" value="${p.qtde}" min="1" data-index="${i}">`;
            if (logo) h += `<div class="etiqueta-logo"><img src="img/logo.png"></div><div class="etiqueta-info-bloco">`;
            if (name) h += `<span class="etiqueta-nome" contenteditable="true">${p.nome}</span>`;
            h += `<span class="etiqueta-preco" ${!logo?'contenteditable="true"':''}>${logo ? `<span class="currency-symbol">R$</span><span contenteditable="true">${p.preco.replace('R$','').trim()}</span>` : p.preco}</span>`;
            if (logo) h += `<span class="etiqueta-parcelamento">ou em até 6x sem juros</span></div>`;
            h += `<svg class="etiqueta-barcode"></svg>`;
            div.innerHTML = h; etiquetasContainer.appendChild(div);
            try { JsBarcode(div.querySelector('.etiqueta-barcode'), p.codigo, { ...opts, text: p.codigo }); } catch(e){ div.querySelector('.etiqueta-barcode').outerHTML = `<span>Erro</span>`; }
        });
    }

    function limparEtiquetas() { if (etiquetas.length > 0 && confirm("Limpar tudo?")) { etiquetas = []; renderizarEtiquetas(); } }
    function onLayoutChange() { renderizarEtiquetas(); }

    function alternarAba(aba) { tabButtons.forEach(b => b.classList.toggle('active-tab', b.dataset.tab === aba)); tabContents.forEach(c => c.classList.toggle('active-content', c.id === `tab-${aba}`)); }
    function alternarAbaDireita(aba) { tabButtonsDireita.forEach(b => b.classList.toggle('active-tab-direita', b.dataset.tabDireita === aba)); tabContentsDireita.forEach(c => c.classList.toggle('active-content-direita', c.id === `tab-${aba}-view`)); }
    
    function formatarTelefone(e) { let v = e.target.value.replace(/\D/g, ''); let f = ''; if (v.length > 0) f += `(${v.substring(0, 2)}`; if (v.length > 2) f += `) ${v.substring(2, 7)}`; if (v.length > 7) f += `-${v.substring(7, 11)}`; e.target.value = f; }
    function formatarCpfCnpj(e) { let v = e.target.value.replace(/\D/g, ''); e.target.value = v.length <= 11 ? v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"); }

    seletorArquivo.addEventListener('change', (e) => { if (e.target.files[0]) { const r = new FileReader(); r.onload = (evt) => processarConteudoHTML(evt.target.result); r.readAsText(e.target.files[0], 'iso-8859-1'); } });
    caixaBusca.addEventListener('keyup', buscar);
    areaResultados.addEventListener('scroll', () => { if (!isRenderingBatch && areaResultados.scrollTop + areaResultados.clientHeight >= areaResultados.scrollHeight - 100) loadNextBatch(); });

    btnImprimirOrcamento.addEventListener('click', () => {
        gerarIDPedido();
        document.body.classList.add('imprimindo-orcamento');
        window.print(); 
        setTimeout(() => document.body.className = '', 500);
    });

    btnImprimirEtiquetas.addEventListener('click', () => {
        sincronizarEdicoes(); renderizarParaImpressao();
        const layout = selectLayoutEtiqueta.value;
        let style = document.getElementById('dynamic-print-style') || document.createElement('style');
        style.id = 'dynamic-print-style'; document.head.appendChild(style);
        let css = '';
        if (layout === 'a4-18' && checkEtiquetaUnica.checked) { document.body.classList.add('imprimindo-etiqueta-unica'); }
        else if (layout === 'thermal-60x30') { document.body.classList.add('imprimindo-etiqueta-unica'); css = `@page { size: 60mm 30mm; margin: 0; }`; }
        else if (layout === 'thermal-25x10') { document.body.classList.add('imprimindo-thermal-25x10'); css = `@page { size: 25mm 10mm; margin: 0; }`; }
        else if (layout === 'thermal-custom') { document.body.classList.add('imprimindo-thermal-custom'); const w = inputCustomWidth.value||50, h = inputCustomHeight.value||30; css = `@page { size: ${w}mm ${h}mm; margin: 0; } @media print { .etiqueta { width: ${w}mm !important; height: ${h}mm !important; max-height: ${h}mm !important; } }`; }
        else { document.body.classList.add('imprimindo-etiquetas'); if (layout === 'a4-2') document.body.classList.add('layout-a4-2-active'); css = `@page { size: A4 portrait; margin: 0.5cm; }`; }
        style.innerHTML = css ? `@media print { ${css} }` : '';
        window.print(); setTimeout(() => { document.body.className = ''; renderizarEtiquetas(); }, 500);
    });

    btnLimparEtiquetas.addEventListener('click', limparEtiquetas);
    etiquetasContainer.addEventListener('click', (e) => { const b = e.target.closest('.etiqueta-remove-btn'); if (b) removerDaEtiqueta(parseInt(b.dataset.index)); });
    etiquetasContainer.addEventListener('change', (e) => { if (e.target.classList.contains('etiqueta-qtde-input')) atualizarQuantidadeEtiqueta(parseInt(e.target.dataset.index), e.target.value); });
    btnSalvarClientes.addEventListener('click', atualizarClienteNaLista);
    btnLimparOrcamento.addEventListener('click', limparOrcamento);
    selectVendedor.addEventListener('change', () => vendedorPrintSpan.textContent = selectVendedor.value);
    inputNomeCliente.addEventListener('change', () => preencherDadosCliente(inputNomeCliente.value));
    inputTelefoneCliente.addEventListener('keyup', formatarTelefone);
    inputCpfCliente.addEventListener('keyup', formatarCpfCnpj);
    caixaBuscaClientes.addEventListener('keyup', buscarClientes);
    listaClientesWrapper.addEventListener('click', (e) => { const l = e.target.closest('tr'); if (l && l.dataset.index) { listaClientesWrapper.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected')); l.classList.add('selected'); preencherDadosClienteOrcamento(l.dataset.index); } });
    btnNovoCliente.addEventListener('click', () => camposClienteInputs.forEach(i => i.value = ''));
    btnExportarClientes.addEventListener('click', exportarClientes);
    areaResultados.addEventListener('click', (e) => { const b = e.target.closest('.btn-acao-etiqueta'), l = e.target.closest('tr'); if (b) adicionarNaEtiqueta(b.dataset.codigo); else if (l && l.dataset.codigo) { const p = fullProductList.find(x => x.codigo === l.dataset.codigo); if (p) { modoEdicao = false; abrirModal(p); } } });
    areaOrcamentoItens.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.codigo && b.classList.contains('remove-btn')) removerDoOrcamento(b.dataset.codigo); });
    areaOrcamentoItens.addEventListener('blur', (e) => { if (e.target.classList.contains('col-qtde')) atualizarQuantidade(e); else if (e.target.classList.contains('col-preco')) atualizarPreco(e); }, true);
    btnConfirmarQtde.addEventListener('click', salvarQuantidade);
    document.getElementById('btn-cancelar-qtde').addEventListener('click', fecharModal);
    inputQtde.addEventListener('keyup', (e) => { if (e.key === 'Enter') salvarQuantidade(); });
    tabButtons.forEach(b => b.addEventListener('click', () => alternarAba(b.dataset.tab)));
    tabButtonsDireita.forEach(b => b.addEventListener('click', () => alternarAbaDireita(b.dataset.tabDireita)));

    const d = new Date();
    document.getElementById('data-orcamento').textContent = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} - ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    carregarProdutosAutomatico(); carregarClientes();
    vendedorPrintSpan.textContent = selectVendedor.value;
});