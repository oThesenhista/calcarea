// VERSÃO COM MARGEM INTERNA NA EXPORTAÇÃO

// A variável de estado agora é 'let' para permitir a reatribuição total ao resetar.
let appState;

// Uma função que retorna um objeto de estado padrão limpo.
function getDefaultState() {
    return {
        area: {
            paredeFrontal: 5,
            paredeTraseira: 5,
            paredeEsquerda: 2,
            paredeDireita: 2,
            paredeSelecionadaId: null,
            obstaculos: [],
            obstaculoSelecionadoId: null, 
        },
        peca: {
            largura: 0.30,
            comprimento: 0.30,
            padrao: 'grade',
            rotacionar: false,
            isCustom: false,
            modoTijoloCustom: false
        },
        ui: {
            isObstacleEditorVisible: false
        }
    };
}

let renderedButtonRect = null; 

const PAREDE_MAP = {
    1: { inputId: 'paredeFrontal', groupId: 'input-group-frontal' },
    2: { inputId: 'paredeDireita', groupId: 'input-group-direita' },
    3: { inputId: 'paredeTraseira', groupId: 'input-group-traseira' },
    4: { inputId: 'paredeEsquerda', groupId: 'input-group-esquerda' },
};

// --- Funções Auxiliares e de Desenho (Inalteradas) ---
let timeoutId = null;
function debounce(func, delay) { clearTimeout(timeoutId); timeoutId = setTimeout(func, delay); }
function pontoDentroPoligono(x, y, poligono) { let dentro = false; for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) { const xi = poligono[i].x, yi = poligono[i].y; const xj = poligono[j].x, yj = poligono[j].y; const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi); if (intersect) dentro = !dentro; } return dentro; }
function gerarPontosIrregulares(pFrontal, pTraseira, pEsquerda, pDireita) { return [ { x: 0, y: 0 }, { x: pFrontal, y: 0 }, { x: pTraseira, y: pDireita }, { x: 0, y: pEsquerda } ]; }
function calcularArea(poligono) { let area = 0; for (let i = 0; i < poligono.length; i++) { const j = (i + 1) % poligono.length; area += poligono[i].x * poligono[j].y; area -= poligono[j].x * poligono[i].y; } return Math.abs(area / 2); }
function centralizarPoligono(poligono, canvas) { const minX = Math.min(...poligono.map(p => p.x)); const maxX = Math.max(...poligono.map(p => p.x)); const minY = Math.min(...poligono.map(p => p.y)); const maxY = Math.max(...poligono.map(p => p.y)); let larguraPoligono = maxX - minX; let alturaPoligono = maxY - minY; if (larguraPoligono === 0) larguraPoligono = 1; if (alturaPoligono === 0) alturaPoligono = 1; const escalaX = canvas.width / larguraPoligono / 1.1; const escalaY = canvas.height / alturaPoligono / 1.1; const escala = Math.min(escalaX, escalaY); const offsetX = (canvas.width / 2) - (minX + larguraPoligono / 2) * escala; const offsetY = (canvas.height / 2) - (minY + alturaPoligono / 2) * escala; const pontosCentralizados = poligono.map(p => ({ x: p.x * escala + offsetX, y: p.y * escala + offsetY })); return { pontosCentralizados, escala }; }
function retanguloCruzaPoligono(retangulo, poligono) { const [x, y, largura, comprimento] = retangulo; const cantos = [ { x: x, y: y }, { x: x + largura, y: y }, { x: x + largura, y: y + comprimento }, { x: x, y: y + comprimento } ]; if (cantos.some(p => pontoDentroPoligono(p.x, p.y, poligono))) return true; if (poligono.some(p => p.x >= x && p.x <= x + largura && p.y >= y && p.y <= y + comprimento)) return true; for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) { if (linhaCruzaRetangulo(poligono[i], poligono[j], retangulo)) return true; } return false; }
function linhaCruzaRetangulo(p1, p2, retangulo) { const [rx, ry, rw, rh] = retangulo; const retanguloPontos = [ { x: rx, y: ry }, { x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh } ]; for (let i = 0; i < 4; i++) { if (linhaCruzaLinha(p1, p2, retanguloPontos[i], retanguloPontos[(i + 1) % 4])) return true; } return false; }
function linhaCruzaLinha(p1, p2, p3, p4) { const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x); if (det === 0) return false; const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / det; const u = -((p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)) / det; return t >= 0 && t <= 1 && u >= 0 && u <= 1; }
function distanciaPontoLinha(px, py, p1, p2) { const L2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2; if (L2 === 0) return Math.sqrt((px - p1.x)**2 + (py - p1.y)**2); let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / L2; t = Math.max(0, Math.min(1, t)); const projeçãoX = p1.x + t * (p2.x - p1.x); const projeçãoY = p1.y + t * (p2.y - p1.y); return Math.sqrt((px - projeçãoX)**2 + (py - projeçãoY)**2); }
function desenharPecasNaArea(ctx, poligono, escala, obstaculosRenderizados) { const { largura, comprimento, rotacionar, padrao } = appState.peca; const minXPoligono = Math.min(...poligono.map(p => p.x)); const maxXPoligono = Math.max(...poligono.map(p => p.x)); const minYPoligono = Math.min(...poligono.map(p => p.y)); const maxYPoligono = Math.max(...poligono.map(p => p.y)); let contador = 0; let larguraPx = rotacionar ? comprimento * escala : largura * escala; let comprimentoPx = rotacionar ? largura * escala : comprimento * escala; if (larguraPx <= 0 || comprimentoPx <= 0) return 0; const colideComObstaculo = (pecaRect) => { for (const obsRect of obstaculosRenderizados) { if (pecaRect.x < obsRect.x + obsRect.largura && pecaRect.x + pecaRect.largura > obsRect.x && pecaRect.y < obsRect.y + obsRect.altura && pecaRect.y + pecaRect.altura > obsRect.y) { return true; } } return false; }; const desenharPecaSeValido = (x, y, larg, comp) => { const pecaRect = { x, y, largura: larg, altura: comp }; if (retanguloCruzaPoligono([x, y, larg, comp], poligono) && !colideComObstaculo(pecaRect)) { ctx.strokeRect(x, y, larg, comp); return true; } return false; }; if (padrao === 'grade') { for (let y = minYPoligono; y < maxYPoligono; y += comprimentoPx) { for (let x = minXPoligono; x < maxXPoligono; x += larguraPx) { if (desenharPecaSeValido(x, y, larguraPx, comprimentoPx)) contador++; } } } else if (padrao === 'tijolo') { let linha = 0; for (let y = minYPoligono; y < maxYPoligono; y += comprimentoPx) { let xOffset = (linha % 2 === 1) ? -larguraPx / 2 : 0; for (let x = minXPoligono + xOffset; x < maxXPoligono; x += larguraPx) { if (desenharPecaSeValido(x, y, larguraPx, comprimentoPx)) contador++; } linha++; } } return contador; }

