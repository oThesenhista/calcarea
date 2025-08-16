// js/main.js (CORRIGIDO PARA CENTRALIZAR)
import { appState, initializeState, getDefaultState } from './state.js';
import { setupEventListeners } from './events.js';
import { render } from './render.js';
import { makeDraggable, loadIcons } from './ui.js';
import { calcularViewportInicial, getLimites } from './geometry.js';

/**
 * Ponto de entrada principal da aplicação.
 */
async function iniciarApp() {
    await loadIcons();

    const dadosSalvos = localStorage.getItem('projetoPlantaBaixa');
    let estadoParaCarregar;
    let calcularView = false; // ADICIONADO: Flag para controlar se devemos calcular o viewport

    if (dadosSalvos) {
        try {
            const estadoCarregado = JSON.parse(dadosSalvos);
             if (estadoCarregado.comodos === undefined) {
                estadoParaCarregar = getDefaultState();
                calcularView = true; // ADICIONADO: Se o estado salvo for inválido, começamos de novo e calculamos a view
            } else {
                // Lógica de migração de dados de versões antigas
                estadoCarregado.comodos.forEach(c => {
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
                estadoParaCarregar = estadoCarregado;
            }
        } catch (e) {
            console.error("Não foi possível carregar dados salvos.", e);
            estadoParaCarregar = getDefaultState();
            calcularView = true; // ADICIONADO: Se der erro ao carregar, começamos de novo e calculamos a view
        }
    } else {
        estadoParaCarregar = getDefaultState();
        calcularView = true; // ADICIONADO: Se não há dados salvos, é um novo projeto, então calculamos a view
    }
    
    // MODIFICADO: Lógica para calcular o viewport inicial apenas quando necessário
    if (calcularView) {
        // Para que o cálculo do canvas funcione, ele precisa estar visível e com seu tamanho definido
        // Garantimos que o DOM esteja pronto para a medição do canvas.
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const canvas = document.getElementById('desenho');
        const viewportCalculado = calcularViewportInicial(estadoParaCarregar.comodos, canvas);
        estadoParaCarregar.viewport = viewportCalculado;
    }
    
    initializeState(estadoParaCarregar);
    setupEventListeners();
    makeDraggable(document.getElementById('esquerda'), document.querySelector('#esquerda .modal-header'));
    render();
}

// Inicia a aplicação
iniciarApp();