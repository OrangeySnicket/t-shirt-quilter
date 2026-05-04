/* =============================================
   T-Shirt Quilt Planner — Core Logic
   ============================================= */

// --- State ---
let blocks = [];
let layoutResult = null;

// --- DOM Refs ---
const $ = id => document.getElementById(id);
const quiltW = $('quilt-width'), quiltH = $('quilt-height'), sashingW = $('sashing-width');
const colorDistCB = $('maximize-color-dist'), partialSeamsCB = $('minimize-partial-seams');
const blockForm = $('block-form'), blockTableBody = $('block-table-body');
const genBtn = $('generate-btn'), exportBtn = $('export-pdf-btn');
const csvDrop = $('csv-drop-zone'), csvInput = $('csv-input');
const outputPlaceholder = $('output-placeholder'), quiltContainer = $('quilt-container');
const quiltLegend = $('quilt-legend'), warningsDiv = $('warnings');
const emptyState = $('empty-state'), blockCount = $('block-count');

// --- Helpers ---
function roundQ(v) { return Math.round(v * 4) / 4; }

// Resolve any CSS color string to [r,g,b] using a canvas
const _colorCanvas = document.createElement('canvas');
_colorCanvas.width = _colorCanvas.height = 1;
const _colorCtx = _colorCanvas.getContext('2d');
function colorToRGB(color) {
    _colorCtx.clearRect(0, 0, 1, 1);
    _colorCtx.fillStyle = '#808080'; // reset
    _colorCtx.fillStyle = color;
    _colorCtx.fillRect(0, 0, 1, 1);
    const d = _colorCtx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
}

function textColor(color) {
    try {
        const [r, g, b] = colorToRGB(color);
        const sR = r/255 <= 0.03928 ? r/255/12.92 : Math.pow((r/255+0.055)/1.055, 2.4);
        const sG = g/255 <= 0.03928 ? g/255/12.92 : Math.pow((g/255+0.055)/1.055, 2.4);
        const sB = b/255 <= 0.03928 ? b/255/12.92 : Math.pow((b/255+0.055)/1.055, 2.4);
        const lum = 0.2126*sR + 0.7152*sG + 0.0722*sB;
        return lum > 0.2 ? '#1a1a2e' : '#ffffff';
    } catch(e) { return '#ffffff'; }
}
function uid() { return '_' + Math.random().toString(36).slice(2,9); }


// --- Block Management ---
function addBlock(b) {
    b.id = uid();
    blocks.push(b);
    refreshTable();
}

function removeBlock(id) {
    blocks = blocks.filter(b => b.id !== id);
    refreshTable();
}

