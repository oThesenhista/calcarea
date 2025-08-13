// VERSÃO 4.0 - REINTEGRAÇÃO COMPLETA DO EDITOR DE OBSTÁCULOS

let appState;

function getDefaultState() {
    return {
        comodos: [
            { 
                id: 1, 
                pontos: [ {x: 0, y: 0}, {x: 5, y: 0}, {x: 5, y: 5}, {x: 0, y: 5} ],
                obstaculos: [], 
            },
            { 
                id: 2,
                pontos: [ {x: 6, y: 1}, {x: 8, y: 1}, {x: 8, y: 3}, {x: 6, y: 3} ],
                obstaculos: [], 
            }
        ],
        peca: {
            largura: 0.30,
            comprimento: 0.30,
            padrao: 'grade',
            rotacionar: false,
            isCustom: false,
            modoToloCustom: false
        },
        ui: {
            modoAtual: 'selecao',
            comodoAtivoId: 1,
            verticeSendoArrastado: null, 
            paredeSelecionadaIndex: null,
            obstaculoSelecionadoId: null, 
            isPanning: false,
            panStartX: 0,
            panStartY: 0,
            paredeEmDestaqueIndex: null,
            isDragging: false, 
            isWallDragging: false,
            dragLastX: 0,
            dragLastY: 0,
            isObstacleEditorVisible: false,
        },
        viewport: {
            escala: 50,
            offsetX: 100,
            offsetY: 100,
        }
    };
}

let renderedButtons = {}; 

// --- Funções Auxiliares e de Desenho ---
function pontoDentroPoligono(ponto, poligono) { let dentro = false; for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) { const xi = poligono[i].x, yi = poligono[i].y; const xj = poligono[j].x, yj = poligono[j].y; const intersect = ((yi > ponto.y) !== (yj > ponto.y)) && (ponto.x < (xj - xi) * (ponto.y - yi) / (yj - yi) + xi); if (intersect) dentro = !dentro; } return dentro; }
function calcularArea(poligono) { let area = 0; for (let i = 0; i < poligono.length; i++) { const j = (i + 1) % poligono.length; area += poligono[i].x * poligono[j].y; area -= poligono[j].x * poligono[i].y; } return Math.abs(area / 2); }
function desenharPecasNaArea(ctx, poligono, obstaculos) { const { largura, comprimento, rotacionar, padrao } = appState.peca; const minXPoligono = Math.min(...poligono.map(p => p.x)); const maxXPoligono = Math.max(...poligono.map(p => p.x)); const minYPoligono = Math.min(...poligono.map(p => p.y)); const maxYPoligono = Math.max(...poligono.map(p => p.y)); let contador = 0; let larguraPx = rotacionar ? comprimento : largura; let comprimentoPx = rotacionar ? largura : comprimento; if (larguraPx <= 0 || comprimentoPx <= 0) return 0; const colideComObstaculo = (pecaRect) => { for (const obsRect of obstaculos) { if (pecaRect.x < obsRect.x + obsRect.largura && pecaRect.x + pecaRect.largura > obsRect.x && pecaRect.y < obsRect.y + obsRect.altura && pecaRect.y + pecaRect.altura > obsRect.y) return true; } return false; }; const desenharPecaSeValido = (x, y, larg, comp) => { const pecaRect = { x, y, largura: larg, altura: comp }; if (retanguloCruzaPoligono([x, y, larg, comp], poligono) && !colideComObstaculo(pecaRect)) { ctx.strokeRect(x, y, larg, comp); return true; } return false; }; if (padrao === 'grade') { for (let y = minYPoligono; y < maxYPoligono; y += comprimentoPx) { for (let x = minXPoligono; x < maxXPoligono; x += larguraPx) { if (desenharPecaSeValido(x, y, larguraPx, comprimentoPx)) contador++; } } } else if (padrao === 'tijolo') { let linha = 0; for (let y = minYPoligono; y < maxYPoligono; y += comprimentoPx) { let xOffset = (linha % 2 === 1) ? -larguraPx / 2 : 0; for (let x = minXPoligono + xOffset; x < maxXPoligono; x += larguraPx) { if (desenharPecaSeValido(x, y, larguraPx, comprimentoPx)) contador++; } linha++; } } return contador; }
function distanciaPontoLinha(px, py, p1, p2) { const L2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2; if (L2 === 0) return Math.sqrt((px - p1.x)**2 + (py - p1.y)**2); let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / L2; t = Math.max(0, Math.min(1, t)); const projeçãoX = p1.x + t * (p2.x - p1.x); const projeçãoY = p1.y + t * (p2.y - p1.y); return Math.sqrt((px - projeçãoX)**2 + (py - projeçãoY)**2); }
function retanguloCruzaPoligono(retangulo, poligono) { const [x, y, largura, comprimento] = retangulo; const cantos = [ { x: x, y: y }, { x: x + largura, y: y }, { x: x + largura, y: y + comprimento }, { x: x, y: y + comprimento } ]; if (cantos.some(p => pontoDentroPoligono(p, poligono))) return true; if (poligono.some(p => p.x >= x && p.x <= x + largura && p.y >= y && p.y <= y + comprimento)) return true; for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) { if (linhaCruzaRetangulo(poligono[i], poligono[j], retangulo)) return true; } return false; }
function linhaCruzaRetangulo(p1, p2, retangulo) { const [rx, ry, rw, rh] = retangulo; const retanguloPontos = [ { x: rx, y: ry }, { x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh } ]; for (let i = 0; i < 4; i++) { if (linhaCruzaLinha(p1, p2, retanguloPontos[i], retanguloPontos[(i + 1) % 4])) return true; } return false; }
function linhaCruzaLinha(p1, p2, p3, p4) { const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x); if (det === 0) return false; const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / det; const u = -((p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)) / det; return t >= 0 && t <= 1 && u >= 0 && u <= 1; }

