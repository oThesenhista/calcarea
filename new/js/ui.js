// js/ui.js
import { appState } from './state.js';
import { getLimites } from './geometry.js';

export const icons = {};

export async function loadIcons() {
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

export function makeDraggable(modalElement, headerElement) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    headerElement.onmousedown = dragMouseDown;
    function dragMouseDown(e) { e.preventDefault(); pos3 = e.clientX; pos4 = e.clientY; document.onmouseup = closeDragElement; document.onmousemove = elementDrag; }
    function elementDrag(e) { e.preventDefault(); pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY; modalElement.style.top = (modalElement.offsetTop - pos2) + "px"; modalElement.style.left = (modalElement.offsetLeft - pos1) + "px"; }
    function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
}

export function sincronizarPaineisDeEdicao() {
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

export function updateToolbarState() {
    const comodoAtivo = appState.comodos.find(c => c.id === appState.ui.comodoAtivoId);

    document.getElementById('toolbarCiclarTipo').disabled = !comodoAtivo;
    document.getElementById('toolbarDuplicar').disabled = !comodoAtivo;
    document.getElementById('toolbarDeletar').disabled = !comodoAtivo;
    document.getElementById('toolbarDividirParede').disabled = !(comodoAtivo && comodoAtivo.type !== 'coluna');
    
    const dividirBtn = document.getElementById('toolbarDividirParede');
    if (appState.ui.modoAtual === 'dividir_parede') {
        dividirBtn.classList.add('active');
    } else {
        dividirBtn.classList.remove('active');
    }
}