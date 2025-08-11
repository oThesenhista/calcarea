// Variável global para armazenar o padrão de desenho selecionado
let padraoDesenho = 'grade'; // 'grade', 'tijolo' ou 'forro'

// Função auxiliar para debounce
let timeoutId = null;
function debounce(func, delay) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(func, delay);
}

// Funções auxiliares para geometria
function pontoDentroPoligono(x, y, poligono) {
    let dentro = false;
    for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
        const xi = poligono[i].x, yi = poligono[i].y;
        const xj = poligono[j].x, yj = poligono[j].y;
        const intersect = ((yi > y) !== (yj > y)) &&
                          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) dentro = !dentro;
    }
    return dentro;
}

function gerarPontosIrregulares(pFrontal, pTraseira, pEsquerda, pDireita) {
    const pontos = [
        { x: 0, y: 0 },
        { x: pFrontal, y: 0 },
        { x: pTraseira, y: pDireita },
        { x: 0, y: pEsquerda }
    ];
    return pontos;
}

function calcularArea(poligono) {
    let area = 0;
    for (let i = 0; i < poligono.length; i++) {
        const j = (i + 1) % poligono.length;
        area += poligono[i].x * poligono[j].y;
        area -= poligono[j].x * poligono[i].y;
    }
    return Math.abs(area / 2);
}

function centralizarPoligono(poligono, canvas) {
    const minX = Math.min(...poligono.map(p => p.x));
    const maxX = Math.max(...poligono.map(p => p.x));
    const minY = Math.min(...poligono.map(p => p.y));
    const maxY = Math.max(...poligono.map(p => p.y));

    let larguraPoligono = maxX - minX;
    let alturaPoligono = maxY - minY;

    if (larguraPoligono === 0) larguraPoligono = 1;
    if (alturaPoligono === 0) alturaPoligono = 1;
    
    const escalaX = canvas.width / larguraPoligono / 1.1;
    const escalaY = canvas.height / alturaPoligono / 1.1;
    const escala = Math.min(escalaX, escalaY);

    const offsetX = (canvas.width / 2) - (minX + larguraPoligono / 2) * escala;
    const offsetY = (canvas.height / 2) - (minY + alturaPoligono / 2) * escala;

    const pontosCentralizados = poligono.map(p => ({
        x: p.x * escala + offsetX,
        y: p.y * escala + offsetY
    }));

    return { pontosCentralizados, escala };
}

function retanguloCruzaPoligono(retangulo, poligono) {
    const [x, y, largura, comprimento] = retangulo;

    const cantos = [
        { x: x, y: y },
        { x: x + largura, y: y },
        { x: x + largura, y: y + comprimento },
        { x: x, y: y + comprimento }
    ];
    if (cantos.some(p => pontoDentroPoligono(p.x, p.y, poligono))) {
        return true;
    }
    if (poligono.some(p => p.x >= x && p.x <= x + largura && p.y >= y && p.y <= y + comprimento)) {
        return true;
    }
    for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
        const p1 = poligono[i];
        const p2 = poligono[j];
        if (linhaCruzaRetangulo(p1, p2, retangulo)) {
            return true;
        }
    }
    return false;
}

function linhaCruzaRetangulo(p1, p2, retangulo) {
    const [rx, ry, rw, rh] = retangulo;
    const retanguloPontos = [
        { x: rx, y: ry }, { x: rx + rw, y: ry },
        { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh }
    ];
    for (let i = 0; i < 4; i++) {
        const p3 = retanguloPontos[i];
        const p4 = retanguloPontos[(i + 1) % 4];
        if (linhaCruzaLinha(p1, p2, p3, p4)) {
            return true;
        }
    }
    return false;
}