function render() {
    const canvas = document.getElementById("desenho");
    const ctx = canvas.getContext("2d");
    renderedButtons = {};
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let areaTotal = 0;
    let quantidadeTotal = 0;
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);

    ctx.save();
    ctx.translate(appState.viewport.offsetX, appState.viewport.offsetY);
    ctx.scale(appState.viewport.escala, appState.viewport.escala);
    
    appState.comodos.forEach(comodo => {
        const pontosOriginais = comodo.pontos;
        const comodoEAtivo = (comodo.id === appState.ui.comodoAtivoId);
        areaTotal += calcularArea(pontosOriginais);
        
        const obstaculosRenderizados = []; 
        comodo.obstaculos.forEach(obs => {
            const p1 = pontosOriginais[obs.paredeIndex];
            const p2 = pontosOriginais[(obs.paredeIndex + 1) % pontosOriginais.length];
            if(!p1 || !p2) return;
            const vetorParedeX = p2.x - p1.x;
            const vetorParedeY = p2.y - p1.y;
            const comprimentoParede = Math.sqrt(vetorParedeX**2 + vetorParedeY**2);
            if(comprimentoParede === 0) return;
            const posNaLinha = obs.posicao / comprimentoParede;
            const xInicial = p1.x + vetorParedeX * posNaLinha;
            const yInicial = p1.y + vetorParedeY * posNaLinha;
            const anguloParede = Math.atan2(vetorParedeY, vetorParedeX);
            ctx.save();
            ctx.translate(xInicial, yInicial);
            ctx.rotate(anguloParede);
            const obsRectLocal = { x: 0, y: -obs.altura / 2, largura: obs.largura, altura: obs.altura };
            ctx.fillStyle = "white";
            ctx.strokeStyle = "#888";
            ctx.lineWidth = 2 / appState.viewport.escala;
            ctx.fillRect(obsRectLocal.x, obsRectLocal.y, obsRectLocal.largura, obsRectLocal.altura);
            ctx.strokeRect(obsRectLocal.x, obsRectLocal.y, obsRectLocal.largura, obsRectLocal.altura);
            ctx.restore();
            obstaculosRenderizados.push({ x: xInicial, y: yInicial - obs.altura / 2, largura: obs.largura, altura: obs.altura });
        });

        if (!appState.ui.isDragging && !appState.ui.isPanning) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pontosOriginais[0].x, pontosOriginais[0].y);
            for (let i = 1; i < pontosOriginais.length; i++) ctx.lineTo(pontosOriginais[i].x, pontosOriginais[i].y);
            ctx.closePath();
            ctx.clip();
            ctx.strokeStyle = "#ddd";
            ctx.lineWidth = 1 / appState.viewport.escala;
            quantidadeTotal += desenharPecasNaArea(ctx, pontosOriginais, obstaculosRenderizados);
            ctx.restore();
        }

        for (let i = 0; i < pontosOriginais.length; i++) {
            ctx.beginPath();
            const p1 = pontosOriginais[i];
            const p2 = pontosOriginais[(i + 1) % pontosOriginais.length];
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = comodoEAtivo ? ((appState.ui.paredeSelecionadaIndex === i) ? "#ff0000" : "#3a4572") : "#aaaaaa";
            ctx.lineWidth = 4 / appState.viewport.escala;
            ctx.stroke();
        }

        if (comodoEAtivo) {
            ctx.font = `bold ${14 / appState.viewport.escala}px Arial`;
            ctx.fillStyle = "#3a4572";
            for (let i = 0; i < pontosOriginais.length; i++) {
                const p1 = pontosOriginais[i];
                const p2 = pontosOriginais[(i + 1) % pontosOriginais.length];
                const dist = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
                const meio = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                const angulo = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                ctx.save();
                ctx.translate(meio.x, meio.y);
                ctx.rotate(angulo);
                let offsetY = 8 / appState.viewport.escala;
                let textBaseline = "top";
                if (angulo > Math.PI / 2 || angulo < -Math.PI / 2) {
                    ctx.rotate(Math.PI); 
                    textBaseline = "bottom";
                    offsetY = -8 / appState.viewport.escala;
                }
                ctx.textAlign = "center";
                ctx.textBaseline = textBaseline;
                ctx.fillText(`${dist.toFixed(2)}m`, 0, offsetY);
                ctx.restore();
            }
        
            if (appState.ui.modoAtual === 'dividir_parede' && appState.ui.paredeEmDestaqueIndex !== null) {
                const p1 = pontosOriginais[appState.ui.paredeEmDestaqueIndex];
                const p2 = pontosOriginais[(appState.ui.paredeEmDestaqueIndex + 1) % pontosOriginais.length];
                const meio = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                ctx.beginPath();
                ctx.arc(meio.x, meio.y, 6 / appState.viewport.escala, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(58, 69, 114, 0.5)';
                ctx.fill();
            }
            
            pontosOriginais.forEach((ponto, index) => {
                ctx.beginPath();
                const handleRadius = 8 / appState.viewport.escala;
                ctx.arc(ponto.x, ponto.y, handleRadius, 0, 2 * Math.PI);
                ctx.fillStyle = (appState.ui.verticeSendoArrastado === index) ? '#ff0000' : '#3a4572';
                ctx.fill();
            });
        }
    });

    ctx.restore();

    if (comodoAtivo && appState.ui.paredeSelecionadaIndex !== null) {
        const buttonWidth = 150, buttonHeight = 35, gap = 10;
        const totalWidth = (buttonWidth * 2) + gap;
        const startX = (canvas.width - totalWidth) / 2;
        const y = canvas.height - buttonHeight - 20;
        renderedButtons['dividirParede'] = { x: startX, y, width: buttonWidth, height: buttonHeight };
        renderedButtons['editarObstaculos'] = { x: startX + buttonWidth + gap, y, width: buttonWidth, height: buttonHeight };
        Object.keys(renderedButtons).forEach(key => {
            const btn = renderedButtons[key];
            const text = (key === 'dividirParede') ? 'Dividir Parede' : 'Editar Obstáculos';
            const isActive = (appState.ui.modoAtual === 'dividir_parede' && key === 'dividirParede');
            ctx.fillStyle = isActive ? '#c82333' : '#3a4572';
            ctx.beginPath();
            ctx.roundRect(btn.x, btn.y, btn.width, btn.height, 8);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, btn.x + btn.width / 2, btn.y + btn.height / 2);
        });
    }

    document.getElementById("resultado").textContent = `Área Total: ${areaTotal.toFixed(2)} m² — Peças necessárias: ${quantidadeTotal ? quantidadeTotal : 'Calculando...'}`;
    gerenciarVisibilidadePainelObstaculo();
    atualizarListaDeObstaculos();
}

