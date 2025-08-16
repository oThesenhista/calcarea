// VERSÃO 10.0 (FINAL) - BARRA DE FERRAMENTAS UNIFICADA E MODO DE DIVISÃO
let appState;
let timeoutId = null;
let history = [];
let historyIndex = -1;
const icons = {}; // Objeto para guardar os ícones pré-carregados

function debounce(func, delay) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(func, delay);
}

function getDefaultState() {
    const pecaPadrao = {
        largura: 0.30, comprimento: 0.30, padrao: 'grade', rotacionar: false,
        isCustom: false, modoTijoloCustom: false, offsetX: 0, offsetY: 0,
        juntaHorizontal: 0.002, juntaVertical: 0.002, selectedValue: 'grade,0.30,0.30'
    };
    
    const pontosIniciais = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }];
    const limitesIniciais = getLimites(pontosIniciais);

    return {
        comodos: [{
            id: Date.now(),
            pontos: pontosIniciais,
            type: 'comodo',
            textoCentral: "Cômodo 1",
            tamanhoTexto: 16,
            cor: '#cccccc',
            mostrarMedidas: true,
            rotacao: 0,
            largura: limitesIniciais.maxX - limitesIniciais.minX,
            altura: limitesIniciais.maxY - limitesIniciais.minY,
            peca: { ...pecaPadrao }
        }],
        ui: {
            comodoAtivoId: null, paredeSelecionadaIndex: null, verticeSendoArrastado: null, 
            isDragging: false, isComodoDragging: false, isWallDragging: false, 
            isPanning: false, panStartX: 0, panStartY: 0, 
            dragStartPoint: null,
            dragStartPoints: null,
            snapPoint: null, modoAtual: 'selecao', paredeEmDestaqueIndex: null,
            tooltip: { visible: false, text: '', x: 0, y: 0 }
        },
        viewport: {
            escala: 50, offsetX: 100, offsetY: 100,
        }
    };
}

let renderedButtons = {};

// --- Funções Auxiliares e de Desenho ---
function pontoDentroPoligono(ponto, poligono) { let dentro = false; for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) { const xi = poligono[i].x, yi = poligono[i].y; const xj = poligono[j].x, yj = poligono[j].y; const intersect = ((yi > ponto.y) !== (yj > ponto.y)) && (ponto.x < (xj - xi) * (ponto.y - yi) / (yj - yi) + xi); if (intersect) dentro = !dentro; } return dentro; }
function calcularArea(poligono) { let area = 0; for (let i = 0; i < poligono.length; i++) { const j = (i + 1) % poligono.length; area += poligono[i].x * poligono[j].y; area -= poligono[j].x * poligono[i].y; } return Math.abs(area / 2); }
function desenharPecasNaArea(ctx, poligono, pecaConfig) { const { largura, comprimento, rotacionar, padrao, offsetX, offsetY, isCustom, juntaHorizontal, juntaVertical } = pecaConfig; const pecaLarguraMundo = rotacionar ? comprimento : largura; const pecaComprimentoMundo = rotacionar ? largura : comprimento; if (pecaLarguraMundo <= 0 || pecaComprimentoMundo <= 0) return 0; const espacoH = isCustom ? juntaHorizontal : 0; const espacoV = isCustom ? juntaVertical : 0; const passoX = pecaLarguraMundo + espacoH; const passoY = pecaComprimentoMundo + espacoV; const minXPoligono = Math.min(...poligono.map(p => p.x)); const maxXPoligono = Math.max(...poligono.map(p => p.x)); const minYPoligono = Math.min(...poligono.map(p => p.y)); const maxYPoligono = Math.max(...poligono.map(p => p.y)); let contador = 0; const desenharPecaSeValido = (x, y, larg, comp) => { const pecaRectMundo = { x, y, largura: larg, altura: comp }; if (retanguloCruzaPoligono(pecaRectMundo, poligono)) { ctx.strokeRect(pecaRectMundo.x, pecaRectMundo.y, pecaRectMundo.largura, pecaRectMundo.altura); return true; } return false; }; const startX = minXPoligono - pecaLarguraMundo; const endX = maxXPoligono + pecaLarguraMundo; const startY = minYPoligono - pecaComprimentoMundo; const endY = maxYPoligono + pecaComprimentoMundo; if (padrao === 'grade' || padrao === 'forro') { for (let y = startY + offsetY; y < endY; y += passoY) { for (let x = startX + offsetX; x < endX; x += passoX) { if (desenharPecaSeValido(x, y, pecaLarguraMundo, pecaComprimentoMundo)) contador++; } } } else if (padrao === 'tijolo') { let linha = 0; for (let y = startY + offsetY; y < endY; y += passoY) { let xOffsetTijolo = (linha % 2 === 1) ? -passoX / 2 : 0; for (let x = startX + offsetX + xOffsetTijolo; x < endX; x += passoX) { if (desenharPecaSeValido(x, y, pecaLarguraMundo, pecaComprimentoMundo)) contador++; } linha++; } } return contador; }
function distanciaPontoLinha(px, py, p1, p2) { const L2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2; if (L2 === 0) return Math.sqrt((px - p1.x)**2 + (py - p1.y)**2); let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / L2; t = Math.max(0, Math.min(1, t)); const projeçãoX = p1.x + t * (p2.x - p1.x); const projeçãoY = p1.y + t * (p2.y - p1.y); return Math.sqrt((px - projeçãoX)**2 + (py - projeçãoY)**2); }
function retanguloCruzaPoligono(retangulo, poligono) { const { x, y, largura, altura } = retangulo; const cantos = [{ x, y }, { x: x + largura, y }, { x: x + largura, y: y + altura }, { x, y: y + altura }]; if (cantos.some(p => pontoDentroPoligono(p, poligono))) return true; if (poligono.some(p => p.x >= x && p.x <= x + largura && p.y >= y && p.y <= y + altura)) return true; for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) { if (linhaCruzaRetangulo(poligono[i], poligono[j], { x, y, width: largura, height: altura })) return true; } return false; }
function linhaCruzaRetangulo(p1, p2, retangulo) { const [rx, ry, rw, rh] = [retangulo.x, retangulo.y, retangulo.width, retangulo.height]; const retanguloPontos = [ { x: rx, y: ry }, { x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh } ]; for (let i = 0; i < 4; i++) { if (linhaCruzaLinha(p1, p2, retanguloPontos[i], retanguloPontos[(i + 1) % 4])) return true; } return false; }
function linhaCruzaLinha(p1, p2, p3, p4) { const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x); if (den === 0) return null; const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den; const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den; if (t > 0 && t < 1 && u > 0 && u < 1) { return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }; } return null; }
function getLimites(pontos) { if (pontos.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }; const xCoords = pontos.map(p => p.x); const yCoords = pontos.map(p => p.y); return { minX: Math.min(...xCoords), maxX: Math.max(...xCoords), minY: Math.min(...yCoords), maxY: Math.max(...yCoords) }; }
function encontrarComodoPai(elemento, todosOsComodos) { const limitesElemento = getLimites(elemento.pontos); const centroElemento = { x: (limitesElemento.minX + limitesElemento.maxX) / 2, y: (limitesElemento.minY + limitesElemento.maxY) / 2 }; for (const comodo of todosOsComodos) { if (comodo.id !== elemento.id && comodo.type === 'comodo') { if (pontoDentroPoligono(centroElemento, comodo.pontos)) return comodo; } } return null; }
function calcularMedidasOrtogonais(coluna, comodoPai) { const centroColuna = { x: (getLimites(coluna.pontos).minX + getLimites(coluna.pontos).maxX) / 2, y: (getLimites(coluna.pontos).minY + getLimites(coluna.pontos).maxY) / 2 }; const anguloRad = coluna.rotacao * (Math.PI / 180); const cosA = Math.cos(anguloRad); const sinA = Math.sin(anguloRad); const direcoes = [ { x: cosA, y: sinA }, { x: -cosA, y: -sinA }, { x: -sinA, y: cosA }, { x: sinA, y: -cosA } ]; const pontosMedios = [ { x: centroColuna.x + (coluna.largura / 2) * cosA, y: centroColuna.y + (coluna.largura / 2) * sinA }, { x: centroColuna.x - (coluna.largura / 2) * cosA, y: centroColuna.y - (coluna.largura / 2) * sinA }, { x: centroColuna.x - (coluna.altura / 2) * sinA, y: centroColuna.y + (coluna.altura / 2) * cosA }, { x: centroColuna.x + (coluna.altura / 2) * sinA, y: centroColuna.y - (coluna.altura / 2) * cosA } ]; const medidas = []; for (let i = 0; i < direcoes.length; i++) { const origem = pontosMedios[i]; const direcao = direcoes[i]; const raioLongo = 1000; const pFinalRaio = { x: origem.x + direcao.x * raioLongo, y: origem.y + direcao.y * raioLongo }; let menorDist = Infinity; let pontoFinalMedida = null; for (let j = 0; j < comodoPai.pontos.length; j++) { const p1Parede = comodoPai.pontos[j]; const p2Parede = comodoPai.pontos[(j + 1) % comodoPai.pontos.length]; const intersecao = linhaCruzaLinha(origem, pFinalRaio, p1Parede, p2Parede); if (intersecao) { const dist = Math.sqrt((intersecao.x - origem.x)**2 + (intersecao.y - origem.y)**2); if (dist < menorDist) { const pontoMedioTeste = { x: (origem.x + intersecao.x) / 2, y: (origem.y + intersecao.y) / 2 }; if (pontoDentroPoligono(pontoMedioTeste, comodoPai.pontos)) { menorDist = dist; pontoFinalMedida = intersecao; } } } } if (pontoFinalMedida) { medidas.push({ p1: origem, p2: pontoFinalMedida, dist: menorDist }); } } return medidas; }