function linhaCruzaLinha(p1, p2, p3, p4) {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (det === 0) return false;
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / det;
    const u = -((p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)) / det;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function desenharPecas(poligono, larguraPeca, comprimentoPeca, rotacionar, ctx, escala) {
    const minXPoligono = Math.min(...poligono.map(p => p.x));
    const maxXPoligono = Math.max(...poligono.map(p => p.x));
    const minYPoligono = Math.min(...poligono.map(p => p.y));
    const maxYPoligono = Math.max(...poligono.map(p => p.y));
    
    let contador = 0;

    let larguraPx = rotacionar ? comprimentoPeca * escala : larguraPeca * escala;
    let comprimentoPx = rotacionar ? larguraPeca * escala : comprimentoPeca * escala;
    
    if (larguraPx <= 0 || comprimentoPx <= 0) {
        return 0;
    }

    if (padraoDesenho === 'grade') {
        for (let y = minYPoligono; y < maxYPoligono; y += comprimentoPx) {
            for (let x = minXPoligono; x < maxXPoligono; x += larguraPx) {
                const retangulo = [x, y, larguraPx, comprimentoPx];
                if (retanguloCruzaPoligono(retangulo, poligono)) {
                    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                    ctx.fillRect(x, y, larguraPx, comprimentoPx);
                    ctx.strokeStyle = "#333";
                    ctx.strokeRect(x, y, larguraPx, comprimentoPx);
                    contador++;
                }
            }
        }
    } else if (padraoDesenho === 'tijolo') {
        let linha = 0;
        for (let y = minYPoligono; y < maxYPoligono; y += comprimentoPx) {
            let xOffset = (linha % 2 === 1) ? larguraPx / 2 : 0;
            
            for (let x = minXPoligono + xOffset; x < maxXPoligono; x += larguraPx) {
                const retangulo = [x, y, larguraPx, comprimentoPx];
                if (retanguloCruzaPoligono(retangulo, poligono)) {
                    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                    ctx.fillRect(x, y, larguraPx, comprimentoPx);
                    ctx.strokeStyle = "#333";
                    ctx.strokeRect(x, y, larguraPx, comprimentoPx);
                    contador++;
                }
            }
            linha++;
        }
    } else if (padraoDesenho === 'forro') {
        let pecasNovas = 0;
        let sobras = []; 
        let larguraRealPeca = rotacionar ? comprimentoPeca : larguraPeca;
        let comprimentoRealPeca = rotacionar ? larguraPeca : comprimentoPeca;

        for (let y = minYPoligono; y < maxYPoligono; y += comprimentoRealPeca * escala) {
            let x = minXPoligono;
            let larguraRestanteNaLinha = (maxXPoligono - minXPoligono) / escala;
            
            while (larguraRestanteNaLinha > 0.01) {
                let larguraDaPecaASerUsada = 0;
                let sobraUsada = false;

                sobras.sort((a, b) => b - a);
                for (let i = 0; i < sobras.length; i++) {
                    if (sobras[i] >= larguraRestanteNaLinha - 0.01) {
                        larguraDaPecaASerUsada = larguraRestanteNaLinha;
                        sobras[i] -= larguraDaPecaASerUsada;
                        if (sobras[i] < 0.01) {
                            sobras.splice(i, 1);
                        }
                        sobraUsada = true;
                        break;
                    }
                }
                
                if (!sobraUsada) {
                    pecasNovas++;
                    larguraDaPecaASerUsada = Math.min(larguraRealPeca, larguraRestanteNaLinha);
                    
                    const sobra = larguraRealPeca - larguraDaPecaASerUsada;
                    if (sobra > 0.01) {
                        sobras.push(sobra);
                    }
                }
                
                const retangulo = [x, y, larguraDaPecaASerUsada * escala, comprimentoRealPeca * escala];

                if (retanguloCruzaPoligono(retangulo, poligono)) {
                    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                    ctx.fillRect(retangulo[0], retangulo[1], retangulo[2], retangulo[3]);
                    ctx.strokeStyle = "#333";
                    ctx.strokeRect(retangulo[0], retangulo[1], retangulo[2], retangulo[3]);
                }

                x += larguraDaPecaASerUsada * escala;
                larguraRestanteNaLinha -= larguraDaPecaASerUsada;
            }
        }
        contador = pecasNovas;
    }
    
    return contador;
}

function atualizarCanvas() {
    const paredeFrontal = parseFloat(document.getElementById("paredeFrontal").value);
    const paredeTraseira = parseFloat(document.getElementById("paredeTraseira").value);
    const paredeEsquerda = parseFloat(document.getElementById("paredeEsquerda").value);
    const paredeDireita = parseFloat(document.getElementById("paredeDireita").value);
    const larguraPeca = parseFloat(document.getElementById("larguraPeca").value);
    const comprimentoPeca = parseFloat(document.getElementById("comprimentoPeca").value);
    const rotacionar = document.getElementById("rotacionar").checked;

    if (isNaN(paredeFrontal) || isNaN(paredeTraseira) || isNaN(paredeEsquerda) || isNaN(paredeDireita) ||
        isNaN(larguraPeca) || isNaN(comprimentoPeca) ||
        paredeFrontal <= 0 || paredeTraseira <= 0 || paredeEsquerda <= 0 || paredeDireita <= 0 ||
        larguraPeca <= 0 || comprimentoPeca <= 0) {
        document.getElementById("resultado").textContent = "Por favor, insira valores válidos e maiores que zero.";
        const canvas = document.getElementById("desenho");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const canvas = document.getElementById("desenho");
    const ctx = canvas.getContext("2d");
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pontosOriginais = gerarPontosIrregulares(paredeFrontal, paredeTraseira, paredeEsquerda, paredeDireita);
    
    const { pontosCentralizados, escala } = centralizarPoligono(pontosOriginais, canvas);
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pontosCentralizados[0].x, pontosCentralizados[0].y);
    for (let i = 1; i < pontosCentralizados.length; i++) {
        ctx.lineTo(pontosCentralizados[i].x, pontosCentralizados[i].y);
    }
    ctx.closePath();
    ctx.clip();
    
    const area = calcularArea(pontosOriginais);
    const quantidade = desenharPecas(pontosCentralizados, larguraPeca, comprimentoPeca, rotacionar, ctx, escala);

    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(pontosCentralizados[0].x, pontosCentralizados[0].y);
    for (let i = 1; i < pontosCentralizados.length; i++) {
        ctx.lineTo(pontosCentralizados[i].x, pontosCentralizados[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = "#3a4572";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // --- Lógica para Desenhar as Medidas das Paredes com novos nomes e correção de posicionamento ---
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#3a4572";

    const paredes = [
        { name: "Área Acima", dim: paredeFrontal, p1: pontosCentralizados[0], p2: pontosCentralizados[1] },
        { name: "Área Direita", dim: paredeDireita, p1: pontosCentralizados[1], p2: pontosCentralizados[2] },
        { name: "Área Abaixo", dim: paredeTraseira, p1: pontosCentralizados[2], p2: pontosCentralizados[3] },
        { name: "Área Esquerda", dim: paredeEsquerda, p1: pontosCentralizados[3], p2: pontosCentralizados[0] }
    ];

    paredes.forEach((parede, index) => {
        const meio = {
            x: (parede.p1.x + parede.p2.x) / 2,
            y: (parede.p1.y + parede.p2.y) / 2
        };
        const angulo = Math.atan2(parede.p2.y - parede.p1.y, parede.p2.x - parede.p1.x);

        ctx.save();
        ctx.translate(meio.x, meio.y);
        ctx.rotate(angulo);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Offset padrão para o texto ficar fora da parede
        let offsetY = -15; // Distância padrão para o texto

        // Inverte a rotação para que o texto não fique de cabeça para baixo
        if (angulo > Math.PI / 2 || angulo < -Math.PI / 2) {
             ctx.rotate(Math.PI);
        }

        // Para a parede traseira, o offset deve ser positivo para desenhar para baixo
        if (index === 2) { 
            offsetY = 15;
        }

        ctx.fillText(`${parede.name}: ${parede.dim.toFixed(2)}m`, 0, offsetY);
        
        ctx.restore();
    });
    // --- FIM DA NOVA LÓGICA ---

    document.getElementById("resultado").textContent =
        `Área: ${area.toFixed(2)} m² — Peças necessárias: ${quantidade}`;
}

document.getElementById("calculadoraForm").addEventListener("submit", (event) => {
    event.preventDefault();
    atualizarCanvas();
});

document.getElementById("pecaSelect").addEventListener("change", (event) => {
    const selectedValue = event.target.value;
    const customDimensionsDiv = document.getElementById("custom-dimensions");
    const larguraPecaInput = document.getElementById("larguraPeca");
    const comprimentoPecaInput = document.getElementById("comprimentoPeca");
    const modoTijoloCustomCheckbox = document.getElementById("modoTijoloCustom");

    if (selectedValue === "custom") {
        customDimensionsDiv.style.display = "block";
        larguraPecaInput.value = "";
        comprimentoPecaInput.value = "";
        padraoDesenho = modoTijoloCustomCheckbox.checked ? 'tijolo' : 'grade';
    } else {
        customDimensionsDiv.style.display = "none";
        const [padrao, largura, comprimento] = selectedValue.split(",");
        larguraPecaInput.value = largura;
        comprimentoPecaInput.value = comprimento;
        padraoDesenho = padrao;
    }
    debounce(atualizarCanvas, 500);
});

// Adiciona os event listeners para os novos botões spinner
document.querySelectorAll(".spinner-button").forEach(button => {
    button.addEventListener("click", () => {
        const inputId = button.dataset.inputId;
        const action = button.dataset.action;
        const inputElement = document.getElementById(inputId);
        let value = parseFloat(inputElement.value) || 0;
        const step = parseFloat(inputElement.step) || 1;

        if (action === "increment") {
            value += step;
        } else if (action === "decrement") {
            value -= step;
        }
        
        inputElement.value = value.toFixed(2); // Fixa em 2 casas decimais
        debounce(atualizarCanvas, 500);
    });
});

// Atualiza o canvas quando o valor do input é alterado manualmente
document.querySelectorAll(".spinner-input").forEach(input => {
    input.addEventListener("input", () => debounce(atualizarCanvas, 500));
});


document.getElementById("rotacionar").addEventListener("change", () => debounce(atualizarCanvas, 500));
document.getElementById("modoTijoloCustom").addEventListener("change", () => {
    if (document.getElementById("pecaSelect").value === "custom") {
        padraoDesenho = document.getElementById("modoTijoloCustom").checked ? 'tijolo' : 'grade';
        debounce(atualizarCanvas, 500);
    }
});

atualizarCanvas();