// --- Funções de UI e Interação ---

function converterTelaParaMapa(mouseX, mouseY) {
    const { escala, offsetX, offsetY } = appState.viewport;
    return { x: (mouseX - offsetX) / escala, y: (mouseY - offsetY) / escala };
}

function getInteracaoSobMouse(mouseX, mouseY) {
    const { escala, offsetX, offsetY } = appState.viewport;
    const pontoMapa = converterTelaParaMapa(mouseX, mouseY);
    let resultado = { tipo: null, comodoId: null, index: null };

    for (let i = appState.comodos.length - 1; i >= 0; i--) {
        const comodo = appState.comodos[i];
        if (comodo.id === appState.ui.comodoAtivoId) {
            for (let j = 0; j < comodo.pontos.length; j++) {
                const ponto = comodo.pontos[j];
                const pontoTelaX = ponto.x * escala + offsetX;
                const pontoTelaY = ponto.y * escala + offsetY;
                const dist = Math.sqrt((mouseX - pontoTelaX)**2 + (mouseY - pontoTelaY)**2);
                if (dist <= 8) {
                    return { tipo: 'vertice', comodoId: comodo.id, index: j };
                }
            }
            for (let j = 0; j < comodo.pontos.length; j++) {
                const p1_tela = { x: comodo.pontos[j].x * escala + offsetX, y: comodo.pontos[j].y * escala + offsetY };
                const p2_tela = { x: comodo.pontos[(j + 1) % comodo.pontos.length].x * escala + offsetX, y: comodo.pontos[(j + 1) % comodo.pontos.length].y * escala + offsetY };
                if (distanciaPontoLinha(mouseX, mouseY, p1_tela, p2_tela) < 5) {
                    resultado = { tipo: 'parede', comodoId: comodo.id, index: j };
                }
            }
        }
        if (pontoDentroPoligono(pontoMapa, comodo.pontos)) {
            if (resultado.tipo === null) {
                resultado = { tipo: 'comodo', comodoId: comodo.id, index: null };
            }
        }
    }
    return resultado;
}

