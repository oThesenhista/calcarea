// js/project.js
import { appState, initializeState, getDefaultState, history, historyIndex } from './state.js';
import { render } from './render.js';
import { getLimites, calcularViewportInicial } from './geometry.js';

export function salvarProjeto() {
    try {
        const dataStr = JSON.stringify(appState, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'meu-projeto.planta';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error("Erro ao salvar o projeto:", error);
        alert('Ocorreu um erro ao salvar o projeto.');
    }
}

export function carregarProjeto() {
    document.getElementById('fileInput').click();
}

export function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const estadoCarregado = JSON.parse(content);
            if (!estadoCarregado.comodos || !estadoCarregado.viewport) {
                throw new Error("Formato de arquivo inválido.");
            }
            // Lógica de migração
            estadoCarregado.comodos.forEach(c => {
                if (c.peca === undefined) c.peca = { largura: 0.30, comprimento: 0.30, padrao: 'grade', rotacionar: false, isCustom: false, modoTijoloCustom: false, offsetX: 0, offsetY: 0, juntaHorizontal: 0.002, juntaVertical: 0.002, selectedValue: 'grade,0.30,0.30' };
                if(c.textoCentral === undefined) c.textoCentral = "";
                if(c.tamanhoTexto === undefined) c.tamanhoTexto = 16;
                //... (resto da lógica de migração)
            });
            initializeState(estadoCarregado);
            render();
            alert('Projeto carregado com sucesso!');
        } catch (error) {
            console.error("Erro ao carregar o projeto:", error);
            alert('Não foi possível carregar o arquivo. O arquivo pode estar corrompido ou em um formato inválido.');
        }
    };
    reader.onerror = function() { alert("Ocorreu um erro ao ler o arquivo."); };
    reader.readAsText(file);
    event.target.value = null;
}

export function exportarComoImagem() {
    render({ modo: 'exportacao' });
    const canvasOriginal = document.getElementById('desenho');
    const margem = 30;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasOriginal.width + (margem * 2);
    tempCanvas.height = canvasOriginal.height + (margem * 2);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvasOriginal, margem, margem);
    const urlImagem = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = urlImagem;
    link.download = 'plano-calculado.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    render();
}

export function resetarProjeto() {
    if (confirm('Tem certeza que deseja resetar o projeto? Todo o progresso não salvo será perdido.')) {
        const newState = getDefaultState();
        const canvas = document.getElementById('desenho');
        newState.viewport = calcularViewportInicial(newState.comodos, canvas);
        initializeState(newState);
        render();
    }
}