function refreshTable() {
    blockTableBody.innerHTML = '';
    blocks.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="color-swatch" style="background:${b.color}"></span></td>
            <td>${b.name}</td>
            <td>${b.minW}</td><td>${b.maxW}</td>
            <td>${b.minH}</td><td>${b.maxH}</td>
            <td><button class="btn-delete-row" data-id="${b.id}" title="Remove">✕</button></td>`;
        blockTableBody.appendChild(tr);
    });
    blockCount.textContent = `(${blocks.length})`;
    emptyState.style.display = blocks.length ? 'none' : 'block';
    genBtn.disabled = blocks.length === 0;
}

// --- Form Handler ---
blockForm.addEventListener('submit', e => {
    e.preventDefault();
    const minW = parseFloat($('block-min-width').value);
    const maxW = parseFloat($('block-max-width').value);
    const minH = parseFloat($('block-min-height').value);
    const maxH = parseFloat($('block-max-height').value);
    if (minW > maxW || minH > maxH) { alert('Min must be ≤ Max'); return; }
    addBlock({
        name: $('block-name').value.trim(),
        color: $('block-color').value,
        minW, maxW, minH, maxH
    });
    blockForm.reset();
    $('block-color').value = '#e74c3c';
    $('block-name').focus();
});

blockTableBody.addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete-row');
    if (btn) removeBlock(btn.dataset.id);
});

$('clear-all-btn').addEventListener('click', () => {
    if (blocks.length && confirm('Remove all blocks?')) { blocks = []; refreshTable(); }
});

// --- CSV ---
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { alert('CSV must have a header row + at least 1 data row'); return; }

    // Parse header — map normalized column names to indices
    const rawHeaders = lines[0].match(/(".*?"|[^,]+)/g) || [];
    const headers = rawHeaders.map(h => h.replace(/^"|"$/g,'').trim().toLowerCase().replace(/[\s_]+/g,''));

    // Find column indices with exact matching against known variants
    function findCol(...variants) {
        return headers.findIndex(h => variants.some(v => h === v));
    }
    const iName   = findCol('name');
    const iColor  = findCol('color');
    const iMinW   = findCol('minwidth', 'minw');
    const iMaxW   = findCol('maxwidth', 'maxw');
    const iMinH   = findCol('minheight', 'minh');
    const iMaxH   = findCol('maxheight', 'maxh');

    if (iName < 0) { alert('CSV header must include a "name" column.'); return; }
    if (iMinW < 0 || iMaxW < 0 || iMinH < 0 || iMaxH < 0) {
        alert('CSV header must include columns for min_width, max_width, min_height, max_height (order does not matter).');
        return;
    }

    let added = 0;
    for (let i = 1; i < lines.length; i++) {
        const clean = lines[i].split(',').map(p => p.replace(/^"|"$/g,'').trim());

        const name = clean[iName];
        if (!name) continue;

        const color = (iColor >= 0 && clean[iColor]) ? clean[iColor] : '#888888';
        const minW = parseFloat(clean[iMinW]);
        const maxW = parseFloat(clean[iMaxW]);
        const minH = parseFloat(clean[iMinH]);
        const maxH = parseFloat(clean[iMaxH]);

        if (isNaN(minW) || isNaN(maxW) || isNaN(minH) || isNaN(maxH)) continue;

        addBlock({ name, color, minW, maxW, minH, maxH });
        added++;
    }

    if (added === 0) alert('No valid blocks found in CSV. Check column names and data.');
}

csvDrop.addEventListener('click', () => csvInput.click());
csvInput.addEventListener('change', e => { if (e.target.files[0]) e.target.files[0].text().then(parseCSV); });
csvDrop.addEventListener('dragover', e => { e.preventDefault(); csvDrop.classList.add('drag-over'); });
csvDrop.addEventListener('dragleave', () => csvDrop.classList.remove('drag-over'));
csvDrop.addEventListener('drop', e => {
    e.preventDefault(); csvDrop.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) e.dataTransfer.files[0].text().then(parseCSV);
});

$('download-sample').addEventListener('click', e => {
    e.preventDefault();
    const csv = `name,color,min_width,max_width,min_height,max_height\n"Grateful Dead 2019",#e74c3c,12,14,10,12\n"Family Reunion",#3498db,10,12,10,12\n"State Champs",#2ecc71,14,16,12,14\n"Band Camp 2020",#9b59b6,10,12,10,12\n"Summer Vacation",#f39c12,12,14,12,14\n"Homecoming",#1abc9c,10,14,10,14\n"Class of 2018",#e67e22,12,16,10,12\n"Fun Run 5K",#e91e63,10,12,10,12`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = 'sample_blocks.csv';
    a.click();
});

// ==========================================
// --- Layout Algorithm ---
// ==========================================