function gerenciarVisibilidadePainelObstaculo() { 
    const painel = document.getElementById('obstacle-editor');
    const backdrop = document.getElementById('modal-backdrop');
    if (appState.ui.isObstacleEditorVisible) {
        painel.classList.add('visible');
        backdrop.classList.add('visible');
    } else {
        painel.classList.remove('visible');
        backdrop.classList.remove('visible');
    }
}

function atualizarListaDeObstaculos() {
    const listaUI = document.getElementById('obstacleList');
    const editorTitle = document.querySelector('#obstacle-editor h3');
    const editorButton = document.getElementById('addObstacleBtn');
    listaUI.innerHTML = ''; 
    if (!appState.ui.isObstacleEditorVisible) return;
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (!comodoAtivo) return;

    const obstaculosDaParede = comodoAtivo.obstaculos.filter( obs => obs.paredeIndex === appState.ui.paredeSelecionadaIndex );
    if (obstaculosDaParede.length === 0) {
        listaUI.innerHTML = '<li>Nenhum obstáculo nesta parede.</li>';
    } else {
        obstaculosDaParede.forEach(obs => {
            const item = document.createElement('li');
            if (obs.id === appState.ui.obstaculoSelecionadoId) item.classList.add('editing');
            item.innerHTML = `L: ${obs.largura}m, A: ${obs.altura}m @ ${obs.posicao}m <button class="delete-btn" data-id="${obs.id}">&times;</button>`;
            item.addEventListener('click', () => selecionarObstaculoParaEdicao(obs.id));
            listaUI.appendChild(item);
        });
    }
    listaUI.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletarObstaculo(parseInt(e.target.dataset.id));
        });
    });

    if (appState.ui.obstaculoSelecionadoId !== null) {
        editorTitle.textContent = "Editando Obstáculo";
        editorButton.textContent = "Salvar Alterações";
        editorButton.style.backgroundColor = '#007bff';
    } else {
        editorTitle.textContent = "Editor de Obstáculos";
        editorButton.textContent = "Adicionar Obstáculo";
        editorButton.style.backgroundColor = '#28a745';
    }
}

