// js/actions.js
import { appState, saveStateForUndo, debounce } from './state.js';
import { render } from './render.js';
import { getLimites } from './geometry.js';

export function adicionarNovoComodo() {
    const novoId = Date.now();
    const pecaPadrao = { largura: 0.30, comprimento: 0.30, padrao: 'grade', rotacionar: false, isCustom: false, modoTijoloCustom: false, offsetX: 0, offsetY: 0, juntaHorizontal: 0.002, juntaVertical: 0.002, selectedValue: 'grade,0.30,0.30' };
    const pontos = [{ x: 1, y: 6 }, { x: 5, y: 6 }, { x: 5, y: 10 }, { x: 1, y: 10 }];
    const limites = getLimites(pontos);
    const novoComodo = { id: novoId, pontos, type: 'comodo', textoCentral: `Cômodo ${appState.comodos.filter(c => c.type === 'comodo').length + 1}`, mostrarMedidas: true, rotacao: 0, largura: limites.maxX - limites.minX, altura: limites.maxY - limites.minY, tamanhoTexto: 16, cor: '#cccccc', peca: { ...pecaPadrao } };
    appState.comodos.push(novoComodo);
    appState.ui.comodoAtivoId = novoId;
    appState.ui.paredeSelecionadaIndex = null;
    appState.ui.modoAtual = 'selecao';
    saveStateForUndo();
    render();
}

export function deletarComodoAtivo() {
    if (!appState.ui.comodoAtivoId) return;
    if (appState.comodos.length <= 1) {
        alert("Não é possível deletar o último cômodo.");
        return;
    }
    if (confirm('Tem certeza que deseja deletar este elemento? A ação não pode ser desfeita.')) {
        appState.comodos = appState.comodos.filter(c => c.id !== appState.ui.comodoAtivoId);
        appState.ui.comodoAtivoId = null;
        saveStateForUndo();
        render();
    }
}

export function ciclarTipoComodo() {
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (comodoAtivo) {
        switch (comodoAtivo.type) {
            case 'comodo': comodoAtivo.type = 'lote'; break;
            case 'lote': comodoAtivo.type = 'coluna'; if (!comodoAtivo.textoCentral || comodoAtivo.textoCentral.startsWith("Cômodo")) comodoAtivo.textoCentral = "Coluna"; break;
            case 'coluna': comodoAtivo.type = 'comodo'; if (!comodoAtivo.textoCentral || comodoAtivo.textoCentral === "Coluna") comodoAtivo.textoCentral = `Cômodo ${appState.comodos.filter(c => c.type === 'comodo').length}`; break;
            default: comodoAtivo.type = 'comodo';
        }
        appState.ui.paredeSelecionadaIndex = null;
        saveStateForUndo();
        render();
    }
}

export function duplicarComodoAtivo() {
    const comodoOriginal = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (!comodoOriginal) return;
    const novoComodo = JSON.parse(JSON.stringify(comodoOriginal));
    novoComodo.id = Date.now();
    const offset = 0.5;
    novoComodo.pontos.forEach(p => { p.x += offset; p.y += offset; });
    appState.comodos.push(novoComodo);
    appState.ui.comodoAtivoId = novoComodo.id;
    saveStateForUndo();
    render();
}

export function ajustarTamanhoParede(novoTamanho) {
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (!comodoAtivo || appState.ui.paredeSelecionadaIndex === null) return;
    const paredeIndex = appState.ui.paredeSelecionadaIndex;
    const p1 = comodoAtivo.pontos[paredeIndex];
    const p2_index = (paredeIndex + 1) % comodoAtivo.pontos.length;
    const vetorX = comodoAtivo.pontos[p2_index].x - p1.x;
    const vetorY = comodoAtivo.pontos[p2_index].y - p1.y;
    const comprimentoAtual = Math.sqrt(vetorX ** 2 + vetorY ** 2);
    if (comprimentoAtual === 0) return;
    const vetorNormalizadoX = vetorX / comprimentoAtual;
    const vetorNormalizadoY = vetorY / comprimentoAtual;
    comodoAtivo.pontos[p2_index].x = p1.x + vetorNormalizadoX * novoTamanho;
    comodoAtivo.pontos[p2_index].y = p1.y + vetorNormalizadoY * novoTamanho;
    saveStateForUndo();
    render();
}

export function recalcularPontosRotacionados(elemento) {
    const { largura, altura, rotacao } = elemento;
    const centro = { x: (getLimites(elemento.pontos).minX + getLimites(elemento.pontos).maxX) / 2, y: (getLimites(elemento.pontos).minY + getLimites(elemento.pontos).maxY) / 2 };
    const anguloRad = rotacao * (Math.PI / 180);
    const cosA = Math.cos(anguloRad);
    const sinA = Math.sin(anguloRad);
    const meiaLargura = largura / 2;
    const meiaAltura = altura / 2;
    const pontosNaoRotacionados = [{ x: -meiaLargura, y: -meiaAltura }, { x: meiaLargura, y: -meiaAltura }, { x: meiaLargura, y: meiaAltura }, { x: -meiaLargura, y: meiaAltura }];
    elemento.pontos = pontosNaoRotacionados.map(p => ({ x: centro.x + p.x * cosA - p.y * sinA, y: centro.y + p.x * sinA + p.y * cosA }));
}

export function ajustarTamanhoColuna(novaLargura, novaAltura) {
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);
    if (!comodoAtivo || comodoAtivo.type !== 'coluna') return;
    comodoAtivo.largura = novaLargura;
    comodoAtivo.altura = novaAltura;
    recalcularPontosRotacionados(comodoAtivo);
    saveStateForUndo();
    render();
}

export function toggleModoDividirParede() {
    appState.ui.modoAtual = appState.ui.modoAtual === 'dividir_parede' ? 'selecao' : 'dividir_parede';
    render();
}