function render(options = {}) {
    const isExportMode = options.modo === 'exportacao';
    const canvas = document.getElementById("desenho");
    const ctx = canvas.getContext("2d");
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    renderedButtons = {};
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let areaTotal = 0;
    let quantidadeTotal = 0;
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    const layerOrder = { 'lote': 1, 'comodo': 2, 'coluna': 3 };
    appState.comodos.sort((a, b) => { const layerA = layerOrder[a.type] || 0; const layerB = layerOrder[b.type] || 0; return layerA - layerB; });
    ctx.save();
    ctx.translate(appState.viewport.offsetX, appState.viewport.offsetY);
    ctx.scale(appState.viewport.escala, appState.viewport.escala);
    appState.comodos.forEach(comodo => {
        const pontosOriginais = comodo.pontos;
        const comodoEAtivo = (comodo.id === appState.ui.comodoAtivoId);
        if (comodo.type === 'comodo') {
            areaTotal += calcularArea(pontosOriginais);
            if (!appState.ui.isDragging && !appState.ui.isPanning) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(pontosOriginais[0].x, pontosOriginais[0].y);
                for (let i = 1; i < pontosOriginais.length; i++) ctx.lineTo(pontosOriginais[i].x, pontosOriginais[i].y);
                ctx.closePath();
                ctx.clip();
                ctx.strokeStyle = "#ddd";
                ctx.lineWidth = 1 / appState.viewport.escala;
                quantidadeTotal += desenharPecasNaArea(ctx, pontosOriginais, comodo.peca);
                ctx.restore();
            }
        } else if (comodo.type === 'coluna') {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pontosOriginais[0].x, pontosOriginais[0].y);
            for (let i = 1; i < pontosOriginais.length; i++) ctx.lineTo(pontosOriginais[i].x, pontosOriginais[i].y);
            ctx.closePath();
            ctx.fillStyle = comodo.cor || '#cccccc';
            ctx.fill();
            ctx.restore();
        }
        for (let i = 0; i < pontosOriginais.length; i++) {
            ctx.save();
            ctx.beginPath();
            const p1 = pontosOriginais[i]; const p2 = pontosOriginais[(i + 1) % pontosOriginais.length];
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            if (comodo.type === 'lote') {
                ctx.strokeStyle = "#aaaaaa"; ctx.lineWidth = 2 / appState.viewport.escala;
                ctx.setLineDash([10 / appState.viewport.escala, 8 / appState.viewport.escala]);
            } else {
                let corDaBorda = '#aaaaaa';
                if (comodoEAtivo) {
                    corDaBorda = '#3a4572';
                    if (appState.ui.paredeSelecionadaIndex === i && comodo.type !== 'coluna') corDaBorda = '#ff0000';
                }
                ctx.strokeStyle = corDaBorda;
                if (comodo.type === 'comodo') ctx.lineWidth = 0.075; else ctx.lineWidth = 4 / appState.viewport.escala;
                ctx.setLineDash([]);
            }
            ctx.stroke();
            ctx.restore();
        }
        if (pontosOriginais.length > 0) {
            ctx.beginPath();
            const limites = getLimites(pontosOriginais);
            const centro = { x: (limites.minX + limites.maxX) / 2, y: (limites.minY + limites.maxY) / 2 };
            ctx.arc(centro.x, centro.y, 4 / appState.viewport.escala, 0, 2 * Math.PI);
        }
        if (comodo.mostrarMedidas) {
            ctx.fillStyle = isExportMode ? "#000000" : "#3a4572";
            for (let i = 0; i < pontosOriginais.length; i++) {
                if (comodo.type === 'lote' || comodo.type === 'coluna') ctx.font = `${10 / appState.viewport.escala}px Arial`; else ctx.font = `bold ${12 / appState.viewport.escala}px Arial`;
                const p1 = pontosOriginais[i]; const p2 = pontosOriginais[(i + 1) % pontosOriginais.length];
                const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                const meio = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                const angulo = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                ctx.save(); ctx.translate(meio.x, meio.y); ctx.rotate(angulo);
                const posicaoTexto = comodo.type === 'lote' ? -1 : 1;
                let offsetY = (10 / appState.viewport.escala) * posicaoTexto;
                let textBaseline = (posicaoTexto === 1) ? "top" : "bottom";
                if (angulo > Math.PI / 2 || angulo < -Math.PI / 2) {
                    ctx.rotate(Math.PI);
                    textBaseline = (posicaoTexto === 1) ? "bottom" : "top";
                    offsetY = (-10 / appState.viewport.escala) * posicaoTexto;
                }
                ctx.textAlign = "center"; ctx.textBaseline = textBaseline;
                ctx.fillText(`${dist.toFixed(2)}m`, 0, offsetY);
                ctx.restore();
            }
        }
        if (comodo.textoCentral && (comodo.type === 'comodo' || comodo.type === 'coluna')) {
            const limites = getLimites(pontosOriginais);
            const centro = { x: (limites.minX + limites.maxX) / 2, y: (limites.minY + limites.maxY) / 2 };
            ctx.font = `bold ${comodo.tamanhoTexto / appState.viewport.escala}px Arial`;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.save();
            ctx.translate(centro.x, centro.y);
            ctx.rotate(comodo.rotacao * (Math.PI / 180));
            ctx.fillText(comodo.textoCentral, 0, 0);
            ctx.restore();
        }
        if (comodoEAtivo && !isExportMode && comodo.type !== 'coluna') {
            if (appState.ui.modoAtual === 'dividir_parede' && appState.ui.paredeEmDestaqueIndex !== null) {
                const p1 = pontosOriginais[appState.ui.paredeEmDestaqueIndex];
                const p2 = pontosOriginais[(appState.ui.paredeEmDestaqueIndex + 1) % pontosOriginais.length];
                const meio = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                ctx.beginPath(); ctx.arc(meio.x, meio.y, 6 / appState.viewport.escala, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; ctx.fill();
            }
            pontosOriginais.forEach((ponto, index) => {
                ctx.beginPath(); const handleRadius = 8 / appState.viewport.escala;
                ctx.arc(ponto.x, ponto.y, handleRadius, 0, 2 * Math.PI);
                ctx.fillStyle = (appState.ui.verticeSendoArrastado === index) ? '#ff0000' : '#3a4572';
                ctx.fill();
            });
        }
    });
    if (comodoAtivo && comodoAtivo.type === 'coluna' && !isExportMode) {
        const comodoPai = encontrarComodoPai(comodoAtivo, appState.comodos);
        if (comodoPai) {
            const medidas = calcularMedidasOrtogonais(comodoAtivo, comodoPai);
            ctx.save(); ctx.strokeStyle = 'red'; ctx.fillStyle = 'red'; ctx.lineWidth = 1 / appState.viewport.escala; ctx.setLineDash([5 / appState.viewport.escala, 3 / appState.viewport.escala]); ctx.font = `${12 / appState.viewport.escala}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            medidas.forEach(medida => {
                ctx.beginPath(); ctx.moveTo(medida.p1.x, medida.p1.y); ctx.lineTo(medida.p2.x, medida.p2.y); ctx.stroke();
                const texto = medida.dist.toFixed(2);
                const angulo = Math.atan2(medida.p2.y - medida.p1.y, medida.p2.x - medida.p1.x);
                ctx.save();
                ctx.translate((medida.p1.x + medida.p2.x) / 2, (medida.p1.y + medida.p2.y) / 2);
                ctx.rotate(angulo);
                if (angulo > Math.PI / 2 || angulo < -Math.PI / 2) {
                   ctx.rotate(Math.PI);
                }
                ctx.fillText(texto, 0, -5 / appState.viewport.escala);
                ctx.restore();
            });
            ctx.restore();
        }
    }
    if (appState.ui.snapPoint) { ctx.beginPath(); ctx.arc(appState.ui.snapPoint.x, appState.ui.snapPoint.y, 10 / appState.viewport.escala, 0, 2 * Math.PI); ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; ctx.lineWidth = 2 / appState.viewport.escala; ctx.stroke(); }
    ctx.restore();

    // --- LÓGICA DA BARRA DE FERRAMENTAS DO CANVAS ---
    const iconSize = 24;
    const buttonSize = 40;
    const iconPadding = (buttonSize - iconSize) / 2;
    const margin = 15;
    const gap = 10;
    
    const buttonDefs = [
        { id: 'addComodoBtn', text: 'Novo Cômodo', icon: 'new', color: '#28a745', active: true },
        { id: 'ciclarTipo', text: 'Alterar Tipo', icon: 'change', color: '#3a4572', active: !!comodoAtivo },
        { id: 'duplicarComodo', text: 'Duplicar', icon: 'duplicate', color: '#17a2b8', active: !!comodoAtivo },
        { id: 'deletarComodo', text: 'Deletar', icon: 'erase', color: '#c82333', active: !!comodoAtivo },
        { id: 'dividirParede', text: 'Dividir Parede', icon: 'divide', color: '#3a4572', active: !!comodoAtivo && comodoAtivo.type !== 'coluna' },
    ];

    buttonDefs.forEach((btnDef, index) => {
        const x = canvas.width - buttonSize - margin;
        const y = margin + (index * (buttonSize + gap));
        
        renderedButtons[btnDef.id] = { x, y, width: buttonSize, height: buttonSize, text: btnDef.text, active: btnDef.active };

        ctx.save();
        ctx.globalAlpha = btnDef.active ? 1.0 : 0.5;
        ctx.fillStyle = btnDef.color;
        
        if (btnDef.id === 'dividirParede' && appState.ui.modoAtual === 'dividir_parede') {
            ctx.fillStyle = '#c82333';
            ctx.globalAlpha = 1.0;
        }
        
        ctx.beginPath();
        ctx.roundRect(x, y, buttonSize, buttonSize, 8);
        ctx.fill();
        if (icons[btnDef.icon]) {
            ctx.drawImage(icons[btnDef.icon], x + iconPadding, y + iconPadding, iconSize, iconSize);
        }
        ctx.restore();
    });
    
    if (appState.ui.tooltip.visible) {
        const { text, x, y } = appState.ui.tooltip;
        ctx.font = '12px Arial';
        const textWidth = ctx.measureText(text).width;
        const tooltipHeight = 22;
        const tooltipWidth = textWidth + 16;
        let tooltipX = x - tooltipWidth - 10;
        let tooltipY = y - tooltipHeight / 2;
        if (tooltipX < 5) tooltipX = x + 15;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath(); ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4); ctx.fill();
        ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, tooltipX + tooltipWidth / 2, tooltipY + tooltipHeight / 2);
    }

    const painelEsquerda = document.getElementById('esquerda');
    if (comodoAtivo) {
        painelEsquerda.classList.add('visible');
    } else {
        painelEsquerda.classList.remove('visible');
    }
    sincronizarPaineisDeEdicao();
    document.getElementById("resultado").textContent = `Área Total: ${areaTotal.toFixed(2)} m² — Peças necessárias: ${quantidadeTotal ? quantidadeTotal : 'Calculando...'}`;
}

// ... (Restante do arquivo, a partir de 'ajustarTamanhoParede', permanece igual)
function ajustarTamanhoParede(novoTamanho) { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (!comodoAtivo || appState.ui.paredeSelecionadaIndex === null) return; const paredeIndex = appState.ui.paredeSelecionadaIndex; const p1 = comodoAtivo.pontos[paredeIndex]; const p2_index = (paredeIndex + 1) % comodoAtivo.pontos.length; const p2 = comodoAtivo.pontos[p2_index]; const vetorX = p2.x - p1.x; const vetorY = p2.y - p1.y; const comprimentoAtual = Math.sqrt(vetorX ** 2 + vetorY ** 2); if (comprimentoAtual === 0) return; const vetorNormalizadoX = vetorX / comprimentoAtual; const vetorNormalizadoY = vetorY / comprimentoAtual; comodoAtivo.pontos[p2_index].x = p1.x + vetorNormalizadoX * novoTamanho; comodoAtivo.pontos[p2_index].y = p1.y + vetorNormalizadoY * novoTamanho; saveStateForUndo(); render(); }
function recalcularPontosRotacionados(elemento) { const { largura, altura, rotacao } = elemento; const centro = { x: (getLimites(elemento.pontos).minX + getLimites(elemento.pontos).maxX) / 2, y: (getLimites(elemento.pontos).minY + getLimites(elemento.pontos).maxY) / 2 }; const anguloRad = rotacao * (Math.PI / 180); const cosA = Math.cos(anguloRad); const sinA = Math.sin(anguloRad); const meiaLargura = largura / 2; const meiaAltura = altura / 2; const pontosNaoRotacionados = [ { x: -meiaLargura, y: -meiaAltura }, { x: meiaLargura, y: -meiaAltura }, { x: meiaLargura, y: meiaAltura },  { x: -meiaLargura, y: meiaAltura } ]; elemento.pontos = pontosNaoRotacionados.map(p => ({ x: centro.x + p.x * cosA - p.y * sinA, y: centro.y + p.x * sinA + p.y * cosA })); }
function ajustarTamanhoColuna(novaLargura, novaAltura) { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (!comodoAtivo || comodoAtivo.type !== 'coluna') return; comodoAtivo.largura = novaLargura; comodoAtivo.altura = novaAltura; recalcularPontosRotacionados(comodoAtivo); saveStateForUndo(); render(); }
function converterTelaParaMapa(mouseX, mouseY) { const { escala, offsetX, offsetY } = appState.viewport; return { x: (mouseX - offsetX) / escala, y: (mouseY - offsetY) / escala }; }
function getInteracaoSobMouse(mouseX, mouseY) { const { escala, offsetX, offsetY } = appState.viewport; const pontoMapa = converterTelaParaMapa(mouseX, mouseY); let resultado = { tipo: null, comodoId: null, index: null, text: '' }; for (const key in renderedButtons) { const btn = renderedButtons[key]; if (mouseX >= btn.x && mouseX <= btn.x + btn.width && mouseY >= btn.y && mouseY <= btn.y + btn.height) { return { tipo: 'botao', id: key, text: btn.text }; } } for (let i = appState.comodos.length - 1; i >= 0; i--) { const comodo = appState.comodos[i]; if (comodo.id === appState.ui.comodoAtivoId && comodo.type !== 'coluna') { for (let j = 0; j < comodo.pontos.length; j++) { const ponto = comodo.pontos[j]; const dist = Math.sqrt((pontoMapa.x - ponto.x) ** 2 + (pontoMapa.y - ponto.y) ** 2) * escala; if (dist <= 8) return { tipo: 'vertice', comodoId: comodo.id, index: j }; } for (let j = 0; j < comodo.pontos.length; j++) { const p1 = comodo.pontos[j]; const p2 = comodo.pontos[(j + 1) % comodo.pontos.length]; if (distanciaPontoLinha(pontoMapa.x, pontoMapa.y, p1, p2) * escala < 5) resultado = { tipo: 'parede', comodoId: comodo.id, index: j }; } } if (pontoDentroPoligono(pontoMapa, comodo.pontos)) { if (resultado.tipo === null) resultado = { tipo: 'comodo', comodoId: comodo.id, index: null }; } } return resultado; }
function adicionarNovoComodo() { const novoId = Date.now(); const pecaPadrao = { largura: 0.30, comprimento: 0.30, padrao: 'grade', rotacionar: false, isCustom: false, modoTijoloCustom: false, offsetX: 0, offsetY: 0, juntaHorizontal: 0.002, juntaVertical: 0.002, selectedValue: 'grade,0.30,0.30' }; const pontos = [{ x: 1, y: 6 }, { x: 5, y: 6 }, { x: 5, y: 10 }, { x: 1, y: 10 }]; const limites = getLimites(pontos); const novoComodo = { id: novoId, pontos, type: 'comodo', textoCentral: `Cômodo ${appState.comodos.filter(c => c.type === 'comodo').length + 1}`, mostrarMedidas: true, rotacao: 0, largura: limites.maxX - limites.minX, altura: limites.maxY - limites.minY, tamanhoTexto: 16, cor: '#cccccc', peca: { ...pecaPadrao } }; appState.comodos.push(novoComodo); appState.ui.comodoAtivoId = novoId; appState.ui.paredeSelecionadaIndex = null; appState.ui.modoAtual = 'selecao'; saveStateForUndo(); render(); }
function deletarComodoAtivo() { if (!appState.ui.comodoAtivoId) return; if (appState.comodos.length <= 1) { alert("Não é possível deletar o último cômodo."); return; } if (confirm('Tem certeza que deseja deletar este elemento? A ação não pode ser desfeita.')) { appState.comodos = appState.comodos.filter(c => c.id !== appState.ui.comodoAtivoId); appState.ui.comodoAtivoId = null; saveStateForUndo(); render(); } }
function ciclarTipoComodo() { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (comodoAtivo) { switch (comodoAtivo.type) { case 'comodo': comodoAtivo.type = 'lote'; break; case 'lote': comodoAtivo.type = 'coluna'; if(!comodoAtivo.textoCentral || comodoAtivo.textoCentral.startsWith("Cômodo")) comodoAtivo.textoCentral = "Coluna"; break; case 'coluna': comodoAtivo.type = 'comodo'; if(!comodoAtivo.textoCentral || comodoAtivo.textoCentral === "Coluna") comodoAtivo.textoCentral = `Cômodo ${appState.comodos.filter(c => c.type === 'comodo').length + 1}`; break; default: comodoAtivo.type = 'comodo'; } appState.ui.paredeSelecionadaIndex = null; saveStateForUndo(); render(); } }
function duplicarComodoAtivo() { const comodoOriginal = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (!comodoOriginal) return; const novoComodo = JSON.parse(JSON.stringify(comodoOriginal)); novoComodo.id = Date.now(); const offset = 0.5; novoComodo.pontos.forEach(p => { p.x += offset; p.y += offset; }); appState.comodos.push(novoComodo); appState.ui.comodoAtivoId = novoComodo.id; saveStateForUndo(); render(); }
function encontrarPontoDeSnap(pontoArrastado, comodoIdArrastado) { const snapRadius = 10 / appState.viewport.escala; let bestSnap = null; let minDistance = Infinity; for (const comodo of appState.comodos) { if (comodo.id === comodoIdArrastado) continue; for (const ponto of comodo.pontos) { const distancia = Math.sqrt((pontoArrastado.x - ponto.x) ** 2 + (pontoArrastado.y - ponto.y) ** 2); if (distancia < snapRadius && distancia < minDistance) { minDistance = distancia; bestSnap = { x: ponto.x, y: ponto.y }; } } const limites = getLimites(comodo.pontos); const centro = { x: (limites.minX + limites.maxX) / 2, y: (limites.minY + limites.maxY) / 2 }; const distanciaCentro = Math.sqrt((pontoArrastado.x - centro.x) ** 2 + (pontoArrastado.y - centro.y) ** 2); if (distanciaCentro < snapRadius && distanciaCentro < minDistance) { minDistance = distanciaCentro; bestSnap = { x: centro.x, y: centro.y }; } } return bestSnap; }
function salvarProjeto() { try { const dataStr = JSON.stringify(appState, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'meu-projeto.planta'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href); } catch (error) { console.error("Erro ao salvar o projeto:", error); alert('Ocorreu um erro ao salvar o projeto.'); } }
function carregarProjeto() { document.getElementById('fileInput').click(); }
function handleFileSelect(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(e) { try { const content = e.target.result; const estadoCarregado = JSON.parse(content); if (!estadoCarregado.comodos || !estadoCarregado.viewport) { throw new Error("Formato de arquivo inválido."); } estadoCarregado.comodos.forEach(c => { if (c.peca === undefined) { c.peca = { largura: 0.30, comprimento: 0.30, padrao: 'grade', rotacionar: false, isCustom: false, modoTijoloCustom: false, offsetX: 0, offsetY: 0, juntaHorizontal: 0.002, juntaVertical: 0.002, selectedValue: 'grade,0.30,0.30' }; } if(c.textoCentral === undefined) c.textoCentral = ""; if(c.tamanhoTexto === undefined) c.tamanhoTexto = 16; if(c.cor === undefined) c.cor = '#cccccc'; if(c.mostrarMedidas === undefined) c.mostrarMedidas = true; if(c.rotacao === undefined) c.rotacao = 0; if(c.largura === undefined || c.altura === undefined) { const l = getLimites(c.pontos); c.largura = l.maxX - l.minX; c.altura = l.maxY - l.minY; } if (c.peca.offsetX === undefined) c.peca.offsetX = 0; if (c.peca.offsetY === undefined) c.peca.offsetY = 0; if (c.peca.juntaHorizontal === undefined) c.peca.juntaHorizontal = 0.002; if (c.peca.juntaVertical === undefined) c.peca.juntaVertical = 0.002; }); appState = estadoCarregado; history = [JSON.parse(JSON.stringify(appState))]; historyIndex = 0; render(); alert('Projeto carregado com sucesso!'); } catch (error) { console.error("Erro ao carregar o projeto:", error); alert('Não foi possível carregar o arquivo. O arquivo pode estar corrompido ou em um formato inválido.'); } }; reader.onerror = function() { alert("Ocorreu um erro ao ler o arquivo."); }; reader.readAsText(file); event.target.value = null; }
function exportarComoImagem() { render({ modo: 'exportacao' }); const canvasOriginal = document.getElementById('desenho'); const margem = 30; const tempCanvas = document.createElement('canvas'); tempCanvas.width = canvasOriginal.width + (margem * 2); tempCanvas.height = canvasOriginal.height + (margem * 2); const tempCtx = tempCanvas.getContext('2d'); tempCtx.fillStyle = 'white'; tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height); tempCtx.drawImage(canvasOriginal, margem, margem); const urlImagem = tempCanvas.toDataURL('image/png'); const link = document.createElement('a'); link.href = urlImagem; link.download = 'plano-calculado.png'; document.body.appendChild(link); link.click(); document.body.removeChild(link); render(); }
function resetarProjeto() { if (confirm('Tem certeza que deseja resetar o projeto? Todo o progresso não salvo será perdido.')) { appState = getDefaultState(); const canvas = document.getElementById('desenho'); const viewportInicial = calcularViewportInicial(appState.comodos, canvas); appState.viewport = viewportInicial; saveStateForUndo(); render(); } }

function sincronizarPaineisDeEdicao() {
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    const painelPecas = document.getElementById('calculadoraForm');
    const painelTexto = document.getElementById('texto-central-editor');
    const painelParede = document.getElementById('parede-editor');
    const painelColuna = document.getElementById('coluna-editor');
    const painelOpcoesVista = document.getElementById('view-options-editor');

    if (!comodoAtivo) {
        painelPecas.style.display = 'none';
        painelTexto.style.display = 'none';
        painelParede.style.display = 'none';
        painelColuna.style.display = 'none';
        painelOpcoesVista.style.display = 'none';
        return;
    }

    const tipo = comodoAtivo.type;
    const paredeSelecionada = appState.ui.paredeSelecionadaIndex !== null;
    
    painelOpcoesVista.style.display = 'block';
    painelPecas.style.display = (tipo === 'comodo' && !paredeSelecionada) ? 'block' : 'none';
    painelTexto.style.display = ((tipo === 'comodo' || tipo === 'coluna') && !paredeSelecionada) ? 'block' : 'none';
    painelParede.style.display = (tipo !== 'coluna' && paredeSelecionada) ? 'block' : 'none';
    painelColuna.style.display = (tipo === 'coluna' && !paredeSelecionada) ? 'block' : 'none';
    
    document.getElementById('mostrarMedidasToggle').checked = comodoAtivo.mostrarMedidas;
    
    const activeEl = document.activeElement;

    if (comodoAtivo.textoCentral !== undefined) {
        const textoEl = document.getElementById('textoCentral');
        const tamanhoTextoEl = document.getElementById('tamanhoTexto');
        if (activeEl.id !== 'textoCentral') textoEl.value = comodoAtivo.textoCentral;
        if (activeEl.id !== 'tamanhoTexto') tamanhoTextoEl.value = comodoAtivo.tamanhoTexto;
    }

    if (tipo === 'comodo') {
        const peca = comodoAtivo.peca;
        const inputs = { 'pecaSelect': peca.selectedValue, 'larguraPeca': peca.largura, 'comprimentoPeca': peca.comprimento, 'juntaHorizontal': peca.juntaHorizontal, 'juntaVertical': peca.juntaVertical };
        const checkboxes = { 'rotacionar': peca.rotacionar, 'modoTijoloCustom': peca.modoTijoloCustom };
        for (const id in inputs) { const el = document.getElementById(id); if (el && activeEl.id !== id) el.value = inputs[id]; }
        for (const id in checkboxes) { const el = document.getElementById(id); if (el) el.checked = checkboxes[id]; }
        document.getElementById("custom-dimensions").style.display = peca.isCustom ? 'block' : 'none';
    }
     if (paredeSelecionada && tipo !== 'coluna') {
        const p1 = comodoAtivo.pontos[appState.ui.paredeSelecionadaIndex];
        const p2 = comodoAtivo.pontos[(appState.ui.paredeSelecionadaIndex + 1) % comodoAtivo.pontos.length];
        const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        if (document.activeElement.id !== 'tamanhoParede') document.getElementById('tamanhoParede').value = dist.toFixed(2);
    }
     if (tipo === 'coluna') {
        if (document.activeElement.id !== 'larguraColuna') document.getElementById('larguraColuna').value = comodoAtivo.largura.toFixed(2);
        if (document.activeElement.id !== 'alturaColuna') document.getElementById('alturaColuna').value = comodoAtivo.altura.toFixed(2);
        if (document.activeElement.id !== 'rotacaoColuna') document.getElementById('rotacaoColuna').value = comodoAtivo.rotacao;
        if (document.activeElement.id !== 'corColuna') document.getElementById('corColuna').value = comodoAtivo.cor;
        document.getElementById('rotacaoValor').textContent = comodoAtivo.rotacao;
    }
}

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

function handleMouseMoveSelecao(e, mouseX, mouseY) {
    const canvas = e.target;
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    
    if (!appState.ui.isDragging) {
        const interacao = getInteracaoSobMouse(mouseX, mouseY);
        if (interacao.tipo === 'botao' && interacao.text) {
            appState.ui.tooltip = { visible: true, text: interacao.text, x: mouseX, y: mouseY };
        } else {
            appState.ui.tooltip = { visible: false, text: '', x: 0, y: 0 };
        }
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

function handleMouseMoveDividirParede(e, mouseX, mouseY) { const canvas = e.target; const interacao = getInteracaoSobMouse(mouseX, mouseY); const paredeIndex = (interacao.comodoId === appState.ui.comodoAtivoId && interacao.tipo === 'parede') ? interacao.index : null; let precisaRenderizar = false; if (paredeIndex !== null) { canvas.style.cursor = 'copy'; if (appState.ui.paredeEmDestaqueIndex !== paredeIndex) { appState.ui.paredeEmDestaqueIndex = paredeIndex; precisaRenderizar = true; } } else { canvas.style.cursor = 'default'; if (appState.ui.paredeEmDestaqueIndex !== null) { appState.ui.paredeEmDestaqueIndex = null; precisaRenderizar = true; } } if (precisaRenderizar) render(); }
function handleMouseDownDividirParede(e, mouseX, mouseY) { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (!comodoAtivo || appState.ui.paredeEmDestaqueIndex === null) return; const index = appState.ui.paredeEmDestaqueIndex; const pontos = comodoAtivo.pontos; const p1 = pontos[index]; const p2 = pontos[(index + 1) % pontos.length]; const novoPonto = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; pontos.splice(index + 1, 0, novoPonto); appState.ui.modoAtual = 'selecao'; appState.ui.paredeEmDestaqueIndex = null; appState.ui.paredeSelecionadaIndex = null; appState.ui.verticeSendoArrastado = index + 1; appState.ui.isDragging = true; saveStateForUndo(); render(); }

function makeDraggable(modalElement, headerElement) { let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0; headerElement.onmousedown = dragMouseDown; function dragMouseDown(e) { e.preventDefault(); pos3 = e.clientX; pos4 = e.clientY; document.onmouseup = closeDragElement; document.onmousemove = elementDrag; } function elementDrag(e) { e.preventDefault(); pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY; modalElement.style.top = (modalElement.offsetTop - pos2) + "px"; modalElement.style.left = (modalElement.offsetLeft - pos1) + "px"; } function closeDragElement() { document.onmouseup = null; document.onmousemove = null; } }

function saveStateForUndo() {
    history = history.slice(0, historyIndex + 1);
    history.push(JSON.parse(JSON.stringify(appState)));
    historyIndex++;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        appState = JSON.parse(JSON.stringify(history[historyIndex]));
        render();
    }
}

function loadIcons() {
    const iconNames = ['change', 'duplicate', 'erase', 'divide', 'new'];
    const promises = iconNames.map(name => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                icons[name] = img;
                resolve();
            };
            img.onerror = () => {
                console.error(`Falha ao carregar o ícone: image/${name}.png`);
                reject();
            };
            img.src = `image/${name}.png`;
        });
    });
    return Promise.all(promises);
}

function setupEventListeners() {
    const canvas = document.getElementById('desenho');
    
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
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
    document.getElementById('tamanhoParede').addEventListener('change', (e) => { const novoTamanho = parseFloat(e.target.value); if (!isNaN(novoTamanho) && novoTamanho > 0) ajustarTamanhoParede(novoTamanho); else render(); });
    const larguraColunaInput = document.getElementById('larguraColuna'); const alturaColunaInput = document.getElementById('alturaColuna');
    const Fg_coluna_recalcular = () => { const novaLargura = parseFloat(larguraColunaInput.value); const novaAltura = parseFloat(alturaColunaInput.value); if (!isNaN(novaLargura) && novaLargura > 0 && !isNaN(novaAltura) && novaAltura > 0) ajustarTamanhoColuna(novaLargura, novaAltura); else render(); };
    larguraColunaInput.addEventListener('change', Fg_coluna_recalcular);
    alturaColunaInput.addEventListener('change', Fg_coluna_recalcular);
    document.getElementById('rotacaoColuna').addEventListener('input', (e) => { const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (comodoAtivo) { comodoAtivo.rotacao = parseInt(e.target.value, 10); recalcularPontosRotacionados(comodoAtivo); render(); } });
    document.getElementById('rotacaoColuna').addEventListener('change', () => saveStateForUndo());
    document.getElementById('saveProjectBtn').addEventListener('click', salvarProjeto);
    document.getElementById('loadProjectBtn').addEventListener('click', carregarProjeto);
    document.getElementById('exportProjectBtn').addEventListener('click', exportarComoImagem);
    document.getElementById('resetProjectBtn').addEventListener('click', resetarProjeto);
    document.getElementById('closeEsquerdaBtn').addEventListener('click', () => { appState.ui.comodoAtivoId = null; render(); });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const interacao = getInteracaoSobMouse(mouseX, mouseY); if (interacao.tipo === 'vertice') { const comodoAtivo = appState.comodos.find(c => c.id === interacao.comodoId); if (comodoAtivo && comodoAtivo.pontos.length > 3) { comodoAtivo.pontos.splice(interacao.index, 1); appState.ui.paredeSelecionadaIndex = null; saveStateForUndo(); render(); } else { alert("Não é possível remover mais vértices. O cômodo deve ter no mínimo 3 lados."); } } });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); appState.ui.isPanning = true; appState.ui.panStartX = e.clientX; appState.ui.panStartY = e.clientY; canvas.style.cursor = 'move'; return; } const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const interacao = getInteracaoSobMouse(mouseX, mouseY); if (interacao.tipo === 'botao') { if (renderedButtons[interacao.id]?.active) { switch(interacao.id) { case 'addComodoBtn': adicionarNovoComodo(); break; case 'ciclarTipo': ciclarTipoComodo(); break; case 'duplicarComodo': duplicarComodoAtivo(); break; case 'deletarComodo': deletarComodoAtivo(); break; case 'dividirParede': appState.ui.modoAtual = appState.ui.modoAtual === 'dividir_parede' ? 'selecao' : 'dividir_parede'; render(); break; } } return; } if (appState.ui.modoAtual === 'selecao') handleMouseDownSelecao(e, mouseX, mouseY); else if (appState.ui.modoAtual === 'dividir_parede') handleMouseDownDividirParede(e, mouseX, mouseY); });
    canvas.addEventListener('mousemove', (e) => { if (appState.ui.isPanning) { const dx = e.clientX - appState.ui.panStartX; const dy = e.clientY - appState.ui.panStartY; appState.viewport.offsetX += dx; appState.viewport.offsetY += dy; appState.ui.panStartX = e.clientX; appState.ui.panStartY = e.clientY; render(); return; } const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; if (appState.ui.modoAtual === 'selecao') handleMouseMoveSelecao(e, mouseX, mouseY); else if (appState.ui.modoAtual === 'dividir_parede') handleMouseMoveDividirParede(e, mouseX, mouseY); });
    canvas.addEventListener('mouseup', (e) => { if (e.button === 1) { appState.ui.isPanning = false; canvas.style.cursor = 'default'; render(); } if (appState.ui.modoAtual === 'selecao') handleMouseUpSelecao(e); });
    canvas.addEventListener('mouseout', (e) => { appState.ui.tooltip.visible = false; if(!e.relatedTarget || e.relatedTarget.id !== 'desenho') { render(); } });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const zoomIntensity = 0.1; const direcao = e.deltaY > 0 ? -1 : 1; const escalaAntiga = appState.viewport.escala; const novaEscala = Math.max(0.1, escalaAntiga * (1 + direcao * zoomIntensity)); const mouseAntesX = (mouseX - appState.viewport.offsetX) / escalaAntiga; const mouseAntesY = (mouseY - appState.viewport.offsetY) / escalaAntiga; appState.viewport.escala = novaEscala; appState.viewport.offsetX = mouseX - mouseAntesX * novaEscala; appState.viewport.offsetY = mouseY - mouseAntesY * novaEscala; render(); });
    window.addEventListener('resize', () => render());
    document.getElementById('offset-controls').addEventListener('click', (e) => { const button = e.target.closest('.offset-btn'); if (!button) return; const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId); if (!comodoAtivo || comodoAtivo.type !== 'comodo') { alert("Por favor, selecione um cômodo editável primeiro."); return; } const axis = button.dataset.axis; const direction = parseInt(button.dataset.direction, 10); const step = 0.05; if (axis === 'x') comodoAtivo.peca.offsetX += direction * step; else if (axis === 'y') comodoAtivo.peca.offsetY += direction * step; debounce(() => { saveStateForUndo(); render(); }, 50); });
    window.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); } });
}

function calcularViewportInicial(comodos, canvas) { if (!comodos || comodos.length === 0 || !canvas) { return { escala: 50, offsetX: 100, offsetY: 100 }; } const todosOsPontos = comodos.flatMap(c => c.pontos); if (todosOsPontos.length === 0) { return { escala: 50, offsetX: 100, offsetY: 100 }; } const limites = getLimites(todosOsPontos); const larguraMundo = limites.maxX - limites.minX; const alturaMundo = limites.maxY - limites.minY; if (larguraMundo === 0 || alturaMundo === 0) { return { escala: 50, offsetX: 100, offsetY: 100 }; } const padding = 1.2; const escalaX = canvas.clientWidth / (larguraMundo * padding); const escalaY = canvas.clientHeight / (alturaMundo * padding); const escala = Math.min(escalaX, escalaY); const centroMundoX = limites.minX + larguraMundo / 2; const centroMundoY = limites.minY + alturaMundo / 2; const offsetX = (canvas.clientWidth / 2) - (centroMundoX * escala); const offsetY = (canvas.clientHeight / 2) - (centroMundoY * escala); return { escala, offsetX, offsetY }; }

async function iniciarApp() {
    await loadIcons();

    const dadosSalvos = localStorage.getItem('projetoPlantaBaixa');
    if (dadosSalvos) {
        try {
            appState = JSON.parse(dadosSalvos);
            if (appState.comodos === undefined) appState = getDefaultState();
            else {
                 appState.comodos.forEach(c => {
                    if (c.isLote !== undefined) { c.type = c.isLote ? 'lote' : 'comodo'; delete c.isLote; } 
                    else if (c.type === undefined) c.type = 'comodo';
                    if (c.textoCentral === undefined) c.textoCentral = "";
                    if (c.tamanhoTexto === undefined) c.tamanhoTexto = 16;
                    if (c.cor === undefined) c.cor = '#cccccc';
                    if (c.mostrarMedidas === undefined) c.mostrarMedidas = true;
                    if (c.rotacao === undefined) c.rotacao = 0;
                    if (c.largura === undefined || c.altura === undefined) { const l = getLimites(c.pontos); c.largura = l.maxX - l.minX; c.altura = l.maxY - l.minY; }
                    if (c.peca === undefined) {
                        c.peca = { largura: 0.30, comprimento: 0.30, padrao: 'grade', rotacionar: false, isCustom: false, modoTijoloCustom: false, offsetX: 0, offsetY: 0, juntaHorizontal: 0.002, juntaVertical: 0.002, selectedValue: 'grade,0.30,0.30' };
                    }
                     if (c.peca.offsetX === undefined) c.peca.offsetX = 0;
                     if (c.peca.offsetY === undefined) c.peca.offsetY = 0;
                     if (c.peca.juntaHorizontal === undefined) c.peca.juntaHorizontal = 0.002;
                     if (c.peca.juntaVertical === undefined) c.peca.juntaVertical = 0.002;
                });
            }
        } catch (e) {
            console.error("Não foi possível carregar dados salvos.", e);
            appState = getDefaultState();
        }
    } else {
        appState = getDefaultState();
        const canvas = document.getElementById('desenho');
        const viewportInicial = calcularViewportInicial(appState.comodos, canvas);
        appState.viewport = viewportInicial;
    }

    history = [JSON.parse(JSON.stringify(appState))];
    historyIndex = 0;
    setupEventListeners();
    makeDraggable(document.getElementById('esquerda'), document.querySelector('#esquerda .modal-header'));
    render();
}

iniciarApp();