function generateLayout() {
    const tw = parseFloat(quiltW.value), th = parseFloat(quiltH.value);
    const sw = parseFloat(sashingW.value) || 0;
    const maxColorDist = colorDistCB.checked;
    const minSeams = partialSeamsCB.checked;
    const warnings = [];

    if (blocks.length === 0) return null;

    const innerW = tw - 2 * sw;
    const innerH = th - 2 * sw;
    if (innerW <= 0 || innerH <= 0) {
        warnings.push('Sashing is too wide for the quilt dimensions.');
        return { rows: [], warnings, sw, tw, th };
    }

    // Deep copy blocks
    let ordered = blocks.map(b => ({...b}));

    // Determine ideal number of rows based on average block dimensions
    const avgMidW = ordered.reduce((s,b) => s + (b.minW+b.maxW)/2, 0) / ordered.length;
    const avgMidH = ordered.reduce((s,b) => s + (b.minH+b.maxH)/2, 0) / ordered.length;
    const estBlocksPerRow = Math.max(1, Math.round(innerW / (avgMidW + sw)));
    const estNumRows = Math.max(1, Math.ceil(ordered.length / estBlocksPerRow));

    // Target blocks per row (distribute evenly)
    const blocksPerRow = Math.max(1, Math.ceil(ordered.length / estNumRows));

    // Sort / order blocks
    if (maxColorDist) {
        ordered = colorInterleave(ordered);
    } else {
        ordered.sort((a,b) => ((b.minH+b.maxH)/2) - ((a.minH+a.maxH)/2));
    }

    // --- Pack blocks into rows ---
    const rows = [];
    let remaining = [...ordered];

    while (remaining.length > 0) {
        const row = { blocks: [], minH: 0, maxH: Infinity };
        
        // Try to fit blocksPerRow blocks, or fewer if width doesn't allow
        while (row.blocks.length < blocksPerRow && remaining.length > 0) {
            let bestIdx = -1;
            let bestScore = -Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const b = remaining[i];
                // Check height compatibility
                const newMinH = Math.max(row.minH, b.minH);
                const newMaxH = Math.min(row.maxH, b.maxH);
                if (newMinH > newMaxH) continue;

                // Check width feasibility
                const nAfter = row.blocks.length + 1;
                const sashInRow = (nAfter - 1) * sw;
                const minWSum = row.blocks.reduce((s,rb) => s + rb.minW, 0) + b.minW + sashInRow;
                const maxWSum = row.blocks.reduce((s,rb) => s + rb.maxW, 0) + b.maxW + sashInRow;

                // Row must be able to fit within innerW
                if (minWSum > innerW) continue;

                // Score: prefer getting close to innerW at midpoint widths
                const midWSum = row.blocks.reduce((s,rb) => s + (rb.minW+rb.maxW)/2, 0) + (b.minW+b.maxW)/2 + sashInRow;
                let score = -Math.abs(midWSum - innerW);

                // Bonus for being under target (we want to fill but not overflow)
                if (midWSum <= innerW) score += 10;

                // Color distribution: penalize adjacent same color
                if (maxColorDist && row.blocks.length > 0) {
                    const last = row.blocks[row.blocks.length - 1];
                    if (last.color.toLowerCase() === b.color.toLowerCase()) score -= 20;
                }

                if (score > bestScore) { bestScore = score; bestIdx = i; }
            }

            if (bestIdx < 0) break; // No compatible block found
            
            const chosen = remaining.splice(bestIdx, 1)[0];
            row.minH = Math.max(row.minH, chosen.minH);
            row.maxH = Math.min(row.maxH, chosen.maxH);
            row.blocks.push(chosen);

            // Check if row is full width-wise
            const sashInRow = (row.blocks.length - 1) * sw;
            const minWNow = row.blocks.reduce((s,b) => s + b.minW, 0) + sashInRow;
            if (minWNow >= innerW * 0.85) break; // Row is reasonably full
        }

        if (row.blocks.length === 0) {
            // Force-place the first remaining block even if it doesn't fit perfectly
            const b = remaining.shift();
            row.blocks.push(b);
            row.minH = b.minH;
            row.maxH = b.maxH;
        }

        rows.push(row);
    }

    // --- Color distribution between rows ---
    if (maxColorDist) {
        for (let r = 1; r < rows.length; r++) {
            const prev = rows[r-1].blocks;
            const curr = rows[r].blocks;
            for (let i = 0; i < curr.length && i < prev.length; i++) {
                if (curr[i].color.toLowerCase() === prev[i].color.toLowerCase()) {
                    for (let j = i+1; j < curr.length; j++) {
                        if (curr[j].color.toLowerCase() !== prev[i].color.toLowerCase()) {
                            // Check height compatibility before swapping
                            [curr[i], curr[j]] = [curr[j], curr[i]];
                            break;
                        }
                    }
                }
            }
        }
    }

    // --- Assign row heights to fill quilt height ---
    const numRows = rows.length;
    const totalRowSashing = (numRows - 1) * sw;
    const availH = innerH - totalRowSashing;

    // Set initial heights at midpoint of each row's height range
    rows.forEach(r => {
        if (r.maxH === Infinity) r.maxH = availH; // unconstrained
        r.height = (r.minH + r.maxH) / 2;
    });

    // Scale heights to fill available height
    const totalInitH = rows.reduce((s,r) => s + r.height, 0);
    if (totalInitH > 0) {
        const hScale = availH / totalInitH;
        rows.forEach(r => {
            r.height = Math.max(r.minH, Math.min(r.maxH, r.height * hScale));
        });
    }

    // Iteratively distribute remaining height
    for (let iter = 0; iter < 10; iter++) {
        const currTotal = rows.reduce((s,r) => s + r.height, 0);
        const diff = availH - currTotal;
        if (Math.abs(diff) < 0.2) break;

        const perRow = diff / numRows;
        rows.forEach(r => {
            const newH = r.height + perRow;
            r.height = Math.max(r.minH, Math.min(r.maxH, newH));
        });
    }

    // Final round to quarter inch
    rows.forEach(r => { r.height = roundQ(r.height); });

    // --- Assign block widths in each row ---
    rows.forEach(row => {
        recalculateRowWidths(row, innerW, sw);

        // Warn on constraint violations
        row.blocks.forEach(b => {
            if (b.width < b.minW - 0.3 || b.width > b.maxW + 0.3)
                warnings.push(`"${b.name}" width ${b.width}" is outside its ${b.minW}"-${b.maxW}" range.`);
            if (b.height < b.minH - 0.3 || b.height > b.maxH + 0.3)
                warnings.push(`"${b.name}" height ${b.height}" is outside its ${b.minH}"-${b.maxH}" range.`);
        });
    });

    // --- Compute positions ---
    let y = sw;
    rows.forEach(row => {
        let x = sw + (row.xOffset || 0);
        row.blocks.forEach(b => {
            b.x = x;
            b.y = y;
            x += b.width + sw;
        });
        row.yPos = y;
        y += row.height + sw;
    });

    // Check if total height matches target
    const actualH = y - sw + sw; // last y + border
    if (Math.abs(actualH - (th - sw)) > 1) {
        warnings.push(`Layout height (${roundQ(y + sw)}") differs from target (${th}"). Consider adjusting block sizes.`);
    }

    // Assign sequential numbers for legend and display
    let num = 1;
    rows.forEach(r => {
        r.blocks.forEach(b => {
            b.num = num++;
        });
    });

    return { rows, warnings, sw, tw, th };
}

