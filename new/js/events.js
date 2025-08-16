// js/events.js (CORRIGIDO)
import { appState, saveStateForUndo, debounce, undo } from './state.js';
import { render } from './render.js';
import { getLimites, distanciaPontoLinha, pontoDentroPoligono } from './geometry.js';
import * as actions from './actions.js';
import * as project from './project.js';

// --- Funções de Manipulação de Eventos (Handlers) ---

function converterTelaParaMapa(mouseX, mouseY) {
    const { escala, offsetX, offsetY } = appState.viewport;
    return { x: (mouseX - offsetX) / escala, y: (mouseY - offsetY) / escala };
}

function getInteracaoSobMouse(mouseX, mouseY) {
    const pontoMapa = converterTelaParaMapa(mouseX, mouseY);
    let resultado = { tipo: null, comodoId: null, index: null };

    for (let i = appState.comodos.length - 1; i >= 0; i--) {
        const comodo = appState.comodos[i];
        
        if (comodo.id === appState.ui.comodoAtivoId && comodo.type !== 'coluna') {
            for (let j = 0; j < comodo.pontos.length; j++) {
                const ponto = comodo.pontos[j];
                const dist = Math.sqrt((pontoMapa.x - ponto.x) ** 2 + (pontoMapa.y - ponto.y) ** 2) * appState.viewport.escala;
                if (dist <= 8) return { tipo: 'vertice', comodoId: comodo.id, index: j };
            }
        }
        
        if (comodo.id === appState.ui.comodoAtivoId) {
             for (let j = 0; j < comodo.pontos.length; j++) {
                const p1 = comodo.pontos[j];
                const p2 = comodo.pontos[(j + 1) % comodo.pontos.length];
                if (distanciaPontoLinha(pontoMapa.x, pontoMapa.y, p1, p2) * appState.viewport.escala < 5) {
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

function encontrarPontoDeSnap(pontoArrastado, comodoIdArrastado) {
    const snapRadius = 10 / appState.viewport.escala;
    let bestSnap = null;
    let minDistance = Infinity;
    for (const comodo of appState.comodos) {
        if (comodo.id === comodoIdArrastado) continue;
        for (const ponto of comodo.pontos) {
            const distancia = Math.sqrt((pontoArrastado.x - ponto.x) ** 2 + (pontoArrastado.y - ponto.y) ** 2);
            if (distancia < snapRadius && distancia < minDistance) {
                minDistance = distancia;
                bestSnap = { x: ponto.x, y: ponto.y };
            }
        }
        const limites = getLimites(comodo.pontos);
        const centro = { x: (limites.minX + limites.maxX) / 2, y: (limites.minY + limites.maxY) / 2 };
        const distanciaCentro = Math.sqrt((pontoArrastado.x - centro.x) ** 2 + (pontoArrastado.y - centro.y) ** 2);
        if (distanciaCentro < snapRadius && distanciaCentro < minDistance) {
            minDistance = distanciaCentro;
            bestSnap = { x: centro.x, y: centro.y };
        }
    }
    return bestSnap;
}

function snapDrag(startPoint, currentPoint) {
    const deltaX = currentPoint.x - startPoint.x;
    const deltaY = currentPoint.y - startPoint.y;
    const angle = Math.atan2(deltaY, deltaX);
    const snapAngleRad = Math.PI / 4;
    const snappedAngle = Math.round(angle / snapAngleRad) * snapAngleRad;
    
    const vector = { x: deltaX, y: deltaY };
    const snapVector = { x: Math.cos(snappedAngle), y: Math.sin(snappedAngle) };
    const projectedDist = vector.x * snapVector.x + vector.y * snapVector.y;

    return {
        x: startPoint.x + projectedDist * snapVector.x,
        y: startPoint.y + projectedDist * snapVector.y
    };
}

// --- Handlers de Modos Específicos ---

function handleMouseDownSelecao(e, mouseX, mouseY) {
    const interacao = getInteracaoSobMouse(mouseX, mouseY);
    
    if (interacao.tipo === 'vertice') {
        const comodo = appState.comodos.find(c => c.id === interacao.comodoId);
        const vertice = comodo.pontos[interacao.index];
        appState.ui.dragStartPoint = { x: vertice.x, y: vertice.y };
        appState.ui.verticeSendoArrastado = interacao.index;
        appState.ui.isDragging = true;
        return;
    }
    if (interacao.tipo === 'parede') {
        if (appState.ui.paredeSelecionadaIndex === interacao.index) {
            const comodo = appState.comodos.find(c => c.id === interacao.comodoId);
            appState.ui.dragStartPoints = JSON.parse(JSON.stringify(comodo.pontos));
            appState.ui.dragStartPoint = converterTelaParaMapa(mouseX, mouseY);
            appState.ui.isWallDragging = true;
            appState.ui.isDragging = true;
        } else {
            appState.ui.paredeSelecionadaIndex = interacao.index;
            appState.ui.modoAtual = 'selecao';
        }
    } else if (interacao.tipo === 'comodo') {
        if (appState.ui.comodoAtivoId === interacao.comodoId) {
            const comodo = appState.comodos.find(c => c.id === interacao.comodoId);
            appState.ui.dragStartPoints = JSON.parse(JSON.stringify(comodo.pontos));
            appState.ui.dragStartPoint = converterTelaParaMapa(mouseX, mouseY);
            appState.ui.isComodoDragging = true;
            appState.ui.isDragging = true;
        } else {
            appState.ui.comodoAtivoId = interacao.comodoId;
            appState.ui.paredeSelecionadaIndex = null;
        }
    } else {
        appState.ui.comodoAtivoId = null;
        appState.ui.paredeSelecionadaIndex = null;
    }
    if (interacao.tipo !== 'parede' && interacao.tipo !== 'vertice') {
        appState.ui.modoAtual = 'selecao';
    }
    render();
}

function handleMouseMoveSelecao(e, mouseX, mouseY) {
    const canvas = e.target;
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    
    if (!appState.ui.isDragging) {
        const interacao = getInteracaoSobMouse(mouseX, mouseY);
        canvas.style.cursor = (interacao.tipo === 'vertice' || interacao.tipo === 'comodo') ? 'grab' : (interacao.tipo ? 'pointer' : 'default');
    }
    
    if (appState.ui.verticeSendoArrastado !== null && comodoAtivo) {
        canvas.style.cursor = 'grabbing';
        let novasCoords = converterTelaParaMapa(mouseX, mouseY);
        
        if (e.shiftKey && appState.ui.dragStartPoint) {
            novasCoords = snapDrag(appState.ui.dragStartPoint, novasCoords);
            appState.ui.snapPoint = null;
        } else {
            appState.ui.snapPoint = encontrarPontoDeSnap(novasCoords, comodoAtivo.id);
            if (appState.ui.snapPoint) {
                novasCoords = appState.ui.snapPoint;
            }
        }

        comodoAtivo.pontos[appState.ui.verticeSendoArrastado].x = novasCoords.x;
        comodoAtivo.pontos[appState.ui.verticeSendoArrastado].y = novasCoords.y;
        render();
        return;
    }
    
    if (appState.ui.isComodoDragging && comodoAtivo) {
        canvas.style.cursor = 'move';
        const mouseAtualMundo = converterTelaParaMapa(mouseX, mouseY);
        let totalDeltaX = mouseAtualMundo.x - appState.ui.dragStartPoint.x;
        let totalDeltaY = mouseAtualMundo.y - appState.ui.dragStartPoint.y;

        if (e.shiftKey) {
            const startDragPoint = {x: 0, y: 0};
            const idealCurrentPoint = { x: totalDeltaX, y: totalDeltaY };
            const snappedPoint = snapDrag(startDragPoint, idealCurrentPoint);
            totalDeltaX = snappedPoint.x;
            totalDeltaY = snappedPoint.y;
            appState.ui.snapPoint = null;
        } else {
            appState.ui.snapPoint = null;
            let snapFound = false;
            for (const startPonto of appState.ui.dragStartPoints) {
                const pontoFuturo = { x: startPonto.x + totalDeltaX, y: startPonto.y + totalDeltaY };
                const snapPoint = encontrarPontoDeSnap(pontoFuturo, comodoAtivo.id);
                if (snapPoint) {
                    totalDeltaX = snapPoint.x - startPonto.x;
                    totalDeltaY = snapPoint.y - startPonto.y;
                    appState.ui.snapPoint = snapPoint;
                    snapFound = true;
                    break; 
                }
            }
            if (!snapFound) {
                const startLimites = getLimites(appState.ui.dragStartPoints);
                const startCentro = { x: (startLimites.minX + startLimites.maxX) / 2, y: (startLimites.minY + startLimites.maxY) / 2 };
                const centroFuturo = { x: startCentro.x + totalDeltaX, y: startCentro.y + totalDeltaY };
                const snapPoint = encontrarPontoDeSnap(centroFuturo, comodoAtivo.id);
                if (snapPoint) {
                    totalDeltaX = snapPoint.x - startCentro.x;
                    totalDeltaY = snapPoint.y - startCentro.y;
                    appState.ui.snapPoint = snapPoint;
                }
            }
        }
        
        comodoAtivo.pontos = appState.ui.dragStartPoints.map(p => ({
            x: p.x + totalDeltaX,
            y: p.y + totalDeltaY
        }));

        render();
        return;
    }

    if(appState.ui.isWallDragging && comodoAtivo) {
        canvas.style.cursor = 'grabbing';
        const mouseAtualMundo = converterTelaParaMapa(mouseX, mouseY);
        let totalDeltaX = mouseAtualMundo.x - appState.ui.dragStartPoint.x;
        let totalDeltaY = mouseAtualMundo.y - appState.ui.dragStartPoint.y;
        
        if (e.shiftKey) {
            if (Math.abs(totalDeltaX) > Math.abs(totalDeltaY)) {
                totalDeltaY = 0;
            } else {
                totalDeltaX = 0;
            }
        }
        
        const paredeIndex = appState.ui.paredeSelecionadaIndex;
        const v1_index = paredeIndex;
        const v2_index = (paredeIndex + 1) % comodoAtivo.pontos.length;
        
        comodoAtivo.pontos = JSON.parse(JSON.stringify(appState.ui.dragStartPoints));
        comodoAtivo.pontos[v1_index].x += totalDeltaX;
        comodoAtivo.pontos[v1_index].y += totalDeltaY;
        comodoAtivo.pontos[v2_index].x += totalDeltaX;
        comodoAtivo.pontos[v2_index].y += totalDeltaY;
        
        render();
        return;
    }
    
    if(!appState.ui.isDragging) {
        render();
    }
}

function handleMouseUpSelecao() {
    if (appState.ui.isDragging) {
        saveStateForUndo();
    }
    appState.ui.verticeSendoArrastado = null;
    appState.ui.isWallDragging = false;
    appState.ui.isComodoDragging = false;
    appState.ui.isDragging = false;
    appState.ui.snapPoint = null;
    appState.ui.dragStartPoint = null;
    appState.ui.dragStartPoints = null;
    render();
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
    saveStateForUndo();
    render();
}

// --- Função Principal de Configuração de Eventos ---

export function setupEventListeners() {
    const canvas = document.getElementById('desenho');
    
    // --- Listeners da Barra de Ferramentas HTML ---
    document.getElementById('toolbarAddComodo').addEventListener('click', actions.adicionarNovoComodo);
    document.getElementById('toolbarCiclarTipo').addEventListener('click', actions.ciclarTipoComodo);
    document.getElementById('toolbarDuplicar').addEventListener('click', actions.duplicarComodoAtivo);
    document.getElementById('toolbarDeletar').addEventListener('click', actions.deletarComodoAtivo);
    document.getElementById('toolbarDividirParede').addEventListener('click', actions.toggleModoDividirParede);
    
    // --- Listeners do Painel Esquerdo ---
    document.getElementById('fileInput').addEventListener('change', project.handleFileSelect);
    document.getElementById('mostrarMedidasToggle').addEventListener('change', (e) => { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (comodoAtivo) { comodoAtivo.mostrarMedidas = e.target.checked; saveStateForUndo(); render(); } });
    document.getElementById('textoCentral').addEventListener('input', (e) => { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (comodoAtivo) { comodoAtivo.textoCentral = e.target.value; debounce(() => { saveStateForUndo(); }, 500); render(); } });
    document.getElementById('tamanhoTexto').addEventListener('input', (e) => { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (comodoAtivo) { comodoAtivo.tamanhoTexto = parseInt(e.target.value, 10) || 16; debounce(() => { saveStateForUndo(); }, 500); render(); } });
    document.getElementById('corColuna').addEventListener('input', (e) => { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (comodoAtivo) { comodoAtivo.cor = e.target.value; debounce(() => { saveStateForUndo(); render(); }, 100); } });
    document.getElementById("pecaSelect").addEventListener("change", (event) => { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (!comodoAtivo) return; const selectedValue = event.target.value; comodoAtivo.peca.selectedValue = selectedValue; if (selectedValue === "custom") { comodoAtivo.peca.isCustom = true; } else { comodoAtivo.peca.isCustom = false; const [padrao, largura, comprimento] = selectedValue.split(","); comodoAtivo.peca.padrao = padrao; comodoAtivo.peca.largura = parseFloat(largura); comodoAtivo.peca.comprimento = parseFloat(comprimento); } saveStateForUndo(); render(); });
    
    const criarHandlerParaInputPeca = (propriedade) => (e) => { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (comodoAtivo) { const valor = e.target.value.replace(',', '.'); comodoAtivo.peca[propriedade] = parseFloat(valor) || 0; debounce(() => { saveStateForUndo(); render(); }, 500); } };
    const criarHandlerParaCheckboxPeca = (propriedade) => (e) => { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (comodoAtivo) { comodoAtivo.peca[propriedade] = e.target.checked; if (propriedade === 'modoTijoloCustom' && comodoAtivo.peca.isCustom) comodoAtivo.peca.padrao = e.target.checked ? 'tijolo' : 'grade'; saveStateForUndo(); render(); } };
    
    document.getElementById("larguraPeca").addEventListener("input", criarHandlerParaInputPeca('largura'));
    document.getElementById("comprimentoPeca").addEventListener("input", criarHandlerParaInputPeca('comprimento'));
    document.getElementById("juntaHorizontal").addEventListener("input", criarHandlerParaInputPeca('juntaHorizontal'));
    document.getElementById("juntaVertical").addEventListener("input", criarHandlerParaInputPeca('juntaVertical'));
    document.getElementById("rotacionar").addEventListener("change", criarHandlerParaCheckboxPeca('rotacionar'));
    document.getElementById("modoTijoloCustom").addEventListener("change", criarHandlerParaCheckboxPeca('modoTijoloCustom'));
    document.getElementById('tamanhoParede').addEventListener('change', (e) => { const novoTamanho = parseFloat(e.target.value); if (!isNaN(novoTamanho) && novoTamanho > 0) actions.ajustarTamanhoParede(novoTamanho); else render(); });
    const larguraColunaInput = document.getElementById('larguraColuna'); const alturaColunaInput = document.getElementById('alturaColuna');
    const Fg_coluna_recalcular = () => { const novaLargura = parseFloat(larguraColunaInput.value); const novaAltura = parseFloat(alturaColunaInput.value); if (!isNaN(novaLargura) && novaLargura > 0 && !isNaN(novaAltura) && novaAltura > 0) actions.ajustarTamanhoColuna(novaLargura, novaAltura); else render(); };
    larguraColunaInput.addEventListener('change', Fg_coluna_recalcular);
    alturaColunaInput.addEventListener('change', Fg_coluna_recalcular);
    document.getElementById('rotacaoColuna').addEventListener('input', (e) => { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (comodoAtivo) { comodoAtivo.rotacao = parseInt(e.target.value, 10); actions.recalcularPontosRotacionados(comodoAtivo); render(); } });
    document.getElementById('rotacaoColuna').addEventListener('change', () => saveStateForUndo());
    document.getElementById('closeEsquerdaBtn').addEventListener('click', () => { appState.ui.comodoAtivoId = null; render(); });
    document.getElementById('offset-controls').addEventListener('click', (e) => { const button = e.target.closest('.offset-btn'); if (!button) return; const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (!comodoAtivo || comodoAtivo.type !== 'comodo') { alert("Por favor, selecione um cômodo editável primeiro."); return; } const axis = button.dataset.axis; const direction = parseInt(button.dataset.direction, 10); const step = 0.05; if (axis === 'x') comodoAtivo.peca.offsetX += direction * step; else if (axis === 'y') comodoAtivo.peca.offsetY += direction * step; debounce(() => { saveStateForUndo(); render(); }, 50); });

    // --- Listeners do Canvas ---
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const interacao = getInteracaoSobMouse(mouseX, mouseY); if (interacao.tipo === 'vertice') { const comodoAtivo = appState.comodos.find(c => c.id === interacao.comodoId); if (comodoAtivo && comodoAtivo.pontos.length > 3) { comodoAtivo.pontos.splice(interacao.index, 1); appState.ui.paredeSelecionadaIndex = null; saveStateForUndo(); render(); } else { alert("Não é possível remover mais vértices. O cômodo deve ter no mínimo 3 lados."); } } });
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1) { e.preventDefault(); appState.ui.isPanning = true; appState.ui.panStartX = e.clientX; appState.ui.panStartY = e.clientY; canvas.style.cursor = 'move'; return; }
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        if (appState.ui.modoAtual === 'selecao') handleMouseDownSelecao(e, mouseX, mouseY);
        else if (appState.ui.modoAtual === 'dividir_parede') handleMouseDownDividirParede(e, mouseX, mouseY);
    });
    canvas.addEventListener('mousemove', (e) => {
        if (appState.ui.isPanning) { const dx = e.clientX - appState.ui.panStartX; const dy = e.clientY - appState.ui.panStartY; appState.viewport.offsetX += dx; appState.viewport.offsetY += dy; appState.ui.panStartX = e.clientX; appState.ui.panStartY = e.clientY; render(); return; }
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        if (appState.ui.modoAtual === 'selecao') handleMouseMoveSelecao(e, mouseX, mouseY);
        else if (appState.ui.modoAtual === 'dividir_parede') handleMouseMoveDividirParede(e, mouseX, mouseY);
    });
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 1) { appState.ui.isPanning = false; canvas.style.cursor = 'default'; }
        if (appState.ui.modoAtual === 'selecao') handleMouseUpSelecao(e);
    });
    canvas.addEventListener('mouseout', (e) => { appState.ui.tooltip.visible = false; if(!e.relatedTarget || e.relatedTarget.id !== 'desenho') { render(); } });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const zoomIntensity = 0.1; const direcao = e.deltaY > 0 ? -1 : 1; const escalaAntiga = appState.viewport.escala; const novaEscala = Math.max(0.1, escalaAntiga * (1 + direcao * zoomIntensity)); const mouseAntesX = (mouseX - appState.viewport.offsetX) / escalaAntiga; const mouseAntesY = (mouseY - appState.viewport.offsetY) / escalaAntiga; appState.viewport.escala = novaEscala; appState.viewport.offsetX = mouseX - mouseAntesX * novaEscala; appState.viewport.offsetY = mouseY - mouseAntesY * novaEscala; render(); });

    // --- Listeners Globais ---
    window.addEventListener('resize', () => render());
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
        }
    });

    // --- Listeners dos Botões do Projeto ---
    document.getElementById('saveProjectBtn').addEventListener('click', project.salvarProjeto);
    document.getElementById('loadProjectBtn').addEventListener('click', project.carregarProjeto);
    document.getElementById('exportProjectBtn').addEventListener('click', project.exportarComoImagem);
    document.getElementById('resetProjectBtn').addEventListener('click', project.resetarProjeto);
}