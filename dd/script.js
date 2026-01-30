var clientesSalvos = clientesSalvos || [];

// Adicionado novos layouts na config
const LAYOUT_CONFIG = {
    'a4-18': { limit: 21 },
    'a4-4':  { limit: 4 },
    'a4-2':  { limit: 2 },
    'a4-1':  { limit: 1 },
    'thermal-60x30': { limit: 999 },
    'thermal-25x10': { limit: 999 },
    'thermal-custom': { limit: 999 }
};

window.addEventListener('load', () => {
    // 1. DECLARAÇÃO DE VARIÁVEIS E ELEMENTOS
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
    
    // Elementos Custom
    const customDimensionsDiv = document.getElementById('custom-dimensions');
    const inputCustomWidth = document.getElementById('custom-width');
    const inputCustomHeight = document.getElementById('custom-height');

    // Variáveis de Estado
    let orcamento = [];
    let etiquetas = [];
    let produtoSelecionado = null;
    let modoEdicao = false;
    let scanner = null;
    let listaDeClientes = [...clientesSalvos];

    let fullProductList = [];       
    let filteredProductList = [];   
    let renderedProductCount = 0;   
    const ROWS_PER_BATCH = 50;      
    let isRenderingBatch = false;   

    // --- LÓGICA DE VISIBILIDADE DOS INPUTS CUSTOM ---
    selectLayoutEtiqueta.addEventListener('change', () => {
        const layout = selectLayoutEtiqueta.value;
        if (layout === 'thermal-custom') {
            customDimensionsDiv.style.display = 'flex';
        } else {
            customDimensionsDiv.style.display = 'none';
        }
        onLayoutChange();
    });

    // --- FUNÇÕES DE CARREGAMENTO ---
    async function carregarProdutosAutomatico() {
        if (infoDados) {
            infoDados.style.display = 'inline';
        }
        try {
            const response = await fetch('produtos.html');
            if (response.ok) {
                const htmlString = await response.text();
                processarConteudoHTML(htmlString, true);
            } else {
                throw new Error("Não encontrado");
            }
        } catch (e) {
            carregarDadosDaMemoria();
        }
    }

    // --- CÓDIGO DO SCANNER (ATUALIZADO) ---
    const modalScanner = document.getElementById('modal-scanner');
    const btnCancelarScan = document.getElementById('btn-cancelar-scan');

    function fecharScanner() {
        if (scanner) {
            scanner.stop().then(() => {
                scanner = null;
                modalScanner.style.display = 'none';
            }).catch(err => {
                console.error("Erro ao parar scanner", err);
                modalScanner.style.display = 'none';
                scanner = null;
            });
        } else {
            modalScanner.style.display = 'none';
        }
    }

    btnScan.addEventListener('click', () => {
        // Abre o modal
        modalScanner.style.display = 'flex';
        
        // Se já tiver scanner rodando (improvável mas previne erro), para.
        if (scanner) return;

        scanner = new Html5Qrcode("reader");
        
        const configScanner = { 
            fps: 10, 
            qrbox: { width: 280, height: 80 },
            aspectRatio: 1.0
        };

        scanner.start(
            { facingMode: "environment" }, 
            configScanner,
            (decodedText) => {
                // SUCESSO NA LEITURA
                caixaBusca.value = decodedText;
                buscar(); // Executa a busca
                fecharScanner(); // Fecha o modal automaticamente
            },
            (errorMessage) => {
                // Erros de leitura
            }
        ).catch(err => {
            // ALERTA IMPORTANTE PARA MOBILE
            alert("Erro ao acessar câmera: " + err + "\n\nDica: Em celulares, o site precisa ser HTTPS ou localhost.");
            modalScanner.style.display = 'none';
        });
    });

    // Botão de cancelar dentro do modal
    btnCancelarScan.addEventListener('click', fecharScanner);

    // Fechar se clicar fora (na parte escura do modal)
    modalScanner.addEventListener('click', (e) => {
        if (e.target === modalScanner) {
            fecharScanner();
        }
    });


    // --- FUNÇÕES ORIGINAIS ---
    function limparOrcamento() {
        if (orcamento.length > 0 || inputNomeCliente.value.trim() !== '') {
            if (confirm("Tem certeza que deseja limpar todos os itens e dados do cliente?")) {
                orcamento = [];
                renderizarOrcamento();
                camposClienteInputs.forEach(input => input.value = '');
            }
        }
    }

    function carregarClientes() {
        listaClientesDataList.innerHTML = "";
        listaDeClientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.nome;
            listaClientesDataList.appendChild(option);
        });
        renderizarListaClientes(listaDeClientes);
    }

    function renderizarListaClientes(clientes) {
        if (clientes.length === 0) {
            listaClientesWrapper.innerHTML = '<p class="placeholder">Nenhum cliente encontrado.</p>';
            return;
        }
        const linhasTabela = clientes.map((cliente, index) => `
            <tr data-index="${index}">
                <td>${cliente.nome}</td>
                <td>${cliente.telefone || ''}</td>
                <td>${cliente.cpf || ''}</td>
            </tr>
        `).join('');
        listaClientesWrapper.innerHTML = `<table><thead><tr><th>Nome</th><th>Telefone</th><th>CPF/CNPJ</th></tr></thead><tbody>${linhasTabela}</tbody></table>`;
    }

    function buscarClientes() {
        const termoBusca = caixaBuscaClientes.value.toLowerCase();
        const resultados = listaDeClientes.filter(cliente =>
            cliente.nome.toLowerCase().includes(termoBusca) ||
            (cliente.cpf && cliente.cpf.toLowerCase().includes(termoBusca))
        );
        renderizarListaClientes(resultados);
    }

    function preencherDadosClienteOrcamento(index) {
        const cliente = listaDeClientes[index];
        if (cliente) {
            inputNomeCliente.value = cliente.nome || '';
            inputEnderecoCliente.value = cliente.endereco || '';
            inputTelefoneCliente.value = cliente.telefone || '';
            inputCpfCliente.value = cliente.cpf || '';
            inputResponsavelCliente.value = cliente.responsavel || '';
        }
    }

    function preencherDadosCliente(nome) {
        const clienteEncontrado = listaDeClientes.find(c => c.nome.toLowerCase() === nome.toLowerCase());
        if (clienteEncontrado) {
            inputEnderecoCliente.value = clienteEncontrado.endereco || '';
            inputTelefoneCliente.value = clienteEncontrado.telefone || '';
            inputCpfCliente.value = clienteEncontrado.cpf || '';
            inputResponsavelCliente.value = clienteEncontrado.responsavel || '';
        }
    }

    function atualizarClienteNaLista() {
        const nome = inputNomeCliente.value.trim();
        if (!nome) return;
        const dadosCliente = {
            nome: nome,
            endereco: inputEnderecoCliente.value.trim(),
            telefone: inputTelefoneCliente.value.trim(),
            cpf: inputCpfCliente.value.trim(),
            responsavel: inputResponsavelCliente.value.trim()
        };
        const indexCliente = listaDeClientes.findIndex(c => c.nome.toLowerCase() === nome.toLowerCase());
        if (indexCliente > -1) { listaDeClientes[indexCliente] = dadosCliente; }
        else { listaDeClientes.push(dadosCliente); }
        carregarClientes();
    }

    function exportarClientes() {
        atualizarClienteNaLista();
        if (listaDeClientes.length === 0) return;
        const conteudoJS = `var clientesSalvos = ${JSON.stringify(listaDeClientes, null, 2)};`;
        const blob = new Blob([conteudoJS], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'clientes-db.js';
        a.click();
        URL.revokeObjectURL(url);
    }

    function carregarDadosDaMemoria() {
        const dadosSalvos = localStorage.getItem('meusProdutos');
        const dataSalva = localStorage.getItem('dataAtualizacao');
        const uploadButton = document.querySelector('.upload-button');
        if (dadosSalvos) {
            fullProductList = JSON.parse(dadosSalvos);
            filteredProductList = [...fullProductList];
            const ultimaAtualizacao = new Date(dataSalva);
            const hoje = new Date();
            const diferencaEmDias = Math.ceil((hoje.getTime() - ultimaAtualizacao.getTime()) / (1000 * 3600 * 24));
            
            uploadButton.classList.remove('status-green', 'status-yellow', 'status-red');
            if (diferencaEmDias <= 1) uploadButton.classList.add('status-green');
            else if (diferencaEmDias <= 7) uploadButton.classList.add('status-yellow');
            else uploadButton.classList.add('status-red');

            caixaBusca.placeholder = "Buscar por nome ou código...";
            caixaBusca.disabled = false;
            loadNextBatch(true);
        }
    }

    function processarConteudoHTML(htmlString, silencioso = false) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const produtosArray = [];
        doc.querySelectorAll('body table tr').forEach(linha => {
            const colunas = linha.querySelectorAll('td');
            if (colunas.length === 3) {
                const codigo = colunas[0].textContent.trim();
                const nome = colunas[1].textContent.trim();
                const preco = colunas[2].textContent.trim();
                if (codigo && nome && preco) produtosArray.push({ codigo, nome, preco });
            }
        });

        if (produtosArray.length > 0) {
            const dataAtual = new Date().toLocaleString('pt-BR');
            localStorage.setItem('meusProdutos', JSON.stringify(produtosArray));
            localStorage.setItem('dataAtualizacao', dataAtual);
            if (!silencioso) {
                alert(`${produtosArray.length} produtos carregados!`);
                location.reload();
            } else {
                fullProductList = produtosArray;
                filteredProductList = [...fullProductList];
                infoDados.textContent = "Lista Carregada: " + dataAtual;
                loadNextBatch(true);
            }
        }
    }

    function buscar() {
        const termoBusca = caixaBusca.value.toLowerCase();
        filteredProductList = termoBusca.length === 0 ? [...fullProductList] : 
            fullProductList.filter(p => p.nome.toLowerCase().includes(termoBusca) || p.codigo.toLowerCase().includes(termoBusca));
        loadNextBatch(true);
    }

    function renderBatch(batch) {
        return batch.map(p => `
            <tr data-codigo="${p.codigo}">
                <td>${p.codigo}</td>
                <td>${p.nome}</td>
                <td>${p.preco}</td>
                <td class="col-acoes">
                    <button class="btn-acao-etiqueta" data-codigo="${p.codigo}" title="Adicionar Etiqueta">
                        <img src="img/label_icon.svg" class="icon-sm" alt="Etiqueta">
                    </button>
                </td>
             </tr>
        `).join("");
    }
    
    function loadNextBatch(clear = false) {
        if (isRenderingBatch) return;
        isRenderingBatch = true;
        if (clear) { renderedProductCount = 0; areaResultados.innerHTML = ""; }
        const batch = filteredProductList.slice(renderedProductCount, renderedProductCount + ROWS_PER_BATCH);
        if (renderedProductCount === 0 && batch.length === 0) {
            areaResultados.innerHTML = '<p class="placeholder">Nenhum produto encontrado.</p>';
            isRenderingBatch = false; return;
        }
        if (batch.length === 0) { isRenderingBatch = false; return; }
        if (renderedProductCount === 0) {
            areaResultados.innerHTML = `<table><thead><tr><th>Código</th><th>Nome</th><th>Preço</th><th class="col-acoes">Ações</th></tr></thead><tbody></tbody></table>`;
        }
        const tbody = areaResultados.querySelector('tbody');
        if (tbody) {
            tbody.insertAdjacentHTML('beforeend', renderBatch(batch));
            renderedProductCount += batch.length;
        }
        isRenderingBatch = false;
    }

    function abrirModal(produto, quantidadeInicial = 1) {
        produtoSelecionado = produto;
        modalProdutoNome.textContent = produto.nome;
        inputQtde.value = quantidadeInicial;
        modal.style.display = 'flex';
        inputQtde.focus(); inputQtde.select();
    }

    function fecharModal() { modal.style.display = 'none'; produtoSelecionado = null; modoEdicao = false; }

    function salvarQuantidade() {
        const quantidade = parseFloat(inputQtde.value);
        if (quantidade > 0 && produtoSelecionado) {
            if (modoEdicao) { atualizarOrcamento(produtoSelecionado, quantidade); }
            else { adicionarAoOrcamento(produtoSelecionado, quantidade); }
        }
        fecharModal();
    }

    function adicionarAoOrcamento(produto, quantidade) {
        const itemExistente = orcamento.find(item => item.codigo === produto.codigo);
        if (itemExistente) { itemExistente.qtde += quantidade; }
        else { orcamento.push({ ...produto, qtde: quantidade }); }
        renderizarOrcamento();
    }

    function atualizarOrcamento(produto, novaQuantidade) {
        const itemExistente = orcamento.find(item => item.codigo === produto.codigo);
        if (itemExistente) { itemExistente.qtde = novaQuantidade; }
        renderizarOrcamento();
    }

    function atualizarQuantidade(evento) {
        const celula = evento.target;
        const novaQtdeTexto = celula.textContent.trim();
        const novaQtdeNumerica = parseFloat(novaQtdeTexto.replace(',', '.'));
        const item = orcamento.find(i => i.codigo === celula.dataset.codigo);
        if (!isNaN(novaQtdeNumerica) && novaQtdeNumerica >= 0) {
            if (item) { item.qtde = novaQtdeNumerica; renderizarOrcamento(); }
        } else if (item) { celula.textContent = item.qtde; }
    }

    function removerDoOrcamento(codigoProduto) { orcamento = orcamento.filter(item => item.codigo !== codigoProduto); renderizarOrcamento(); }

    function atualizarPreco(evento) {
        const celula = evento.target;
        const novoPrecoNumerico = parseFloat(celula.textContent.trim().replace('R$', '').replace('.', '').replace(',', '.'));
        const item = orcamento.find(i => i.codigo === celula.dataset.codigo);
        if (!isNaN(novoPrecoNumerico)) {
            if (item) { item.preco = `R$ ${novoPrecoNumerico.toFixed(2).replace('.', ',')}`; renderizarOrcamento(); }
        } else if (item) { celula.textContent = item.preco; }
    }

    function renderizarOrcamento() {
        if (orcamento.length === 0) {
            areaOrcamentoItens.innerHTML = '<p class="placeholder">Nenhum item adicionado.</p>';
            areaOrcamentoTotal.textContent = "Total: R$ 0,00"; return;
        }
        let total = 0;
        const linhasTabela = orcamento.map(item => {
            const precoNumerico = parseFloat(item.preco.replace('R$', '').replace('.', '').replace(',', '.').trim());
            const subtotal = precoNumerico * item.qtde;
            total += subtotal;
            return `<tr>
                <td class="col-qtde" contenteditable="true" data-codigo="${item.codigo}">${item.qtde}</td>
                <td class="col-produto">${item.nome}</td>
                <td class="col-preco" contenteditable="true" data-codigo="${item.codigo}">${item.preco}</td>
                <td class="col-preco">R$ ${subtotal.toFixed(2).replace('.', ',')}</td>
                <td class="col-acoes">
                    <button class="btn-acao remove-btn" data-codigo="${item.codigo}" title="Remover">
                        <img src="img/deny_icon.svg" class="icon-sm" alt="Remover">
                    </button>
                </td>
            </tr>`;
        }).join('');
        areaOrcamentoItens.innerHTML = `<table class="orcamento-tabela"><thead><tr><th>Qtde</th><th>Produto</th><th class="col-preco">V. Unitário</th><th class="col-preco">V. Total</th><th class="col-acoes">Ações</th></tr></thead><tbody>${linhasTabela}</tbody></table>`;
        areaOrcamentoTotal.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
    }

    // --- NOVA LÓGICA DE ETIQUETAS ---

    function adicionarNaEtiqueta(codigo) {
        const layout = selectLayoutEtiqueta.value;
        const limit = LAYOUT_CONFIG[layout]?.limit || 21;
        
        const itemExistente = etiquetas.find(p => p.codigo === codigo);
        
        if (itemExistente) {
            itemExistente.qtde++;
            renderizarEtiquetas();
            alternarAbaDireita('etiquetas');
        } else {
            const produto = fullProductList.find(p => p.codigo === codigo);
            if (produto) { 
                etiquetas.push({ ...produto, qtde: 1 }); 
                renderizarEtiquetas(); 
                alternarAbaDireita('etiquetas'); 
            }
        }
    }
    
    function removerDaEtiqueta(index) { etiquetas.splice(index, 1); renderizarEtiquetas(); }

    function atualizarQuantidadeEtiqueta(index, novaQtde) {
        const q = parseInt(novaQtde);
        if (q > 0) { etiquetas[index].qtde = q; } 
        else { etiquetas[index].qtde = 1; }
    }

    // SALVA EDIÇÕES ANTES DE IMPRIMIR
    function sincronizarEdicoes() {
        const cards = document.querySelectorAll('.etiqueta');
        cards.forEach((card) => {
            const inputQtde = card.querySelector('.etiqueta-qtde-input');
            if (!inputQtde) return;
            
            const index = parseInt(inputQtde.dataset.index);
            if (etiquetas[index]) {
                const nomeEl = card.querySelector('.etiqueta-nome');
                if (nomeEl) etiquetas[index].nome = nomeEl.textContent.trim();

                const precoEl = card.querySelector('.etiqueta-preco');
                if (precoEl) {
                    const spanValor = precoEl.querySelector('span[contenteditable="true"]');
                    if (spanValor) {
                        etiquetas[index].preco = "R$ " + spanValor.textContent.trim();
                    } else {
                        etiquetas[index].preco = precoEl.textContent.trim();
                    }
                }
            }
        });
    }

    // EXPANDIR LISTA PARA IMPRESSÃO
    function renderizarParaImpressao() {
        const listaExpandida = [];
        etiquetas.forEach(item => {
            for(let i=0; i < item.qtde; i++) {
                listaExpandida.push(item);
            }
        });
        
        const layout = selectLayoutEtiqueta.value;
        etiquetasContainer.className = `layout-${layout}`;
        etiquetasContainer.innerHTML = '';
        
        let barcodeOptions, layoutClass, addLogoAndParcel;
        let showName = true;

        switch (layout) {
            case 'a4-18': layoutClass = 'etiqueta-simples'; addLogoAndParcel = false;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 62, margin: 2, height: 85, width: 10 }; break;
            case 'a4-4': layoutClass = 'etiqueta-pequena'; addLogoAndParcel = true;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 20, margin: 10, height: 100, width: 8 }; break;
            case 'a4-2': layoutClass = 'etiqueta-media'; addLogoAndParcel = true;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 20, margin: 10, height: 100, width: 4 }; break;
            case 'a4-1': layoutClass = 'etiqueta-grande'; addLogoAndParcel = true;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 22, margin: 10, height: 100, width: 5 }; break;
            
            // TÉRMICOS
            case 'thermal-60x30': 
                layoutClass = 'etiqueta-simples'; addLogoAndParcel = false;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 20, margin: 2, height: 40, width: 2 }; 
                break;
            case 'thermal-25x10': 
                layoutClass = 'etiqueta-mini'; addLogoAndParcel = false; showName = false;
                barcodeOptions = { format: "EAN13", displayValue: false, margin: 0, height: 25, width: 1.5 }; 
                break;
            case 'thermal-custom':
                layoutClass = 'etiqueta-custom'; addLogoAndParcel = false;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 14, margin: 2, height: 30, width: 2 };
                break;
        }

        listaExpandida.forEach((produto, index) => {
            const etiquetaDiv = document.createElement('div');
            etiquetaDiv.className = `etiqueta ${layoutClass}`;
            
            if (layout === 'thermal-custom') {
                const w = inputCustomWidth.value || 50;
                const h = inputCustomHeight.value || 30;
                etiquetaDiv.style.width = `${w}mm`;
                etiquetaDiv.style.height = `${h}mm`;
                etiquetaDiv.style.maxHeight = `${h}mm`;
            }

            let innerHTML = ''; 
            if (addLogoAndParcel) { innerHTML += `<div class="etiqueta-logo"><img src="img/logo.png"></div><div class="etiqueta-info-bloco">`; }
            
            if (showName) innerHTML += `<span class="etiqueta-nome">${produto.nome}</span>`;
            
            let precoHTML = addLogoAndParcel ? `<span class="currency-symbol">R$</span><span>${produto.preco.replace('R$', '').trim()}</span>` : produto.preco;
            innerHTML += `<span class="etiqueta-preco">${precoHTML}</span>`;
            
            if (addLogoAndParcel) { innerHTML += `<span class="etiqueta-parcelamento">ou em até 6x sem juros</span></div>`; }
            innerHTML += `<svg class="etiqueta-barcode"></svg>`;
            etiquetaDiv.innerHTML = innerHTML;
            etiquetasContainer.appendChild(etiquetaDiv);
            try { JsBarcode(etiquetaDiv.querySelector('.etiqueta-barcode'), produto.codigo, { ...barcodeOptions, text: produto.codigo }); } catch (e) {}
        });
    }

    function renderizarEtiquetas() {
        const layout = selectLayoutEtiqueta.value;
        etiquetasContainer.className = `layout-${layout}`;
        divCheckSimples.style.display = (layout === 'a4-18') ? 'inline-block' : 'none';
        
        if (etiquetas.length === 0) { etiquetasContainer.innerHTML = '<p class="placeholder">Nenhuma etiqueta.</p>'; return; }
        etiquetasContainer.innerHTML = '';
        
        let barcodeOptions, layoutClass, addLogoAndParcel;
        let showName = true;

        switch (layout) {
            case 'a4-18': layoutClass = 'etiqueta-simples'; addLogoAndParcel = false;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 62, margin: 2, height: 85, width: 10 }; break;
            case 'a4-4': layoutClass = 'etiqueta-pequena'; addLogoAndParcel = true;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 20, margin: 10, height: 100, width: 8 }; break;
            case 'a4-2': layoutClass = 'etiqueta-media'; addLogoAndParcel = true;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 20, margin: 10, height: 100, width: 4 }; break;
            case 'a4-1': layoutClass = 'etiqueta-grande'; addLogoAndParcel = true;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 22, margin: 10, height: 100, width: 5 }; break;
            case 'thermal-60x30': 
                layoutClass = 'etiqueta-simples'; addLogoAndParcel = false;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 20, margin: 2, height: 40, width: 2 }; 
                break;
            case 'thermal-25x10': 
                layoutClass = 'etiqueta-mini'; addLogoAndParcel = false; showName = false;
                barcodeOptions = { format: "EAN13", displayValue: false, margin: 0, height: 25, width: 1.5 }; 
                break;
            case 'thermal-custom':
                layoutClass = 'etiqueta-custom'; addLogoAndParcel = false;
                barcodeOptions = { format: "EAN13", displayValue: true, fontSize: 14, margin: 2, height: 30, width: 2 };
                break;
        }

        etiquetas.forEach((produto, index) => {
            const etiquetaDiv = document.createElement('div');
            etiquetaDiv.className = `etiqueta ${layoutClass}`;
            
            if (layout === 'thermal-custom') {
                const w = inputCustomWidth.value || 50;
                const h = inputCustomHeight.value || 30;
                etiquetaDiv.style.width = `${w}mm`;
                etiquetaDiv.style.height = `${h}mm`;
                etiquetaDiv.style.border = "1px dashed #333"; 
            }

            let innerHTML = `<button class="btn-acao etiqueta-remove-btn" data-index="${index}">
                                <img src="img/deny_icon.svg" class="icon-sm" alt="Remover">
                             </button>`;
            
            innerHTML += `<input type="number" class="etiqueta-qtde-input" value="${produto.qtde}" min="1" data-index="${index}" title="Quantidade">`;

            if (addLogoAndParcel) { innerHTML += `<div class="etiqueta-logo"><img src="img/logo.png"></div><div class="etiqueta-info-bloco">`; }
            
            if (showName) {
                innerHTML += `<span class="etiqueta-nome" contenteditable="true" title="Clique para editar">${produto.nome}</span>`;
            }
            
            let precoHTML;
            if (addLogoAndParcel) {
                precoHTML = `<span class="currency-symbol">R$</span><span contenteditable="true" title="Editar valor">${produto.preco.replace('R$', '').trim()}</span>`;
            } else {
                precoHTML = produto.preco;
            }
            
            let editavelAtributo = !addLogoAndParcel ? 'contenteditable="true"' : '';
            innerHTML += `<span class="etiqueta-preco" ${editavelAtributo}>${precoHTML}</span>`;
            
            if (addLogoAndParcel) { innerHTML += `<span class="etiqueta-parcelamento">ou em até 6x sem juros</span></div>`; }
            
            innerHTML += `<svg class="etiqueta-barcode"></svg>`;
            etiquetaDiv.innerHTML = innerHTML;
            etiquetasContainer.appendChild(etiquetaDiv);
            try { JsBarcode(etiquetaDiv.querySelector('.etiqueta-barcode'), produto.codigo, { ...barcodeOptions, text: produto.codigo }); }
            catch (e) { etiquetaDiv.querySelector('.etiqueta-barcode').outerHTML = `<span>Erro Barcode</span>`; }
        });
    }

    function limparEtiquetas() { if (etiquetas.length > 0 && confirm("Limpar tudo?")) { etiquetas = []; renderizarEtiquetas(); } }

    function onLayoutChange() {
        renderizarEtiquetas();
    }

    function prepararParaImpressao() {
        document.querySelectorAll('#inputs-cliente .valor-input').forEach(input => {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (input.value.trim() === '') { input.classList.add('esconder-na-impressao'); if (label) label.classList.add('esconder-na-impressao'); }
            else { input.classList.remove('esconder-na-impressao'); if (label) label.classList.remove('esconder-na-impressao'); }
        });
    }

    function reverterPosImpressao() { document.body.classList.remove('imprimindo-orcamento', 'imprimindo-etiquetas', 'layout-a4-2-active', 'imprimindo-etiqueta-unica', 'imprimindo-thermal-25x10', 'imprimindo-thermal-custom'); }

    function alternarAba(abaAtiva) {
        tabButtons.forEach(b => b.classList.toggle('active-tab', b.dataset.tab === abaAtiva));
        tabContents.forEach(c => c.classList.toggle('active-content', c.id === `tab-${abaAtiva}`));
    }

    function alternarAbaDireita(abaAtiva) {
        tabButtonsDireita.forEach(b => b.classList.toggle('active-tab-direita', b.dataset.tabDireita === abaAtiva));
        tabContentsDireita.forEach(c => c.classList.toggle('active-content-direita', c.id === `tab-${abaAtiva}-view`));
    }

    function formatarTelefone(event) {
        let v = event.target.value.replace(/\D/g, '');
        let f = '';
        if (v.length > 0) f += `(${v.substring(0, 2)}`;
        if (v.length > 2) f += `) ${v.substring(2, 7)}`;
        if (v.length > 7) f += `-${v.substring(7, 11)}`;
        event.target.value = f;
    }

    function formatarCpfCnpj(event) {
        let v = event.target.value.replace(/\D/g, '');
        if (v.length <= 11) event.target.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        else event.target.value = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }

    // --- 4. EVENT LISTENERS ---
    seletorArquivo.addEventListener('change', (e) => { 
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => processarConteudoHTML(event.target.result);
            reader.readAsText(e.target.files[0], 'iso-8859-1');
        }
    });
    
    caixaBusca.addEventListener('keyup', buscar);
    areaResultados.addEventListener('scroll', () => {
        if (!isRenderingBatch && areaResultados.scrollTop + areaResultados.clientHeight >= areaResultados.scrollHeight - 100) loadNextBatch();
    });

    btnImprimirOrcamento.addEventListener('click', () => {
        prepararParaImpressao();
        document.body.classList.add('imprimindo-orcamento');
        window.print(); setTimeout(reverterPosImpressao, 500);
    });

    // IMPRESSÃO DINÂMICA
    btnImprimirEtiquetas.addEventListener('click', () => {
        const layout = selectLayoutEtiqueta.value;
        sincronizarEdicoes();
        renderizarParaImpressao();

        document.body.className = '';

        // Cria elemento de estilo dinâmico para CUSTOM
        let dynamicStyle = document.getElementById('dynamic-print-style');
        if (!dynamicStyle) {
            dynamicStyle = document.createElement('style');
            dynamicStyle.id = 'dynamic-print-style';
            document.head.appendChild(dynamicStyle);
        }

        let cssPageRule = '';

        if (layout === 'a4-18' && checkEtiquetaUnica.checked) {
            document.body.classList.add('imprimindo-etiqueta-unica');
        } 
        else if (layout === 'thermal-60x30') {
            document.body.classList.add('imprimindo-etiqueta-unica');
            cssPageRule = `@page { size: 60mm 30mm; margin: 0; }`;
        }
        else if (layout === 'thermal-25x10') {
            document.body.classList.add('imprimindo-thermal-25x10');
            cssPageRule = `@page { size: 25mm 10mm; margin: 0; }`;
        }
        else if (layout === 'thermal-custom') {
            document.body.classList.add('imprimindo-thermal-custom');
            const w = inputCustomWidth.value || 50;
            const h = inputCustomHeight.value || 30;
            cssPageRule = `@page { size: ${w}mm ${h}mm; margin: 0; } @media print { .etiqueta { width: ${w}mm !important; height: ${h}mm !important; max-height: ${h}mm !important; } }`;
        } 
        else {
            document.body.classList.add('imprimindo-etiquetas');
            if (layout === 'a4-2') document.body.classList.add('layout-a4-2-active');
            cssPageRule = `@page { size: A4 portrait; margin: 0.5cm; }`;
        }

        if(cssPageRule) dynamicStyle.innerHTML = `@media print { ${cssPageRule} }`;
        else dynamicStyle.innerHTML = '';

        window.print(); 

        setTimeout(() => {
            document.body.className = ''; 
            renderizarEtiquetas(); 
        }, 500);
    });

    btnLimparEtiquetas.addEventListener('click', limparEtiquetas);
    
    etiquetasContainer.addEventListener('click', (e) => {
        const b = e.target.closest('.etiqueta-remove-btn');
        if (b) removerDaEtiqueta(parseInt(b.dataset.index));
    });
    
    etiquetasContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('etiqueta-qtde-input')) {
            atualizarQuantidadeEtiqueta(parseInt(e.target.dataset.index), e.target.value);
        }
    });

    selectLayoutEtiqueta.addEventListener('change', onLayoutChange);
    btnSalvarClientes.addEventListener('click', atualizarClienteNaLista);
    btnLimparOrcamento.addEventListener('click', limparOrcamento);
    selectVendedor.addEventListener('change', () => vendedorPrintSpan.textContent = selectVendedor.value);
    inputNomeCliente.addEventListener('change', () => preencherDadosCliente(inputNomeCliente.value));
    inputTelefoneCliente.addEventListener('keyup', formatarTelefone);
    inputCpfCliente.addEventListener('keyup', formatarCpfCnpj);
    caixaBuscaClientes.addEventListener('keyup', buscarClientes);

    listaClientesWrapper.addEventListener('click', (e) => {
        const l = e.target.closest('tr');
        if (l && l.dataset.index) {
            listaClientesWrapper.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
            l.classList.add('selected'); preencherDadosClienteOrcamento(l.dataset.index);
        }
    });

    btnNovoCliente.addEventListener('click', () => camposClienteInputs.forEach(i => i.value = ''));
    btnExportarClientes.addEventListener('click', exportarClientes);

    areaResultados.addEventListener('click', (e) => {
        const be = e.target.closest('.btn-acao-etiqueta'), l = e.target.closest('tr');
        if (be) adicionarNaEtiqueta(be.dataset.codigo);
        else if (l && l.dataset.codigo) {
            const p = fullProductList.find(x => x.codigo === l.dataset.codigo);
            if (p) { modoEdicao = false; abrirModal(p); }
        }
    });

    areaOrcamentoItens.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b || !b.dataset.codigo) return;
        if (b.classList.contains('remove-btn')) removerDoOrcamento(b.dataset.codigo);
    });

    areaOrcamentoItens.addEventListener('blur', (e) => {
        if (e.target.classList.contains('col-qtde')) atualizarQuantidade(e);
        else if (e.target.classList.contains('col-preco')) atualizarPreco(e);
    }, true);

    btnConfirmarQtde.addEventListener('click', salvarQuantidade);
    document.getElementById('btn-cancelar-qtde').addEventListener('click', fecharModal);
    inputQtde.addEventListener('keyup', (e) => { if (e.key === 'Enter') salvarQuantidade(); });
    tabButtons.forEach(b => b.addEventListener('click', () => alternarAba(b.dataset.tab)));
    tabButtonsDireita.forEach(b => b.addEventListener('click', () => alternarAbaDireita(b.dataset.tabDireita)));

    // --- 5. INICIALIZAÇÃO ---
    const d = new Date();
    document.getElementById('data-orcamento').textContent = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} - ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    carregarProdutosAutomatico(); 
    carregarClientes();
    vendedorPrintSpan.textContent = selectVendedor.value;
});