function recalculateRowWidths(row, innerW, sw) {
    const n = row.blocks.length;
    const sashInRow = (n - 1) * sw;
    const availW = innerW - sashInRow;

    if (n === 0) return;

    const maxPossibleW = row.blocks.reduce((s,b) => s + b.maxW, 0);
    const minPossibleW = row.blocks.reduce((s,b) => s + b.minW, 0);
    const canFill = maxPossibleW >= availW;
    const targetW = canFill ? availW : maxPossibleW;

    row.blocks.forEach(b => { b.calcW = (b.minW + b.maxW) / 2; });

    for (let iter = 0; iter < 20; iter++) {
        const total = row.blocks.reduce((s,b) => s + b.calcW, 0);
        if (Math.abs(total - targetW) < 0.1) break;

        const scale = targetW / total;
        let clamped = 0, clampedW = 0, freeTotal = 0;

        row.blocks.forEach(b => {
            const scaled = b.calcW * scale;
            if (scaled <= b.minW) { b.calcW = b.minW; clamped++; clampedW += b.minW; }
            else if (scaled >= b.maxW) { b.calcW = b.maxW; clamped++; clampedW += b.maxW; }
            else { b.calcW = scaled; freeTotal += scaled; }
        });

        if (clamped === n) break;

        if (freeTotal > 0 && clamped > 0) {
            const remainW = targetW - clampedW;
            if (remainW > 0) {
                const freeScale = remainW / freeTotal;
                row.blocks.forEach(b => {
                    if (b.calcW > b.minW && b.calcW < b.maxW) {
                        b.calcW = Math.min(b.maxW, Math.max(b.minW, b.calcW * freeScale));
                    }
                });
            }
        }
    }

    const actualTotalW = row.blocks.reduce((s,b) => s + b.calcW, 0);
    row.xOffset = canFill ? 0 : (availW - actualTotalW) / 2;

    row.blocks.forEach(b => {
        b.width = roundQ(b.calcW);
        b.height = row.height;
        delete b.calcW;
    });
}

function colorInterleave(blockList) {
    const groups = {};
    blockList.forEach(b => {
        const c = b.color.toLowerCase();
        if (!groups[c]) groups[c] = [];
        groups[c].push(b);
    });
    const sorted = Object.values(groups).sort((a,b) => b.length - a.length);
    const result = [];
    let idx = 0;
    while (result.length < blockList.length) {
        let added = false;
        for (const g of sorted) {
            if (idx < g.length) { result.push(g[idx]); added = true; }
        }
        if (!added) break;
        idx++;
    }
    return result;
}

// ==========================================
// --- Rendering ---
// ==========================================

