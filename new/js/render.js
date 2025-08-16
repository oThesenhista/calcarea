// js/render.js
import { appState } from './state.js';
import { getLimites, calcularArea, encontrarComodoPai, calcularMedidasOrtogonais, retanguloCruzaPoligono } from './geometry.js';
import { sincronizarPaineisDeEdicao, updateToolbarState } from './ui.js';

function desenharPecasNaArea(ctx, poligono, pecaConfig) {
    const { largura, comprimento, rotacionar, padrao, offsetX, offsetY, isCustom, juntaHorizontal, juntaVertical } = pecaConfig;
    const pecaLarguraMundo = rotacionar ? comprimento : largura;
    const pecaComprimentoMundo = rotacionar ? largura : comprimento;
    if (pecaLarguraMundo <= 0 || pecaComprimentoMundo <= 0) return 0;
    const espacoH = isCustom ? juntaHorizontal : 0;
    const espacoV = isCustom ? juntaVertical : 0;
    const passoX = pecaLarguraMundo + espacoH;
    const passoY = pecaComprimentoMundo + espacoV;
    const minXPoligono = Math.min(...poligono.map(p => p.x));
    const maxXPoligono = Math.max(...poligono.map(p => p.x));
    const minYPoligono = Math.min(...poligono.map(p => p.y));
    const maxYPoligono = Math.max(...poligono.map(p => p.y));
    let contador = 0;
    const desenharPecaSeValido = (x, y, larg, comp) => {
        const pecaRectMundo = { x, y, largura: larg, altura: comp };
        if (retanguloCruzaPoligono(pecaRectMundo, poligono)) {
            ctx.strokeRect(pecaRectMundo.x, pecaRectMundo.y, pecaRectMundo.largura, pecaRectMundo.altura);
            return true;
        }
        return false;
    };
    const startX = minXPoligono - pecaLarguraMundo;
    const endX = maxXPoligono + pecaLarguraMundo;
    const startY = minYPoligono - pecaComprimentoMundo;
    const endY = maxYPoligono + pecaComprimentoMundo;
    if (padrao === 'grade' || padrao === 'forro') {
        for (let y = startY + offsetY; y < endY; y += passoY) {
            for (let x = startX + offsetX; x < endX; x += passoX) {
                if (desenharPecaSeValido(x, y, pecaLarguraMundo, pecaComprimentoMundo)) contador++;
            }
        }
    } else if (padrao === 'tijolo') {
        let linha = 0;
        for (let y = startY + offsetY; y < endY; y += passoY) {
            let xOffsetTijolo = (linha % 2 === 1) ? -passoX / 2 : 0;
            for (let x = startX + offsetX + xOffsetTijolo; x < endX; x += passoX) {
                if (desenharPecaSeValido(x, y, pecaLarguraMundo, pecaComprimentoMundo)) contador++;
            }
            linha++;
        }
    }
    return contador;
}

export function render(options = {}) {
    const isExportMode = options.modo === 'exportacao';
    const canvas = document.getElementById("desenho");
    const ctx = canvas.getContext("2d");
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
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

    // Lógica da tooltip (se ainda quiser usar para algo no canvas)
    if (appState.ui.tooltip.visible) {
        // ... (código da tooltip)
    }

    // Atualiza a UI de HTML
    sincronizarPaineisDeEdicao();
    updateToolbarState();

    const painelEsquerda = document.getElementById('esquerda');
    if (comodoAtivo) {
        painelEsquerda.classList.add('visible');
    } else {
        painelEsquerda.classList.remove('visible');
    }
    
    document.getElementById("resultado").textContent = `Área Total: ${areaTotal.toFixed(2)} m² — Peças necessárias: ${quantidadeTotal ? quantidadeTotal : 'Calculando...'}`;
}