function selecionarObstaculoParaEdicao(obstaculoId) {
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (!comodoAtivo) return;
    if (appState.ui.obstaculoSelecionadoId === obstaculoId) {
        appState.ui.obstaculoSelecionadoId = null;
        document.getElementById('larguraObstaculo').value = '1.00';
        document.getElementById('alturaObstaculo').value = '1.20';
        document.getElementById('posicaoObstaculo').value = '0.50';
    } else {
        appState.ui.obstaculoSelecionadoId = obstaculoId;
        const obstaculo = comodoAtivo.obstaculos.find(obs => obs.id === obstaculoId);
        if (obstaculo) {
            document.getElementById('larguraObstaculo').value = obstaculo.largura.toFixed(2);
            document.getElementById('alturaObstaculo').value = obstaculo.altura.toFixed(2);
            document.getElementById('posicaoObstaculo').value = obstaculo.posicao.toFixed(2);
        }
    }
    atualizarListaDeObstaculos();
}

function salvarObstaculo() {
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (!comodoAtivo) return;

    if (appState.ui.obstaculoSelecionadoId !== null) {
        comodoAtivo.obstaculos = comodoAtivo.obstaculos.map(obs => {
            if (obs.id === appState.ui.obstaculoSelecionadoId) {
                return { ...obs, largura: parseFloat(document.getElementById('larguraObstaculo').value), altura: parseFloat(document.getElementById('alturaObstaculo').value), posicao: parseFloat(document.getElementById('posicaoObstaculo').value) };
            }
            return obs;
        });
    } else {
        const paredeIndex = appState.ui.paredeSelecionadaIndex;
        if (paredeIndex === null) { alert("Erro: Nenhuma parede selecionada."); return; }
        const largura = parseFloat(document.getElementById('larguraObstaculo').value);
        const altura = parseFloat(document.getElementById('alturaObstaculo').value);
        const posicao = parseFloat(document.getElementById('posicaoObstaculo').value);
        if (isNaN(largura) || isNaN(altura) || isNaN(posicao) || largura <= 0 || altura <= 0 || posicao < 0) { alert("Valores inválidos para o obstáculo."); return; }
        comodoAtivo.obstaculos.push({ id: Date.now(), paredeIndex, largura, altura, posicao });
    }
    appState.ui.obstaculoSelecionadoId = null;
    document.getElementById('larguraObstaculo').value = '1.00';
    document.getElementById('alturaObstaculo').value = '1.20';
    document.getElementById('posicaoObstaculo').value = '0.50';
    render();
}

function deletarObstaculo(idParaDeletar) {
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (!comodoAtivo) return;
    comodoAtivo.obstaculos = comodoAtivo.obstaculos.filter(obs => obs.id !== idParaDeletar);
    if (appState.ui.obstaculoSelecionadoId === idParaDeletar) {
        appState.ui.obstaculoSelecionadoId = null;
    }
    render();
}

function fecharEditorDeObstaculos() {
    appState.ui.isObstacleEditorVisible = false;
    render();
}


// --- Lógica dos Modos ---

function handleMouseDownSelecao(e, mouseX, mouseY) {
    const interacao = getInteracaoSobMouse(mouseX, mouseY);
    if (interacao.tipo === 'vertice') {
        appState.ui.verticeSendoArrastado = interacao.index;
        appState.ui.isDragging = true;
        return;
    }
    if (interacao.tipo === 'parede') {
        if (appState.ui.paredeSelecionadaIndex === interacao.index) {
            appState.ui.isWallDragging = true;
            appState.ui.isDragging = true;
            appState.ui.dragLastX = mouseX;
            appState.ui.dragLastY = mouseY;
        } else {
            appState.ui.paredeSelecionadaIndex = interacao.index;
            appState.ui.modoAtual = 'selecao';
        }
    } else if (interacao.tipo === 'comodo') {
        appState.ui.comodoAtivoId = interacao.comodoId;
        appState.ui.paredeSelecionadaIndex = null;
    } else {
        appState.ui.comodoAtivoId = null;
        appState.ui.paredeSelecionadaIndex = null;
    }
    if (interacao.tipo !== 'parede') {
        appState.ui.modoAtual = 'selecao';
    }
    render();
}