function renderQuilt(layout) {
    if (!layout || !layout.rows.length) {
        quiltContainer.style.display = 'none';
        quiltLegend.style.display = 'none';
        outputPlaceholder.style.display = 'block';
        return;
    }
    outputPlaceholder.style.display = 'none';
    quiltContainer.style.display = 'block';
    quiltLegend.style.display = 'flex';
    exportBtn.disabled = false;

    const { tw, th, sw, rows } = layout;

    // Remove old scale indicators
    const oldScales = quiltContainer.parentElement.querySelectorAll('.quilt-scale');
    oldScales.forEach(el => el.remove());

    const maxPx = Math.min(quiltContainer.parentElement.clientWidth - 48, 800);
    const scale = maxPx / Math.max(tw, th);

    quiltContainer.style.width = Math.round(tw * scale) + 'px';
    quiltContainer.style.height = Math.round(th * scale) + 'px';
    quiltContainer.innerHTML = '';

    // Sashing background
    if (sw > 0) {
        const bg = document.createElement('div');
        bg.className = 'quilt-sashing-bg';
        quiltContainer.appendChild(bg);
    } else {
        quiltContainer.style.background = '#e8e8e8';
    }

    // Blocks
    rows.forEach(row => {
        row.blocks.forEach(b => {
            const div = document.createElement('div');
            div.className = 'quilt-block';
            div.style.left = Math.round(b.x * scale) + 'px';
            div.style.top = Math.round(b.y * scale) + 'px';
            div.style.width = Math.round(b.width * scale) + 'px';
            div.style.height = Math.round(b.height * scale) + 'px';
            div.style.background = b.color;
            div.style.color = textColor(b.color);

            const numEl = document.createElement('div');
            numEl.className = 'quilt-block-num';
            numEl.textContent = b.num;

            div.appendChild(numEl);
            div.title = `${b.num}. ${b.name}\n${fmtDim(b.width)}" W × ${fmtDim(b.height)}" H`;
            
            // Drag to Swap
            div.draggable = true;
            div.dataset.bId = b.id; // use block id for swapping lookup
            div.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', b.id);
                e.dataTransfer.effectAllowed = 'move';
                div.style.opacity = '0.5';
                document.body.classList.add('is-dragging-block');
            });
            div.addEventListener('dragend', () => {
                div.style.opacity = '1';
                document.body.classList.remove('is-dragging-block');
            });
            div.addEventListener('dragover', e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const rect = div.getBoundingClientRect();
                const dropX = e.clientX - rect.left;
                const edgeThreshold = rect.width * 0.25;
                
                div.classList.remove('drag-insert-before', 'drag-insert-after', 'drag-swap');
                if (dropX < edgeThreshold) {
                    div.classList.add('drag-insert-before');
                } else if (dropX > rect.width - edgeThreshold) {
                    div.classList.add('drag-insert-after');
                } else {
                    div.classList.add('drag-swap');
                }
            });
            div.addEventListener('dragleave', () => {
                div.classList.remove('drag-insert-before', 'drag-insert-after', 'drag-swap');
            });
            div.addEventListener('drop', e => {
                e.preventDefault();
                e.stopPropagation(); // Fix deletion bug
                div.classList.remove('drag-insert-before', 'drag-insert-after', 'drag-swap');
                
                const sourceId = e.dataTransfer.getData('text/plain');
                if (!sourceId || sourceId === b.id) return;
                
                const rect = div.getBoundingClientRect();
                const dropX = e.clientX - rect.left;
                const edgeThreshold = rect.width * 0.25;
                
                if (dropX < edgeThreshold) {
                    insertBlock(sourceId, b.id, 'before');
                } else if (dropX > rect.width - edgeThreshold) {
                    insertBlock(sourceId, b.id, 'after');
                } else {
                    swapBlocks(sourceId, b.id);
                }
            });

            // Drag to Scale
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            handle.draggable = false; // prevent drag-to-swap from firing
            div.appendChild(handle);

            handle.addEventListener('pointerdown', e => {
                e.preventDefault();
                e.stopPropagation();
                
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = b.width;
                const startH = b.height;

                function onPointerMove(ev) {
                    const dx = (ev.clientX - startX) / scale;
                    const dy = (ev.clientY - startY) / scale;
                    
                    b.width = Math.min(b.maxW, Math.max(b.minW, startW + dx));
                    b.height = Math.min(b.maxH, Math.max(b.minH, startH + dy));
                    
                    // Live update visually
                    div.style.width = Math.round(b.width * scale) + 'px';
                    div.style.height = Math.round(b.height * scale) + 'px';
                    div.title = `${b.num}. ${b.name}\n${fmtDim(b.width)}" W × ${fmtDim(b.height)}" H`;
                    // Note: Since independent row heights are allowed, we don't recalculate row height.
                    // And we leave auto-scaling widths only for *swapping*.
                }

                function onPointerUp() {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    updateQuiltPositions();
                }

                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
            });

            // Rotate Handle (only for skewed blocks)
            const isSkewed = Math.max(b.maxW / b.maxH, b.maxH / b.maxW) > 1.3;
            if (isSkewed) {
                const rotHandle = document.createElement('div');
                rotHandle.className = 'rotate-handle';
                rotHandle.innerHTML = '&#8635;'; // clockwise arrow
                rotHandle.title = "Rotate 90°";
                rotHandle.draggable = false;
                div.appendChild(rotHandle);

                rotHandle.addEventListener('pointerdown', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Swap constraints and current dimensions
                    const tempMinW = b.minW; const tempMaxW = b.maxW;
                    b.minW = b.minH; b.maxW = b.maxH;
                    b.minH = tempMinW; b.maxH = tempMaxW;
                    
                    const tempW = b.width;
                    b.width = b.height;
                    b.height = tempW;
                    
                    // Find the row and recalculate widths
                    let rIdx = -1;
                    layout.rows.forEach((row, ri) => {
                        if (row.blocks.includes(b)) rIdx = ri;
                    });
                    
                    if (rIdx > -1) {
                        const { tw, sw } = layout;
                        const innerW = tw - 2 * sw;
                        recalculateRowWidths(layout.rows[rIdx], innerW, sw);
                        updateQuiltPositions();
                    }
                });
            }

            quiltContainer.appendChild(div);
        });
    });

    // Scale indicator
    const scaleDiv = document.createElement('div');
    scaleDiv.className = 'quilt-scale';
    scaleDiv.textContent = `Scale: 1" ≈ ${scale.toFixed(1)}px | Quilt: ${fmtDim(tw)}" × ${fmtDim(th)}"`;
    quiltContainer.parentElement.appendChild(scaleDiv);

    // Legend
    renderLegend(layout);

    // Warnings
    warningsDiv.innerHTML = '';
    layout.warnings.forEach(w => {
        const div = document.createElement('div');
        div.className = 'warning-item';
        div.textContent = w;
        warningsDiv.appendChild(div);
    });
}