function render() {
    const { paredeFrontal, paredeTraseira, paredeEsquerda, paredeDireita } = appState.area; const { largura, comprimento } = appState.peca; if (isNaN(paredeFrontal) || isNaN(paredeTraseira) || isNaN(paredeEsquerda) || isNaN(paredeDireita) || isNaN(largura) || isNaN(comprimento) || paredeFrontal <= 0 || paredeTraseira <= 0 || paredeEsquerda <= 0 || paredeDireita <= 0 || largura <= 0 || comprimento <= 0) { document.getElementById("resultado").textContent = "Por favor, insira valores válidos e maiores que zero."; const canvas = document.getElementById("desenho"); const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    const canvas = document.getElementById("desenho"); const ctx = canvas.getContext("2d");
    renderedButtonRect = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height); const pontosOriginais = gerarPontosIrregulares(paredeFrontal, paredeTraseira, paredeEsquerda, paredeDireita); const { pontosCentralizados, escala } = centralizarPoligono(pontosOriginais, canvas); let areaTotal = calcularArea(pontosOriginais); const paredes = [ { id: 1, name: "Área Acima", dim: paredeFrontal, p1: pontosCentralizados[0], p2: pontosCentralizados[1] }, { id: 2, name: "Área Direita", dim: paredeDireita, p1: pontosCentralizados[1], p2: pontosCentralizados[2] }, { id: 3, name: "Área Abaixo", dim: paredeTraseira, p1: pontosCentralizados[2], p2: pontosCentralizados[3] }, { id: 4, name: "Área Esquerda", dim: paredeEsquerda, p1: pontosCentralizados[3], p2: pontosCentralizados[0] } ]; const obstaculosRenderizados = []; appState.area.obstaculos.forEach(obs => { const parede = paredes.find(p => p.id === obs.paredeId); if (!parede) return; const vetorParedeX = parede.p2.x - parede.p1.x; const vetorParedeY = parede.p2.y - parede.p1.y; const comprimentoParedeCanvas = Math.sqrt(vetorParedeX**2 + vetorParedeY**2); if(comprimentoParedeCanvas === 0) return; const posNaLinha = (obs.posicao * escala) / comprimentoParedeCanvas; const xInicial = parede.p1.x + vetorParedeX * posNaLinha; const yInicial = parede.p1.y + vetorParedeY * posNaLinha; const anguloParede = Math.atan2(vetorParedeY, vetorParedeX); ctx.save(); ctx.translate(xInicial, yInicial); ctx.rotate(anguloParede); const obsRectLocal = { x: 0, y: -(obs.altura * escala) / 2, largura: obs.largura * escala, altura: obs.altura * escala }; ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.strokeStyle = "#888"; ctx.lineWidth = 2; ctx.fillRect(obsRectLocal.x, obsRectLocal.y, obsRectLocal.largura, obsRectLocal.altura); ctx.strokeRect(obsRectLocal.x, obsRectLocal.y, obsRectLocal.largura, obsRectLocal.altura); ctx.restore(); obstaculosRenderizados.push({ x: xInicial, y: yInicial - obsRectLocal.altura / 2, largura: obsRectLocal.largura, altura: obsRectLocal.altura }); });
    ctx.save(); ctx.beginPath(); ctx.moveTo(pontosCentralizados[0].x, pontosCentralizados[0].y); for (let i = 1; i < pontosCentralizados.length; i++) ctx.lineTo(pontosCentralizados[i].x, pontosCentralizados[i].y); ctx.closePath(); ctx.clip(); ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; ctx.strokeStyle = "#333"; ctx.lineWidth = 1; const quantidade = desenharPecasNaArea(ctx, pontosCentralizados, escala, obstaculosRenderizados); ctx.restore();
    ctx.font = "bold 14px Arial"; paredes.forEach((parede, index) => { ctx.beginPath(); ctx.moveTo(parede.p1.x, parede.p1.y); ctx.lineTo(parede.p2.x, parede.p2.y); if (parede.id === appState.area.paredeSelecionadaId) { ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 8; } else { ctx.strokeStyle = "#3a4572"; ctx.lineWidth = 4; } ctx.stroke(); ctx.fillStyle = "#3a4572"; const meio = { x: (parede.p1.x + parede.p2.x) / 2, y: (parede.p1.y + parede.p2.y) / 2 }; const angulo = Math.atan2(parede.p2.y - parede.p1.y, parede.p2.x - parede.p1.x); ctx.save(); ctx.translate(meio.x, meio.y); ctx.rotate(angulo); ctx.textAlign = "center"; ctx.textBaseline = "middle"; let offsetY = -15; if (angulo > Math.PI / 2 || angulo < -Math.PI / 2) { if (index !== 1 || parede.p1.x <= parede.p2.x) ctx.rotate(Math.PI); } if (index === 2) offsetY = 15; ctx.fillText(`${parede.name}: ${parede.dim.toFixed(2)}m`, 0, offsetY); ctx.restore(); });
    if (appState.area.paredeSelecionadaId !== null) { const buttonWidth = 180; const buttonHeight = 40; const bottomMargin = 20; renderedButtonRect = { x: (canvas.width - buttonWidth) / 2, y: canvas.height - buttonHeight - bottomMargin, width: buttonWidth, height: buttonHeight }; ctx.fillStyle = '#3a4572'; ctx.beginPath(); ctx.roundRect(renderedButtonRect.x, renderedButtonRect.y, renderedButtonRect.width, renderedButtonRect.height, 8); ctx.fill(); ctx.fillStyle = 'white'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Editar Obstáculos', renderedButtonRect.x + buttonWidth / 2, renderedButtonRect.y + buttonHeight / 2); }
    document.getElementById("resultado").textContent = `Área: ${areaTotal.toFixed(2)} m² — Peças necessárias: ${quantidade}`;
    atualizarDestaquePainel();
    gerenciarVisibilidadePainelObstaculo();
    atualizarListaDeObstaculos();
}

// --- Funções de UI e Interação ---

function gerenciarVisibilidadePainelObstaculo() { const painel = document.getElementById('obstacle-editor'); const backdrop = document.getElementById('modal-backdrop'); if (appState.ui.isObstacleEditorVisible) { painel.classList.add('visible'); backdrop.classList.add('visible'); } else { painel.classList.remove('visible'); backdrop.classList.remove('visible'); } }
function atualizarListaDeObstaculos() { const listaUI = document.getElementById('obstacleList'); const editorTitle = document.querySelector('#obstacle-editor h3'); const editorButton = document.getElementById('addObstacleBtn'); listaUI.innerHTML = ''; if (!appState.ui.isObstacleEditorVisible) return; const obstaculosDaParede = appState.area.obstaculos.filter( obs => obs.paredeId === appState.area.paredeSelecionadaId ); if (obstaculosDaParede.length === 0) { listaUI.innerHTML = '<li>Nenhum obstáculo nesta parede.</li>'; } else { obstaculosDaParede.forEach(obs => { const item = document.createElement('li'); if (obs.id === appState.area.obstaculoSelecionadoId) item.classList.add('editing'); item.innerHTML = `L: ${obs.largura}m, A: ${obs.altura}m @ ${obs.posicao}m <button class="delete-btn" data-id="${obs.id}">&times;</button>`; item.addEventListener('click', () => selecionarObstaculoParaEdicao(obs.id)); listaUI.appendChild(item); }); } listaUI.querySelectorAll('.delete-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); deletarObstaculo(parseInt(e.target.dataset.id)); }); }); if (appState.area.obstaculoSelecionadoId !== null) { editorTitle.textContent = "Editando Obstáculo"; editorButton.textContent = "Salvar Alterações"; editorButton.style.backgroundColor = '#007bff'; } else { editorTitle.textContent = "Editor de Obstáculos"; editorButton.textContent = "Adicionar Obstáculo"; editorButton.style.backgroundColor = '#28a745'; } }
function selecionarObstaculoParaEdicao(obstaculoId) { if (appState.area.obstaculoSelecionadoId === obstaculoId) { appState.area.obstaculoSelecionadoId = null; document.getElementById('larguraObstaculo').value = '1.00'; document.getElementById('alturaObstaculo').value = '1.20'; document.getElementById('posicaoObstaculo').value = '0.50'; } else { appState.area.obstaculoSelecionadoId = obstaculoId; const obstaculo = appState.area.obstaculos.find(obs => obs.id === obstaculoId); if (obstaculo) { document.getElementById('larguraObstaculo').value = obstaculo.largura.toFixed(2); document.getElementById('alturaObstaculo').value = obstaculo.altura.toFixed(2); document.getElementById('posicaoObstaculo').value = obstaculo.posicao.toFixed(2); } } atualizarListaDeObstaculos(); }
function salvarObstaculo() { if (appState.area.obstaculoSelecionadoId !== null) { appState.area.obstaculos = appState.area.obstaculos.map(obs => { if (obs.id === appState.area.obstaculoSelecionadoId) { return { ...obs, largura: parseFloat(document.getElementById('larguraObstaculo').value), altura: parseFloat(document.getElementById('alturaObstaculo').value), posicao: parseFloat(document.getElementById('posicaoObstaculo').value) }; } return obs; }); } else { const paredeId = appState.area.paredeSelecionadaId; if (paredeId === null) { alert("Por favor, selecione uma parede primeiro."); return; } const largura = parseFloat(document.getElementById('larguraObstaculo').value); const altura = parseFloat(document.getElementById('alturaObstaculo').value); const posicao = parseFloat(document.getElementById('posicaoObstaculo').value); if (isNaN(largura) || isNaN(altura) || isNaN(posicao) || largura <= 0 || altura <= 0 || posicao < 0) { alert("Por favor, insira valores válidos para o obstáculo."); return; } appState.area.obstaculos.push({ id: Date.now(), paredeId, largura, altura, posicao }); } appState.area.obstaculoSelecionadoId = null; document.getElementById('larguraObstaculo').value = '1.00'; document.getElementById('alturaObstaculo').value = '1.20'; document.getElementById('posicaoObstaculo').value = '0.50'; render(); }
function deletarObstaculo(idParaDeletar) { appState.area.obstaculos = appState.area.obstaculos.filter(obs => obs.id !== idParaDeletar); if (appState.area.obstaculoSelecionadoId === idParaDeletar) { appState.area.obstaculoSelecionadoId = null; } render(); }
function fecharEditorDeObstaculos() { appState.ui.isObstacleEditorVisible = false; render(); }
function handleCanvasClick(event) { const canvas = event.target; const rect = canvas.getBoundingClientRect(); const mouseX = event.clientX - rect.left; const mouseY = event.clientY - rect.top; if (renderedButtonRect && mouseX >= renderedButtonRect.x && mouseX <= renderedButtonRect.x + renderedButtonRect.width && mouseY >= renderedButtonRect.y && mouseY <= renderedButtonRect.y + renderedButtonRect.height) { appState.ui.isObstacleEditorVisible = true; render(); return; } const { paredeFrontal, paredeTraseira, paredeEsquerda, paredeDireita } = appState.area; const pontosOriginais = gerarPontosIrregulares(paredeFrontal, paredeTraseira, paredeEsquerda, paredeDireita); const { pontosCentralizados } = centralizarPoligono(pontosOriginais, canvas); const paredes = [ { id: 1, p1: pontosCentralizados[0], p2: pontosCentralizados[1] }, { id: 2, p1: pontosCentralizados[1], p2: pontosCentralizados[2] }, { id: 3, p1: pontosCentralizados[2], p2: pontosCentralizados[3] }, { id: 4, p1: pontosCentralizados[3], p2: pontosCentralizados[0] } ]; let paredeClicadaId = null; let menorDistancia = Infinity; const threshold = 10; paredes.forEach(parede => { const dist = distanciaPontoLinha(mouseX, mouseY, parede.p1, parede.p2); if (dist < menorDistancia && dist < threshold) { menorDistancia = dist; paredeClicadaId = parede.id; } }); appState.ui.isObstacleEditorVisible = false; if (appState.area.paredeSelecionadaId === paredeClicadaId) { appState.area.paredeSelecionadaId = null; } else { appState.area.paredeSelecionadaId = paredeClicadaId; } appState.area.obstaculoSelecionadoId = null; render(); }
function atualizarDestaquePainel() { for (const paredeId in PAREDE_MAP) { const groupId = PAREDE_MAP[paredeId].groupId; const groupElement = document.getElementById(groupId); if (groupElement) { if (paredeId == appState.area.paredeSelecionadaId) { groupElement.classList.add('highlight'); } else { groupElement.classList.remove('highlight'); } } } }

// --- Funções de Projeto ---

function salvarProjeto() {
    try {
        const dadosSalvos = JSON.stringify(appState);
        localStorage.setItem('projetoCalculadoraGemini', dadosSalvos);
        alert('Projeto salvo com sucesso!');
    } catch (error) {
        console.error("Erro ao salvar o projeto:", error);
        alert('Ocorreu um erro ao salvar o projeto.');
    }
}

function carregarProjeto() {
    const dadosSalvos = localStorage.getItem('projetoCalculadoraGemini');
    if (dadosSalvos) {
        try {
            const estadoCarregado = JSON.parse(dadosSalvos);
            appState = estadoCarregado;
            sincronizarInputsComEstado();
            render();
            alert('Projeto carregado com sucesso!');
        } catch (error) {
            console.error("Erro ao carregar o projeto:", error);
            alert('Não foi possível carregar o projeto. Os dados podem estar corrompidos.');
        }
    } else {
        alert('Nenhum projeto salvo encontrado.');
    }
}

function sincronizarInputsComEstado() {
    document.getElementById('paredeFrontal').value = appState.area.paredeFrontal;
    document.getElementById('paredeTraseira').value = appState.area.paredeTraseira;
    document.getElementById('paredeEsquerda').value = appState.area.paredeEsquerda;
    document.getElementById('paredeDireita').value = appState.area.paredeDireita;
}

// MODIFICADO: Função de exportação agora adiciona margem e fundo branco
function exportarComoImagem() {
    // 1. Prepara uma versão "limpa" do canvas para exportação
    const paredeSelecionadaOriginal = appState.area.paredeSelecionadaId;
    appState.area.paredeSelecionadaId = null;
    render(); 

    const canvasOriginal = document.getElementById('desenho');
    
    // 2. Cria um novo canvas temporário com margens
    const margem = 30; // 30 pixels de cada lado
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasOriginal.width + (margem * 2);
    tempCanvas.height = canvasOriginal.height + (margem * 2);
    const tempCtx = tempCanvas.getContext('2d');

    // 3. Pinta o fundo do novo canvas de branco
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // 4. Desenha o conteúdo do canvas original no centro do novo canvas
    tempCtx.drawImage(canvasOriginal, margem, margem);

    // 5. Gera a URL da imagem a partir do canvas temporário
    const urlImagem = tempCanvas.toDataURL('image/png');

    // 6. Cria o link de download
    const link = document.createElement('a');
    link.href = urlImagem;
    link.download = 'plano-calculado.png'; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 7. Restaura a visualização original para o usuário
    appState.area.paredeSelecionadaId = paredeSelecionadaOriginal;
    render();
}

function resetarProjeto() {
    const confirmacao = confirm('Tem certeza que deseja resetar o projeto? Todo o progresso não salvo será perdido.');
    if (confirmacao) {
        localStorage.removeItem('projetoCalculadoraGemini');
        appState = getDefaultState();
        sincronizarInputsComEstado();
        render();
        alert('Projeto resetado para o padrão.');
    }
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    document.getElementById('addObstacleBtn').addEventListener('click', salvarObstaculo);
    document.querySelector('#obstacle-editor .close-btn').addEventListener('click', fecharEditorDeObstaculos);
    document.getElementById('modal-backdrop').addEventListener('click', fecharEditorDeObstaculos);
    document.getElementById("desenho").addEventListener("click", handleCanvasClick);
    document.getElementById('saveProjectBtn').addEventListener('click', salvarProjeto);
    document.getElementById('loadProjectBtn').addEventListener('click', carregarProjeto);
    document.getElementById('exportProjectBtn').addEventListener('click', exportarComoImagem);
    document.getElementById('resetProjectBtn').addEventListener('click', resetarProjeto);
    
    document.querySelectorAll("#esquerda .spinner-input").forEach(input => {
        const paredeId = Object.keys(PAREDE_MAP).find( key => PAREDE_MAP[key].inputId === input.id );
        if (paredeId) {
            input.addEventListener("input", (event) => { const value = parseFloat(event.target.value) || 0; const stateKey = PAREDE_MAP[paredeId].inputId; appState.area[stateKey] = value; debounce(render, 300); });
            input.addEventListener("focus", () => {
                appState.area.paredeSelecionadaId = parseInt(paredeId);
                appState.area.obstaculoSelecionadoId = null;
                appState.ui.isObstacleEditorVisible = false;
                render();
            });
        }
    });
    document.querySelectorAll(".spinner-button").forEach(button => { button.addEventListener("click", () => { const inputId = button.dataset.inputId; const inputElement = document.getElementById(inputId); if (!inputElement.closest('#calculadoraForm')) return; const action = button.dataset.action; let value = parseFloat(inputElement.value) || 0; const step = parseFloat(inputElement.step) || 1; if (action === "increment") value += step; else if (action === "decrement") value -= step; inputElement.value = value.toFixed(2); inputElement.dispatchEvent(new Event('input', { bubbles: true })); }); });
    document.getElementById("pecaSelect").addEventListener("change", (event) => { const selectedValue = event.target.value; const customDimensionsDiv = document.getElementById("custom-dimensions"); if (selectedValue === "custom") { customDimensionsDiv.style.display = "block"; appState.peca.isCustom = true; appState.peca.largura = parseFloat(document.getElementById("larguraPeca").value); appState.peca.comprimento = parseFloat(document.getElementById("comprimentoPeca").value); appState.peca.padrao = appState.peca.modoTijoloCustom ? 'tijolo' : 'grade'; } else { customDimensionsDiv.style.display = "none"; appState.peca.isCustom = false; const [padrao, largura, comprimento] = selectedValue.split(","); appState.peca.padrao = padrao; appState.peca.largura = parseFloat(largura); appState.peca.comprimento = parseFloat(comprimento); } render(); });
    document.getElementById("larguraPeca").addEventListener("input", (e) => { appState.peca.largura = parseFloat(e.target.value) || 0; debounce(render, 300); });
    document.getElementById("comprimentoPeca").addEventListener("input", (e) => { appState.peca.comprimento = parseFloat(e.target.value) || 0; debounce(render, 300); });
    document.getElementById("rotacionar").addEventListener("change", (e) => { appState.peca.rotacionar = e.target.checked; render(); });
    document.getElementById("modoTijoloCustom").addEventListener("change", (e) => { appState.peca.modoTijoloCustom = e.target.checked; if (appState.peca.isCustom) { appState.peca.padrao = e.target.checked ? 'tijolo' : 'grade'; render(); } });
    document.getElementById("calculadoraForm").addEventListener("submit", (event) => { event.preventDefault(); });
}

// --- Inicialização da Aplicação ---
function iniciarApp() {
    const dadosSalvos = localStorage.getItem('projetoCalculadoraGemini');
    if (dadosSalvos) {
        try {
            appState = JSON.parse(dadosSalvos);
            appState.ui = { isObstacleEditorVisible: false };
            appState.area.paredeSelecionadaId = null;
            appState.area.obstaculoSelecionadoId = null;
            console.log("Projeto anterior carregado automaticamente.");
        } catch(e) {
            console.error("Não foi possível carregar os dados salvos.", e);
            appState = getDefaultState();
        }
    } else {
        appState = getDefaultState();
    }
    
    sincronizarInputsComEstado();
    setupEventListeners();
    render();
}

iniciarApp();