function handleMouseMoveSelecao(e, mouseX, mouseY) {
    const canvas = e.target;
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (!comodoAtivo) {
        canvas.style.cursor = 'default';
        return;
    }
    if (appState.ui.verticeSendoArrastado !== null) {
        canvas.style.cursor = 'grabbing';
        const novasCoords = converterTelaParaMapa(mouseX, mouseY);
        comodoAtivo.pontos[appState.ui.verticeSendoArrastado].x = novasCoords.x;
        comodoAtivo.pontos[appState.ui.verticeSendoArrastado].y = novasCoords.y;
        render();
        return;
    }
    if (appState.ui.isWallDragging) {
        canvas.style.cursor = 'grabbing';
        const paredeIndex = appState.ui.paredeSelecionadaIndex;
        const v1_index = paredeIndex;
        const v2_index = (paredeIndex + 1) % comodoAtivo.pontos.length;
        const deltaX = mouseX - appState.ui.dragLastX;
        const deltaY = mouseY - appState.ui.dragLastY;
        const deltaMapX = deltaX / appState.viewport.escala;
        const deltaMapY = deltaY / appState.viewport.escala;
        comodoAtivo.pontos[v1_index].x += deltaMapX;
        comodoAtivo.pontos[v1_index].y += deltaMapY;
        comodoAtivo.pontos[v2_index].x += deltaMapX;
        comodoAtivo.pontos[v2_index].y += deltaMapY;
        appState.ui.dragLastX = mouseX;
        appState.ui.dragLastY = mouseY;
        render();
        return;
    }
    const interacao = getInteracaoSobMouse(mouseX, mouseY);
    canvas.style.cursor = (interacao.tipo === 'vertice') ? 'grab' : (interacao.tipo ? 'pointer' : 'default');
}

function handleMouseUpSelecao() {
    const precisaRenderizar = appState.ui.isDragging;
    appState.ui.verticeSendoArrastado = null;
    appState.ui.isWallDragging = false;
    appState.ui.isDragging = false;
    if (precisaRenderizar) {
        render();
    }
}

function handleMouseMoveDividirParede(e, mouseX, mouseY) {
    const canvas = e.target;
    const interacao = getInteracaoSobMouse(mouseX, mouseY);
    const paredeIndex = (interacao.comodoId === appState.ui.comodoAtivoId && interacao.tipo === 'parede') ? interacao.index : null;
    let precisaRenderizar = false;
    if (paredeIndex !== null) {
        canvas.style.cursor = 'copy';
        if (appState.ui.paredeEmDestaqueIndex !== paredeIndex) {
            appState.ui.paredeEmDestaqueIndex = paredeIndex;
            precisaRenderizar = true;
        }
    } else {
        canvas.style.cursor = 'default';
        if (appState.ui.paredeEmDestaqueIndex !== null) {
            appState.ui.paredeEmDestaqueIndex = null;
            precisaRenderizar = true;
        }
    }
    if (precisaRenderizar) render();
}