function renderLegend(layout) {
    quiltLegend.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'legend-list';
    
    // Sort blocks by number to ensure correct order
    const allBlocks = [];
    layout.rows.forEach(r => r.blocks.forEach(b => allBlocks.push(b)));
    allBlocks.sort((a,b) => a.num - b.num);

    allBlocks.forEach(b => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<span class="legend-swatch" style="background:${b.color}"></span><b>${b.num}.</b> ${b.name} <span class="legend-dims">(${fmtDim(b.width)}" × ${fmtDim(b.height)}")</span>`;
        list.appendChild(item);
    });
    quiltLegend.appendChild(list);
}

function fmtDim(v) {
    const whole = Math.floor(v);
    const frac = roundQ(v) - whole;
    if (Math.abs(frac) < 0.1) return '' + whole;
    if (Math.abs(frac - 0.25) < 0.1) return whole + ' ¼';
    if (Math.abs(frac - 0.5) < 0.1) return whole + ' ½';
    if (Math.abs(frac - 0.75) < 0.1) return whole + ' ¾';
    return '' + Math.round(v);
}

// ==========================================
// --- Generate Button ---
// ==========================================

genBtn.addEventListener('click', () => {
    unplacedBlocks = [];
    layoutResult = generateLayout();
    renderQuilt(layoutResult);
    if (layoutResult && layoutResult.rows.length) {
        document.querySelector('.output-column').scrollIntoView({ behavior: 'smooth' });
    }
});

// ==========================================
// --- PDF Export ---
// ==========================================

exportBtn.addEventListener('click', () => {
    if (!layoutResult) return;
    const { jsPDF } = window.jspdf;
    const { tw, th, sw, rows } = layoutResult;

    const landscape = tw > th;
    const doc = new jsPDF({ orientation: landscape ? 'l' : 'p', unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('T-Shirt Quilt Layout', pageW / 2, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Quilt: ${fmtDim(tw)}" W × ${fmtDim(th)}" H | Sashing: ${fmtDim(sw)}"`, pageW / 2, 46, { align: 'center' });

    // Scale to fit page
    const margin = 50;
    const drawW = pageW - 2 * margin;
    const drawH = pageH - margin - 70;
    const scale = Math.min(drawW / tw, drawH / th);
    const qw = tw * scale, qh = th * scale;
    const ox = (pageW - qw) / 2, oy = 60;

    // Draw sashing background
    if (sw > 0) {
        doc.setFillColor(232, 232, 232);
        doc.rect(ox, oy, qw, qh, 'F');
        // Crosshatch lines
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        const step = 4;
        doc.saveGraphicsState();
        doc.rect(ox, oy, qw, qh);
        doc.clip();
        for (let i = -qh; i < qw + qh; i += step) {
            doc.line(ox + i, oy, ox + i + qh, oy + qh);
            doc.line(ox + i, oy + qh, ox + i + qh, oy);
        }
        doc.restoreGraphicsState();
    } else {
        doc.setFillColor(232, 232, 232);
        doc.rect(ox, oy, qw, qh, 'F');
    }

    // Draw blocks
    rows.forEach(row => {
        row.blocks.forEach(b => {
            const bx = ox + b.x * scale;
            const by = oy + b.y * scale;
            const bw = b.width * scale;
            const bh = b.height * scale;

            const [cr, cg, cb] = colorToRGB(b.color);
            doc.setFillColor(cr, cg, cb);
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);
            doc.rect(bx, by, bw, bh, 'FD');

            const tc = textColor(b.color);
            const rgb = tc === '#ffffff' ? [255,255,255] : [26,26,46];
            doc.setTextColor(...rgb);

            doc.setFont('helvetica', 'bold');
            // Scale font size based on block size, max 24pt
            const fontSize = Math.min(24, Math.min(bw, bh) * 0.5);
            doc.setFontSize(Math.max(8, fontSize));
            doc.text(b.num.toString(), bx + bw/2, by + bh/2 + (fontSize * 0.35), { align: 'center' });
        });
    });

    // Outline
    doc.setDrawColor(60);
    doc.setLineWidth(1);
    doc.rect(ox, oy, qw, qh, 'S');

    // Draw Legend on PDF
    doc.addPage();
    doc.setTextColor(0, 0, 0); // Reset text color to black
    doc.setFontSize(14);
    doc.text('Quilt Legend', margin, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Sort blocks for legend
    const allBlocks = [];
    rows.forEach(r => r.blocks.forEach(b => allBlocks.push(b)));
    allBlocks.sort((a,b) => a.num - b.num);

    let legY = 80;
    allBlocks.forEach(b => {
        if (legY > pageH - margin) {
            doc.addPage();
            legY = 50;
        }
        const [cr, cg, cb] = colorToRGB(b.color);
        doc.setFillColor(cr, cg, cb);
        doc.setDrawColor(0);
        doc.rect(margin, legY - 8, 10, 10, 'FD');
        
        doc.setTextColor(0, 0, 0); // Ensure black text for legend items
        doc.text(`${b.num}. ${b.name} (${fmtDim(b.width)}" × ${fmtDim(b.height)}")`, margin + 20, legY);
        legY += 20;
    });

    doc.save('quilt-layout.pdf');
});

