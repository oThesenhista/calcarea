// js/state.js
import { getLimites } from './geometry.js';
import { render } from './render.js';

export let appState;
export let history = [];
export let historyIndex = -1;
export let timeoutId = null;

export function debounce(func, delay) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(func, delay);
}

export function initializeState(initialState) {
    appState = initialState;
    history = [JSON.parse(JSON.stringify(appState))];
    historyIndex = 0;
}

export function saveStateForUndo() {
    history = history.slice(0, historyIndex + 1);
    history.push(JSON.parse(JSON.stringify(appState)));
    historyIndex++;
}

export function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        // Atribui uma cópia profunda para evitar referências cruzadas
        appState = JSON.parse(JSON.stringify(history[historyIndex]));
        render();
    }
}

export function getDefaultState() {
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