function handleMouseDownDividirParede(e, mouseX, mouseY) {
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (!comodoAtivo || appState.ui.paredeEmDestaqueIndex === null) return;
    const index = appState.ui.paredeEmDestaqueIndex;
    const pontos = comodoAtivo.pontos;
    const p1 = pontos[index];
    const p2 = pontos[(index + 1) % pontos.length];
    const novoPonto = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    pontos.splice(index + 1, 0, novoPonto);
    appState.ui.modoAtual = 'selecao';
    appState.ui.paredeEmDestaqueIndex = null;
    appState.ui.paredeSelecionadaIndex = null;
    appState.ui.verticeSendoArrastado = index + 1;
    appState.ui.isDragging = true;
    render();
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    const canvas = document.getElementById('desenho');

    // CORREÇÃO: Listener para o clique direito (contextmenu)
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Impede o menu do navegador de aparecer
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const interacao = getInteracaoSobMouse(mouseX, mouseY);

        if (interacao.tipo === 'vertice') {
            const comodoAtivo = appState.comodos.find(c => c.id === interacao.comodoId);
            if (comodoAtivo && comodoAtivo.pontos.length > 3) {
                comodoAtivo.pontos.splice(interacao.index, 1);
                // Reseta a seleção de parede para evitar bugs com índices
                appState.ui.paredeSelecionadaIndex = null;
                render();
            } else {
                alert("Não é possível remover mais vértices. O cômodo deve ter no mínimo 3 lados.");
            }
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1) {
            e.preventDefault();
            appState.ui.isPanning = true;
            appState.ui.panStartX = e.clientX;
            appState.ui.panStartY = e.clientY;
            canvas.style.cursor = 'move';
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        if (appState.ui.paredeSelecionadaIndex !== null) {
            for (const key in renderedButtons) {
                const btn = renderedButtons[key];
                if (mouseX >= btn.x && mouseX <= btn.x + btn.width && mouseY >= btn.y && mouseY <= btn.y + btn.height) {
                    if (key === 'dividirParede') {
                        appState.ui.modoAtual = (appState.ui.modoAtual === 'dividir_parede') ? 'selecao' : 'dividir_parede';
                        render();
                        return;
                    }
                    if (key === 'editarObstaculos') {
                        appState.ui.isObstacleEditorVisible = true;
                        render();
                        return;
                    }
                }
            }
        }
        if (appState.ui.modoAtual === 'selecao') {
            handleMouseDownSelecao(e, mouseX, mouseY);
        } else if (appState.ui.modoAtual === 'dividir_parede') {
            handleMouseDownDividirParede(e, mouseX, mouseY);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (appState.ui.isPanning) {
            const dx = e.clientX - appState.ui.panStartX;
            const dy = e.clientY - appState.ui.panStartY;
            appState.viewport.offsetX += dx;
            appState.viewport.offsetY += dy;
            appState.ui.panStartX = e.clientX;
            appState.ui.panStartY = e.clientY;
            render();
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        if (appState.ui.modoAtual === 'selecao') {
            handleMouseMoveSelecao(e, mouseX, mouseY);
        } else if (appState.ui.modoAtual === 'dividir_parede') {
            handleMouseMoveDividirParede(e, mouseX, mouseY);
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 1) {
            appState.ui.isPanning = false;
            canvas.style.cursor = 'default';
            render();
        }
        if (appState.ui.modoAtual === 'selecao') {
            handleMouseUpSelecao(e);
        }
    });
    
    canvas.addEventListener('mouseout', () => {
        canvas.style.cursor = 'default';
        if (appState.ui.paredeEmDestaqueIndex !== null) {
            appState.ui.paredeEmDestaqueIndex = null;
            render();
        }
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault(); 
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomIntensity = 0.1;
        const direcao = e.deltaY > 0 ? -1 : 1; 
        const escalaAntiga = appState.viewport.escala;
        const novaEscala = Math.max(5, escalaAntiga * (1 + direcao * zoomIntensity));
        const mouseAntesX = (mouseX - appState.viewport.offsetX) / escalaAntiga;
        const mouseAntesY = (mouseY - appState.viewport.offsetY) / escalaAntiga;
        appState.viewport.escala = novaEscala;
        appState.viewport.offsetX = mouseX - mouseAntesX * novaEscala;
        appState.viewport.offsetY = mouseY - mouseAntesY * novaEscala;
        render();
    });

    // CORREÇÃO: Listeners do modal e formulário
    document.querySelector('#obstacle-editor .close-btn').addEventListener('click', fecharEditorDeObstaculos);
    document.getElementById('modal-backdrop').addEventListener('click', fecharEditorDeObstaculos);
    document.getElementById('addObstacleBtn').addEventListener('click', salvarObstaculo);
}

// --- Inicialização da Aplicação ---
function iniciarApp() {
    appState = getDefaultState();
    setupEventListeners();
    render();
}

iniciarApp();