// --- Swap, Insert & Position Updates ---
function swapBlocks(sourceId, targetId) {
    if (!layoutResult) return;
    let sR = -1, sB = -1, sourceBlock = null, inStash = false;
    
    // Find source
    layoutResult.rows.forEach((row, ri) => {
        row.blocks.forEach((b, bi) => {
            if (b.id === sourceId) { sR = ri; sB = bi; sourceBlock = b; }
        });
    });
    
    if (!sourceBlock) {
        const stashIdx = unplacedBlocks.findIndex(b => b.id === sourceId);
        if (stashIdx > -1) {
            sourceBlock = unplacedBlocks[stashIdx];
            unplacedBlocks.splice(stashIdx, 1);
            inStash = true;
        }
    }
    
    if (!sourceBlock) return;

    let tR = -1, tB = -1, targetBlock = null;
    layoutResult.rows.forEach((row, ri) => {
        row.blocks.forEach((b, bi) => {
            if (b.id === targetId) { tR = ri; tB = bi; targetBlock = b; }
        });
    });

    if (tR > -1) {
        if (inStash) {
            layoutResult.rows[tR].blocks[tB] = sourceBlock;
            unplacedBlocks.push(targetBlock);
        } else if (sR > -1) {
            const tmp = layoutResult.rows[sR].blocks[sB];
            layoutResult.rows[sR].blocks[sB] = layoutResult.rows[tR].blocks[tB];
            layoutResult.rows[tR].blocks[tB] = tmp;
        }

        // Auto-scale row widths for affected rows
        const { tw, sw } = layoutResult;
        const innerW = tw - 2 * sw;
        if (sR > -1) recalculateRowWidths(layoutResult.rows[sR], innerW, sw);
        if (sR !== tR) recalculateRowWidths(layoutResult.rows[tR], innerW, sw);

        updateQuiltPositions();
    }
}

function insertBlock(sourceId, targetId, pos) {
    if (!layoutResult) return;
    
    let sR = -1, sB = -1, sourceBlock = null;
    
    layoutResult.rows.forEach((row, ri) => {
        row.blocks.forEach((b, bi) => {
            if (b.id === sourceId) { sR = ri; sB = bi; sourceBlock = b; }
        });
    });
    
    if (!sourceBlock) {
        const stashIdx = unplacedBlocks.findIndex(b => b.id === sourceId);
        if (stashIdx > -1) {
            sourceBlock = unplacedBlocks[stashIdx];
            unplacedBlocks.splice(stashIdx, 1);
        }
    } else {
        layoutResult.rows[sR].blocks.splice(sB, 1);
    }
    
    if (!sourceBlock) return;
    
    let tR = -1, tB = -1;
    layoutResult.rows.forEach((row, ri) => {
        row.blocks.forEach((b, bi) => {
            if (b.id === targetId) { tR = ri; tB = bi; }
        });
    });
    
    if (tR > -1) {
        const insertIdx = (pos === 'before') ? tB : tB + 1;
        layoutResult.rows[tR].blocks.splice(insertIdx, 0, sourceBlock);
        
        const { tw, sw } = layoutResult;
        const innerW = tw - 2 * sw;
        if (sR > -1) recalculateRowWidths(layoutResult.rows[sR], innerW, sw);
        if (sR !== tR) recalculateRowWidths(layoutResult.rows[tR], innerW, sw);
        
        updateQuiltPositions();
    } else if (sR > -1) {
        // If target wasn't found (shouldn't happen), revert source removal
        layoutResult.rows[sR].blocks.splice(sB, 0, sourceBlock);
    }
}

function removeBlockFromLayout(id) {
    if (!layoutResult) return;
    
    let targetR = -1;
    let targetB = -1;
    let blockToRemove = null;
    layoutResult.rows.forEach((row, ri) => {
        row.blocks.forEach((b, bi) => {
            if (b.id === id) { targetR = ri; targetB = bi; blockToRemove = b; }
        });
    });

    if (targetR > -1) {
        // Remove from layout and add to stash
        layoutResult.rows[targetR].blocks.splice(targetB, 1);
        unplacedBlocks.push(blockToRemove);
        
        // Update layout widths
        const { tw, sw } = layoutResult;
        const innerW = tw - 2 * sw;
        recalculateRowWidths(layoutResult.rows[targetR], innerW, sw);
        updateQuiltPositions();
    }
}

// Allow dragging off the quilt to remove
document.body.addEventListener('dragover', e => {
    if (document.body.classList.contains('is-dragging-block')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
});

document.body.addEventListener('drop', e => {
    if (document.body.classList.contains('is-dragging-block')) {
        const isQuiltDrop = e.target.closest('.quilt-container');
        if (!isQuiltDrop) {
            e.preventDefault();
            const sourceId = e.dataTransfer.getData('text/plain');
            if (sourceId) {
                removeBlockFromLayout(sourceId);
            }
        }
    }
});

function updateQuiltPositions() {
    if (!layoutResult) return;
    const { sw, rows, tw, th } = layoutResult;

    // Recompute positions based on current block sizes
    let y = sw;
    rows.forEach(row => {
        // Find row's actual height (max block height)
        const actualRowH = Math.max(...row.blocks.map(b => b.height));
        row.height = actualRowH || row.height; // fall back to layout height if empty

        let x = sw + (row.xOffset || 0);
        row.blocks.forEach(b => {
            b.x = x;
            b.y = y;
            x += b.width + sw;
        });
        row.yPos = y;
        y += row.height + sw;
    });

    // Re-render
    renderQuilt(layoutResult);
    renderStash();
}

function renderStash() {
    const stashDiv = document.getElementById('stash-container');
    const stashList = document.getElementById('stash-list');
    
    if (unplacedBlocks.length === 0) {
        stashDiv.style.display = 'none';
        return;
    }
    
    stashDiv.style.display = 'block';
    stashList.innerHTML = '';
    
    unplacedBlocks.forEach(b => {
        const div = document.createElement('div');
        div.className = 'stash-block';
        div.style.borderLeft = `12px solid ${b.color}`;
        div.innerHTML = `<strong>${b.num || '?'}</strong> <span style="flex:1;">${b.name}</span> <small>(${fmtDim(b.width)}" &times; ${fmtDim(b.height)}")</small>`;
        
        div.draggable = true;
        div.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', b.id);
            e.dataTransfer.effectAllowed = 'move';
            div.style.opacity = '0.5';
            document.body.classList.add('is-dragging-block');
        });
        div.addEventListener('dragend', () => {
            div.style.opacity = '1';
            document.body.classList.remove('is-dragging-block');
        });
        
        stashList.appendChild(div);
    });
}

// --- Init ---
refreshTable();

// Trash Zone visual indicator
const trashZone = document.createElement('div');
trashZone.className = 'trash-zone';
trashZone.innerHTML = '&#10060; Drop here to remove block';
document.body.appendChild(trashZone);
