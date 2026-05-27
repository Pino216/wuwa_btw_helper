const size = 7;
const STORAGE_KEY = 'MC_EVENT_HELPER_V1.2_MOBILE';
const STORAGE_KEY_HISTORY = 'MC_EVENT_HELPER_HISTORY_V1';
const defaultData = {
    grid: Array(size * size).fill(false),
    probs: [50, 11, 11, 5, 13, 9, 1],
    clicks: 0,
    enablePity: true,
    pityStart: 3,
    pityMax: 5,
    currentMisses: 0,
    currentAlgorithm: 'greedy',
    heuristicWeight: 1.0,
    autoWeight: true,
    mctsIterations: 300,
    mctsStable: true,
    comprehensiveAlgorithms: {
        greedy: true,
        heuristic: true,
        entropy: true,
        mcts: false
    }
};

let state = loadState();
let activePos = { r: -1, c: -1 };
let historyLog = [];

// 持久化历史记录的辅助函数
function loadHistory() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch(e) {
        // ignore
    }
    return [];
}

function saveHistory() {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyLog));
}

// --- 适配与折叠逻辑 ---
function toggleConfig() {
    const panel = document.getElementById('configPanel');
    const btn = document.getElementById('toggleBtn');
    const isMobile = window.innerWidth <= 768;

    panel.classList.toggle('collapsed');

    if (panel.classList.contains('collapsed')) {
        // 折叠状态
        if (isMobile) {
            btn.innerHTML = '🔽 显示设置';
        } else {
            btn.innerHTML = '▶';
        }
    } else {
        // 展开状态
        if (isMobile) {
            btn.innerHTML = '🔼 隐藏设置';
        } else {
            btn.innerHTML = '◀';
        }
    }
    
    // 在移动端，滚动到顶部以便看到网格
    if (isMobile && !panel.classList.contains('collapsed')) {
        setTimeout(() => {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        return JSON.parse(JSON.stringify(defaultData));
    }
    
    try {
        const loaded = JSON.parse(saved);
        // 确保所有字段都存在，使用默认值填充缺失字段
        const result = {
            ...JSON.parse(JSON.stringify(defaultData)),
            ...loaded
        };
        
        // 确保数组是新的引用
        result.grid = Array.isArray(loaded.grid) ? [...loaded.grid] : [...defaultData.grid];
        result.probs = Array.isArray(loaded.probs) ? [...loaded.probs] : [...defaultData.probs];
        
        // 确保数值字段正确
        result.clicks = Number.isInteger(loaded.clicks) ? loaded.clicks : defaultData.clicks;
        result.enablePity = typeof loaded.enablePity === 'boolean' ? loaded.enablePity : defaultData.enablePity;
        result.pityStart = Number.isInteger(loaded.pityStart) ? loaded.pityStart : defaultData.pityStart;
        result.pityMax = Number.isInteger(loaded.pityMax) ? loaded.pityMax : defaultData.pityMax;
        result.currentMisses = Number.isInteger(loaded.currentMisses) ? loaded.currentMisses : defaultData.currentMisses;
        // 处理算法标识符的转换：将'weighted'转换为'heuristic'
        let loadedAlgorithm = typeof loaded.currentAlgorithm === 'string' ? loaded.currentAlgorithm : defaultData.currentAlgorithm;
        if (loadedAlgorithm === 'weighted') {
            loadedAlgorithm = 'heuristic';
        }
        result.currentAlgorithm = loadedAlgorithm;
        result.heuristicWeight = typeof loaded.heuristicWeight === 'number' ? loaded.heuristicWeight : defaultData.heuristicWeight;
        result.autoAlgorithm = typeof loaded.autoAlgorithm === 'boolean' ? loaded.autoAlgorithm : defaultData.autoAlgorithm;
        result.autoWeight = typeof loaded.autoWeight === 'boolean' ? loaded.autoWeight : defaultData.autoWeight;
        
        // 确保grid长度正确
        if (result.grid.length !== 49) {
            result.grid = Array(49).fill(false);
        }
        
        return result;
    } catch (e) {
        console.error('加载状态失败，使用默认值:', e);
        return JSON.parse(JSON.stringify(defaultData));
    }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function init() {
    // 确保状态正确加载
    state = loadState();
    historyLog = loadHistory();
    
    // 渲染输入框
    const probContainer = document.getElementById('probInputs');
    probContainer.innerHTML = '';
    const labels = ["仅当前 📍", "同列 ↕️", "同行 ↔️", "同行同列 ➕", "十字 💠", "九宫格 🍷", "全开 🌟"];

    labels.forEach((label, i) => {
        const div = document.createElement('div');
        div.className = 'prob-input-group';
        div.innerHTML = `<label>${label}</label><input type="number" id="p${i}" value="${state.probs[i]}" onchange="updateProbs(${i}, this.value)" min="0" max="100">`;
        probContainer.appendChild(div);
    });

    // 渲染保底配置
    document.getElementById('enablePity').checked = state.enablePity;
    document.getElementById('pityStart').value = state.pityStart;
    document.getElementById('pityMax').value = state.pityMax;
    document.getElementById('currentMissesDisplay').textContent = state.currentMisses;
    
    // 渲染算法选择
    document.getElementById('algorithmSelect').value = state.currentAlgorithm;
    document.getElementById('heuristicWeight').value = state.heuristicWeight;
    document.getElementById('autoWeight').checked = state.autoWeight;
    document.getElementById('mctsIterations').value = state.mctsIterations || 300;
    document.getElementById('mctsStable').checked = state.mctsStable !== false;
    
    // 初始化综合推荐算法选择
    if (!state.comprehensiveAlgorithms) {
        state.comprehensiveAlgorithms = {
            greedy: true,
            heuristic: true,
            entropy: true,
            mcts: false
        };
    }
    document.getElementById('compGreedy').checked = state.comprehensiveAlgorithms.greedy;
    document.getElementById('compHeuristic').checked = state.comprehensiveAlgorithms.heuristic;
    document.getElementById('compEntropy').checked = state.comprehensiveAlgorithms.entropy;
    document.getElementById('compMCTS').checked = state.comprehensiveAlgorithms.mcts || false;
    
    // 根据算法显示/隐藏参数组
    const weightGroup = document.getElementById('weightParamGroup');
    const comprehensiveGroup = document.getElementById('comprehensiveParamGroup');
    const mctsGroup = document.getElementById('mctsParamGroup');
    const weightHelp = document.getElementById('weightHelp');
    
    if (state.currentAlgorithm === 'heuristic') {
        weightGroup.style.display = 'flex';
        comprehensiveGroup.style.display = 'none';
        mctsGroup.style.display = 'none';
        weightHelp.style.display = 'block';
    } else if (state.currentAlgorithm === 'comprehensive') {
        weightGroup.style.display = 'none';
        comprehensiveGroup.style.display = 'block';
        mctsGroup.style.display = 'none';
        weightHelp.style.display = 'none';
    } else if (state.currentAlgorithm === 'mcts' || state.currentAlgorithm === 'fastMCTS') {
        weightGroup.style.display = 'none';
        comprehensiveGroup.style.display = 'none';
        mctsGroup.style.display = 'block';
        weightHelp.style.display = 'none';
    } else {
        weightGroup.style.display = 'none';
        comprehensiveGroup.style.display = 'none';
        mctsGroup.style.display = 'none';
        weightHelp.style.display = 'none';
    }

    // 渲染网格
    const gridEl = document.getElementById('grid');
    gridEl.innerHTML = '';
    for (let i = 0; i < 49; i++) {
        const r = Math.floor(i / 7), c = i % 7;
        const cell = document.createElement('div');
        cell.className = 'cell' + (state.grid[i] ? ' opened' : '');
        cell.id = `cell-${i}`;
        cell.innerHTML = `<span class="coord">${r+1},${c+1}</span><span class="score" id="s-${i}">0</span>`;
        cell.onclick = (e) => showMenu(r, c, e);
        gridEl.appendChild(cell);
    }

    // 渲染菜单按钮
    const menuBtns = document.getElementById('menuButtons');
    menuBtns.innerHTML = '';
    labels.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.className = 'menu-btn';
        btn.innerText = label;
        btn.onclick = () => applyEvent(i + 1);
        menuBtns.appendChild(btn);
    });
    
    // 初始化折叠按钮状态
    const isMobile = window.innerWidth <= 768;
    const btn = document.getElementById('toggleBtn');
    const panel = document.getElementById('configPanel');
    
    if (isMobile) {
        // 移动端默认折叠配置面板，以提供更多空间给网格
        panel.classList.add('collapsed');
        btn.innerHTML = '🔽 显示设置';
    } else {
        btn.innerHTML = '◀';
    }
    
    // 初始化可折叠模块
    initSectionToggles();
    
    updateAnalysis();
    updateLogDisplay();
    
    // 监听窗口大小变化，调整折叠状态
    window.addEventListener('resize', function() {
        const isMobileNow = window.innerWidth <= 768;
        const panel = document.getElementById('configPanel');
        const btn = document.getElementById('toggleBtn');
        
        if (isMobileNow) {
            // 在移动端，确保按钮显示正确
            if (panel.classList.contains('collapsed')) {
                btn.innerHTML = '🔽 显示设置';
            } else {
                btn.innerHTML = '🔼 隐藏设置';
            }
        } else {
            // 在桌面端
            if (panel.classList.contains('collapsed')) {
                btn.innerHTML = '▶';
            } else {
                btn.innerHTML = '◀';
            }
        }
    });
}

// 初始化可折叠模块
function initSectionToggles() {
    document.querySelectorAll('.section-header').forEach(header => {
        // 算法选择模块始终展开，不添加点击事件
        if (header.closest('.algorithm-section')) return;
        
        header.addEventListener('click', function() {
            const content = this.nextElementSibling;
            content.classList.toggle('expanded');
            const icon = this.querySelector('.toggle-icon');
            icon.textContent = content.classList.contains('expanded') ? '▼' : '▶';
        });
    });
}

// --- 音效系统 ---
function playEffect(type) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = (f, s, d, w='sine') => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = w; o.frequency.setValueAtTime(f, s);
        g.gain.setValueAtTime(0.08, s); g.gain.exponentialRampToValueAtTime(0.0001, s + d);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(s); o.stop(s + d);
    };
    if(type === 1) osc(880, now, 0.1);
    else if(type === 7) [523, 659, 783, 1046].forEach((f, i) => osc(f, now + i*0.1, 0.5));
    else osc(587, now, 0.15, 'triangle');
}

// --- 逻辑处理 ---
function updateProbs(i, val) { state.probs[i] = parseInt(val) || 0; updateAnalysis(); }
function updatePityEnable(checked) { state.enablePity = checked; updateAnalysis(); }
function updatePityStart(val) { state.pityStart = parseInt(val) || 3; updateAnalysis(); }
function updatePityMax(val) { state.pityMax = parseInt(val) || 5; updateAnalysis(); }
function updateAlgorithm(val) {
    state.currentAlgorithm = val;
    
    const weightGroup = document.getElementById('weightParamGroup');
    const autoWeightGroup = document.getElementById('autoWeightGroup');
    const comprehensiveGroup = document.getElementById('comprehensiveParamGroup');
    const mctsGroup = document.getElementById('mctsParamGroup');
    const weightHelp = document.getElementById('weightHelp');
    
    if (val === 'heuristic') {
        weightGroup.style.display = 'flex';
        autoWeightGroup.style.display = 'flex';
        comprehensiveGroup.style.display = 'none';
        mctsGroup.style.display = 'none';
        weightHelp.style.display = 'block';
    } else if (val === 'comprehensive') {
        weightGroup.style.display = 'none';
        autoWeightGroup.style.display = 'none';
        comprehensiveGroup.style.display = 'block';
        mctsGroup.style.display = 'none';
        weightHelp.style.display = 'none';
    } else if (val === 'mcts' || val === 'fastMCTS') {
        weightGroup.style.display = 'none';
        autoWeightGroup.style.display = 'none';
        comprehensiveGroup.style.display = 'none';
        mctsGroup.style.display = 'block';
        weightHelp.style.display = 'none';
    } else {
        weightGroup.style.display = 'none';
        autoWeightGroup.style.display = 'none';
        comprehensiveGroup.style.display = 'none';
        mctsGroup.style.display = 'none';
        weightHelp.style.display = 'none';
    }
    updateAnalysis();
}

function updateHeuristicWeight(val) {
    // 如果自动调整开启，提示用户
    if (state.autoWeight && state.currentAlgorithm === 'heuristic') {
        if (confirm('权重自动调整已开启，手动修改权重将关闭自动调整。是否继续？')) {
            state.autoWeight = false;
            document.getElementById('autoWeight').checked = false;
            state.heuristicWeight = parseFloat(val) || 1.0;
        } else {
            // 恢复原来的值
            document.getElementById('heuristicWeight').value = state.heuristicWeight.toFixed(1);
            return;
        }
    } else {
        state.heuristicWeight = parseFloat(val) || 1.0;
    }
    updateAnalysis();
}

function toggleAutoWeight(checked) {
    state.autoWeight = checked;
    updateAnalysis();
}

function updateComprehensiveAlgorithms() {
    // 保存选择的算法到state
    state.comprehensiveAlgorithms = {
        greedy: document.getElementById('compGreedy').checked,
        heuristic: document.getElementById('compHeuristic').checked,
        entropy: document.getElementById('compEntropy').checked,
        mcts: document.getElementById('compMCTS').checked
    };
    updateAnalysis();
}

function updateMCTSIterations(val) {
    state.mctsIterations = parseInt(val) || 300;
    updateAnalysis();
}

function updateMCTSStable(checked) {
    state.mctsStable = checked;
    updateAnalysis();
}

function showMenu(r, c, e) {
    if (state.grid[r * 7 + c]) return;
    activePos = { r, c };
    const menu = document.getElementById('menu');
    menu.style.display = 'block';
    
    // 获取点击位置
    const clickX = e.clientX || e.pageX;
    const clickY = e.clientY || e.pageY;
    
    // 菜单尺寸
    const menuWidth = 200;
    const menuHeight = 300;
    
    // 计算位置，确保在视口内
    let left = clickX;
    let top = clickY;
    
    // 检查右边界
    if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
    }
    // 检查下边界
    if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 10;
    }
    // 确保不小于0
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

function closeMenu() { document.getElementById('menu').style.display = 'none'; }

function applyEvent(type) {
    // 记录操作日志
    const logEntry = {
        step: state.clicks + 1,
        type: type,
        row: activePos.r,
        col: activePos.c,
        currentMissesBefore: state.currentMisses,
        probs: [...state.probs],
        enablePity: state.enablePity,
        pityStart: state.pityStart,
        pityMax: state.pityMax,
        grid: [...state.grid],
        clicks: state.clicks
    };
    historyLog.push(logEntry);
    saveHistory();
    
    playEffect(type);
    const { r, c } = activePos;
    const mark = (row, col) => {
        if (row >= 0 && row < 7 && col >= 0 && col < 7) {
            const idx = row * 7 + col;
            state.grid[idx] = true;
            document.getElementById(`cell-${idx}`).classList.add('opened');
        }
    };
    if (type === 1) {
        mark(r, c);
        state.currentMisses++;
    } else {
        // 类型 2-7
        if (type === 2) for(let i=0; i<7; i++) mark(i, c);
        else if (type === 3) for(let i=0; i<7; i++) mark(r, i);
        else if (type === 4) { for(let i=0; i<7; i++) { mark(i, c); mark(r, i); } }
        else if (type === 5) { mark(r, c); mark(r-1,c); mark(r+1,c); mark(r,c-1); mark(r,c+1); }
        else if (type === 6) { for(let i=-1; i<=1; i++) for(let j=-1; j<=1; j++) mark(r+i, c+j); }
        else if (type === 7) { state.grid.fill(true); init(); }
        state.currentMisses = 0;
    }

    state.clicks++;
    closeMenu();
    updateAnalysis();
    updateLogDisplay();
}

// 算法对象
const Algorithms = {
    // 贪心算法：根据用户概率自动调整权重的动态贪心算法
    greedy: function(p, grid) {
        // 计算概率分布的特征
        const type1Weight = p[0];  // 仅当前事件的概率
        const colRowWeight = (p[1] + p[2] + p[3]) / 3;  // 行列相关事件的平均概率
        const areaWeight = (p[4] + p[5]) / 2;  // 区域相关事件的平均概率
        
        let scores = [];
        for (let i = 0; i < 49; i++) {
            const r = Math.floor(i / 7), c = i % 7;
            if (grid[i]) continue;
            
            // 计算各项指标
            let rg=0, cg=0, comb=0, cross=0, box=0;
            
            // 计算行未开数
            for(let j=0; j<7; j++) {
                if(!grid[r*7+j]) { 
                    rg++; 
                }
            }
            
            // 计算列未开数
            for(let j=0; j<7; j++) {
                if(!grid[j*7+c]) { 
                    cg++; 
                }
            }
            
            // 计算行+列未开数（修正：减去重复计算的当前格子）
            // 当前格子(r,c)在rg和cg中各被计算了一次，所以需要减1
            comb = rg + cg - 1;
            
            // 计算十字未开数（包括自身）
            [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(o => {
                let nr=r+o[0], nc=c+o[1];
                if(nr>=0&&nr<7&&nc>=0&&nc<7 && !grid[nr*7+nc]) cross++;
            });
            
            // 计算九宫格未开数
            for(let dr=-1;dr<=1;dr++) {
                for(let dc=-1;dc<=1;dc++){
                    let nr=r+dr, nc=c+dc;
                    if(nr>=0&&nr<7&&nc>=0&&nc<7 && !grid[nr*7+nc]) box++;
                }
            }
            
            const totalUnopened = grid.filter(v=>!v).length;
            
            // 动态调整：根据概率重要性加权
            // 当某种类型概率高时，增强对应指标的影响
            const dynamicScore = 
                p[0] * 1 * (1.0 + type1Weight * 0.5) +  // 类型1概率高时，更重视当前格子
                p[1] * cg * (1.0 + colRowWeight * 1.5) +  // 行列概率高时，更重视列未开数
                p[2] * rg * (1.0 + colRowWeight * 1.5) +  // 行列概率高时，更重视行未开数
                p[3] * comb * (1.0 + colRowWeight * 2.0) +  // 行+列概率高时，更重视comb
                p[4] * cross * (1.0 + areaWeight * 1.2) +  // 区域概率高时，增强十字影响
                p[5] * box * (1.0 + areaWeight * 1.2) +  // 区域概率高时，增强九宫格影响
                p[6] * totalUnopened * 0.3;  // 全开概率通常很低，权重降低
            
            scores.push({ i, score: dynamicScore });
        }
        return scores;
    },
    
    // 改进的带权启发式：f(n) = α*g(n) + β*w*h(n)，更平衡的权重设计
    heuristic: function(p, grid, weight) {
        const totalUnopened = grid.filter(v=>!v).length;
        const gamePhase = totalUnopened / 49; // 1=早期，0=末期
        
        let scores = [];
        // 计算每个格子的 g(n)（基础收益）
        for (let i = 0; i < 49; i++) {
            const r = Math.floor(i / 7), c = i % 7;
            if (grid[i]) continue;
            
            // --- 1. 直接期望收益 g(n) ---
            let g = 0;
            let rg=0, cg=0, comb=0, cross=0, box=0;
            for(let j=0; j<7; j++) {
                if(!grid[r*7+j]) { rg++; comb++; }
                if(!grid[j*7+c]) { cg++; if(j!==r) comb++; }
            }
            g = p[0]*1 + p[1]*cg + p[2]*rg + p[3]*comb;
            [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(o => {
                let nr=r+o[0], nc=c+o[1];
                if(nr>=0&&nr<7&&nc>=0&&nc<7 && !grid[nr*7+nc]) cross++;
            });
            for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
                let nr=r+dr, nc=c+dc;
                if(nr>=0&&nr<7&&nc>=0&&nc<7 && !grid[nr*7+nc]) box++;
            }
            g += p[4]*cross + p[5]*box + p[6]*totalUnopened;
            
            // --- 2. 改进的启发式函数 h(n) ---
            // 考虑更多维度的潜力评估
            
            // a) 局部密度（3x3区域）
            let h_local = 0;
            for(let dr=-1;dr<=1;dr++) {
                for(let dc=-1;dc<=1;dc++) {
                    let nr=r+dr, nc=c+dc;
                    if(nr>=0&&nr<7&&nc>=0&&nc<7 && !grid[nr*7+nc]) {
                        h_local++;
                    }
                }
            }
            
            // b) 行列潜力
            let row_unopened = 0;
            let col_unopened = 0;
            for(let j=0; j<7; j++) {
                if(!grid[r*7+j]) row_unopened++;
                if(!grid[j*7+c]) col_unopened++;
            }
            
            // c) 位置价值（中心位置更好）
            const centerDist = Math.abs(r-3) + Math.abs(c-3);
            const positionValue = 1.0 - (centerDist / 12); // 0-1，中心为1
            
            // d) 孤立度评估（邻居越少越孤立）
            let neighborCount = 0;
            for(let dr=-1;dr<=1;dr++) {
                for(let dc=-1;dc<=1;dc++) {
                    if(dr===0 && dc===0) continue;
                    let nr=r+dr, nc=c+dc;
                    if(nr>=0&&nr<7&&nc>=0&&nc<7 && !grid[nr*7+nc]) {
                        neighborCount++;
                    }
                }
            }
            const isolation = 1.0 - (neighborCount / 8); // 0-1，越孤立值越大
            
            // 归一化
            const h_local_norm = h_local / 9;
            const row_norm = row_unopened / 7;
            const col_norm = col_unopened / 7;
            
            // --- 3. 动态权重分配 ---
            // 根据游戏阶段调整各项的重要性
            
            let h;
            if (gamePhase > 0.6) { // 早期（>60%未开）
                // 早期：注重探索和位置价值
                h = positionValue * 0.3 + h_local_norm * 0.4 + (row_norm + col_norm) * 0.3;
            } else if (gamePhase > 0.3) { // 中期（30%-60%）
                // 中期：平衡各种因素
                h = positionValue * 0.2 + h_local_norm * 0.3 + (row_norm + col_norm) * 0.3 + (1 - isolation) * 0.2;
            } else { // 后期（<30%）
                // 后期：优先清理孤立格子
                h = (1 - isolation) * 0.5 + h_local_norm * 0.2 + (row_norm + col_norm) * 0.3;
            }
            
            // --- 4. 改进的权重调整 ---
            // 不再过度衰减权重，而是根据阶段和概率动态调整
            
            // 高效事件的总概率
            const efficiencyProb = p[1] + p[2] + p[3] + p[4] + p[5];
            
            // 动态权重因子：
            // - 早期权重高（注重探索）
            // - 高效事件概率高时权重高（潜力更重要）
            // - 基础权重由用户控制
            const phaseFactor = 0.5 + gamePhase * 0.5; // 早期1.0，后期0.5
            const efficiencyFactor = 1.0 + efficiencyProb * 3; // 高效概率高时放大
            
            const effectiveWeight = weight * phaseFactor * efficiencyFactor;
            
            // --- 5. 平衡的分数计算 ---
            // 确保g和h部分有合理的比例
            // g值范围大约在10-100，h值范围0-1
            
            // 标准化g值到0-1范围（估计最大g值约120）
            const g_normalized = Math.min(g / 120, 1.0);
            
            // 综合分数：平衡直接收益和潜力
            // 使用加权平均，而不是简单相加
            const alpha = 0.7 - 0.3 * gamePhase; // 早期0.4，后期0.7（更注重直接收益）
            const beta = 1 - alpha;
            
            const f = (g_normalized * alpha + h * beta) * 100 * (1 + effectiveWeight * 0.5);
            
            scores.push({ i, score: f });
        }
        return scores;
    },
    
    // 熵减算法：优先计算并标注周围邻居（未开启空格）最少的孤立格子
    entropy: function(p, grid) {
        let scores = [];
        
        // 首先，计算每个格子的孤立度
        for (let i = 0; i < 49; i++) {
            const r = Math.floor(i / 7), c = i % 7;
            if (grid[i]) continue;
            
            // 基础收益 g(n)
            let g = 0;
            let rg=0, cg=0, comb=0, cross=0, box=0;
            for(let j=0; j<7; j++) {
                if(!grid[r*7+j]) { rg++; comb++; }
                if(!grid[j*7+c]) { cg++; if(j!==r) comb++; }
            }
            g = p[0]*1 + p[1]*cg + p[2]*rg + p[3]*comb;
            [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(o => {
                let nr=r+o[0], nc=c+o[1];
                if(nr>=0&&nr<7&&nc>=0&&nc<7 && !grid[nr*7+nc]) cross++;
            });
            for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
                let nr=r+dr, nc=c+dc;
                if(nr>=0&&nr<7&&nc>=0&&nc<7 && !grid[nr*7+nc]) box++;
            }
            g += p[4]*cross + p[5]*box + p[6]*(grid.filter(v=>!v).length);
            
            // 计算周围未开启邻居的数量（8连通，包括对角线）
            let neighborCount = 0;
            for(let dr=-1;dr<=1;dr++) {
                for(let dc=-1;dc<=1;dc++) {
                    if(dr===0 && dc===0) continue;
                    let nr=r+dr, nc=c+dc;
                    if(nr>=0&&nr<7&&nc>=0&&nc<7 && !grid[nr*7+nc]) {
                        neighborCount++;
                    }
                }
            }
            
            // 计算孤立度：邻居越少，孤立度越高
            // 最大邻居数是8
            const isolationScore = (8 - neighborCount) / 8;
            
            // 计算区域密度：周围3x3区域内未开启格子的比例
            let areaUnopened = 0;
            let areaTotal = 0;
            for(let dr=-1;dr<=1;dr++) {
                for(let dc=-1;dc<=1;dc++) {
                    let nr=r+dr, nc=c+dc;
                    if(nr>=0&&nr<7&&nc>=0&&nc<7) {
                        areaTotal++;
                        if(!grid[nr*7+nc]) areaUnopened++;
                    }
                }
            }
            const densityScore = areaUnopened / areaTotal;
            
            // 最终分数 = 基础收益 + 孤立度权重 + 密度权重
            // 调整权重：在游戏后期，更注重清理孤立格子
            const totalUnopened = grid.filter(v=>!v).length;
            const gamePhase = totalUnopened / 49; // 0-1，越小表示越后期
            
            // 后期时增加孤立度权重
            const isolationWeight = 80 * (1 - gamePhase);
            const densityWeight = 30 * gamePhase;
            
            const score = g + isolationScore * isolationWeight + densityScore * densityWeight;
            scores.push({ i, score: score });
        }
        return scores;
    },
    
    // 综合推荐算法：根据选择的算法计算综合分数
    comprehensive: function(p, grid, heuristicWeight, selectedAlgorithms) {
        let scores = [];
        
        // 如果没有指定选择的算法，使用默认（全部）
        if (!selectedAlgorithms) {
            selectedAlgorithms = {
                greedy: true,
                heuristic: true,
                entropy: true,
                mcts: false
            };
        }
        
        // 计算选择的算法的分数
        const algorithmScores = [];
        const algorithmMaps = [];
        
        if (selectedAlgorithms.greedy) {
            const greedyScores = this.greedy(p, grid);
            const greedyMap = new Map();
            greedyScores.forEach(s => greedyMap.set(s.i, s.score));
            algorithmMaps.push(greedyMap);
        }
        if (selectedAlgorithms.heuristic) {
            const heuristicScores = this.heuristic(p, grid, heuristicWeight);
            const heuristicMap = new Map();
            heuristicScores.forEach(s => heuristicMap.set(s.i, s.score));
            algorithmMaps.push(heuristicMap);
        }
        if (selectedAlgorithms.entropy) {
            const entropyScores = this.entropy(p, grid);
            const entropyMap = new Map();
            entropyScores.forEach(s => entropyMap.set(s.i, s.score));
            algorithmMaps.push(entropyMap);
        }
        if (selectedAlgorithms.mcts) {
            const mctsScores = this.fastMCTS(p, grid, 50); // 使用较少的迭代次数
            const mctsMap = new Map();
            mctsScores.forEach(s => mctsMap.set(s.i, s.score));
            algorithmMaps.push(mctsMap);
        }
        
        // 如果没有选择任何算法，返回空数组
        if (algorithmMaps.length === 0) {
            return [];
        }
        
        // 计算每个格子的综合分数（所选算法的平均值）
        for (let i = 0; i < 49; i++) {
            if (grid[i]) continue;
            
            let sum = 0;
            let count = 0;
            
            for (const map of algorithmMaps) {
                const score = map.get(i);
                if (score !== undefined) {
                    sum += score;
                    count++;
                }
            }
            
            const combinedScore = count > 0 ? sum / count : 0;
            scores.push({ i, score: combinedScore });
        }
        
        return scores;
    },
    
    // 蒙特卡洛树搜索（智能版）
    mcts: function(p, grid, iterations = null) {
        // 如果未指定迭代次数，使用默认值
        if (iterations === null) {
            iterations = state.mctsIterations || 300;
        }
        
        // 根据是否启用稳定性模式选择算法
        if (state.mctsStable !== false) {
            // 稳定性模式：运行多次取平均
            const effectiveIterations = Math.max(iterations, 150);
            const results = [];
            const runCount = 3; // 运行3次取平均
            
            for (let run = 0; run < runCount; run++) {
                const runResult = this.fastMCTS(p, grid, Math.floor(effectiveIterations / runCount));
                results.push(runResult);
            }
            
            // 计算平均分数
            const avgScores = Array(49).fill(0);
            const scoreCounts = Array(49).fill(0);
            
            for (const runResult of results) {
                for (const item of runResult) {
                    avgScores[item.i] += item.score;
                    scoreCounts[item.i]++;
                }
            }
            
            // 构建最终结果
            const finalResult = [];
            for (let i = 0; i < 49; i++) {
                if (!grid[i] && scoreCounts[i] > 0) {
                    finalResult.push({
                        i,
                        score: avgScores[i] / scoreCounts[i]
                    });
                }
            }
            
            // 如果没有结果，返回默认
            if (finalResult.length === 0) {
                return this.fastMCTS(p, grid, effectiveIterations);
            }
            
            return finalResult;
        } else {
            // 普通模式：单次运行
            return this.fastMCTS(p, grid, iterations);
        }
    },
    
    // 快速蒙特卡洛搜索
    fastMCTS: function(p, grid, iterations = 200) {
        const scores = Array(49).fill(0);
        const visits = Array(49).fill(0);
        
        // 辅助函数：根据概率选择事件类型
        const chooseEventByProbability = (probs) => {
            const rand = Math.random() * 100;
            let accum = 0;
            for (let i = 0; i < 7; i++) {
                accum += probs[i];
                if (rand <= accum) return i + 1;
            }
            return 7;
        };
        
        // 辅助函数：应用事件到网格
        const applyEventToGrid = (type, idx, currentGrid) => {
            const r = Math.floor(idx / 7), c = idx % 7;
            const mark = (row, col) => {
                if (row >= 0 && row < 7 && col >= 0 && col < 7) {
                    currentGrid[row * 7 + col] = true;
                }
            };
            
            if (type === 1) {
                mark(r, c);
            } else if (type === 2) {
                for (let i = 0; i < 7; i++) mark(i, c);
            } else if (type === 3) {
                for (let i = 0; i < 7; i++) mark(r, i);
            } else if (type === 4) {
                for (let i = 0; i < 7; i++) { mark(i, c); mark(r, i); }
            } else if (type === 5) {
                mark(r, c); 
                if (r-1 >= 0) mark(r-1, c);
                if (r+1 < 7) mark(r+1, c);
                if (c-1 >= 0) mark(r, c-1);
                if (c+1 < 7) mark(r, c+1);
            } else if (type === 6) {
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        mark(r+i, c+j);
                    }
                }
            } else if (type === 7) {
                for (let i = 0; i < 49; i++) currentGrid[i] = true;
            }
        };
        
        // 快速模拟函数
        const fastSimulate = (startGrid, firstAction) => {
            let grid = [...startGrid];
            let steps = 0;
            
            // 第一步使用指定的行动
            if (firstAction !== null) {
                const eventType = chooseEventByProbability(p.map(prob => prob * 100));
                applyEventToGrid(eventType, firstAction, grid);
                steps++;
            }
            
            // 后续步骤随机选择，最多模拟10步
            while (steps < 10 && grid.some(cell => !cell)) {
                const unopened = [];
                for (let i = 0; i < 49; i++) {
                    if (!grid[i]) unopened.push(i);
                }
                if (unopened.length === 0) break;
                
                const randomAction = unopened[Math.floor(Math.random() * unopened.length)];
                const eventType = chooseEventByProbability(p.map(prob => prob * 100));
                applyEventToGrid(eventType, randomAction, grid);
                steps++;
            }
            
            // 奖励：开启的格子数越多越好，步数越少越好
            const opened = grid.filter(cell => cell).length;
            return opened * 2 - steps;
        };
        
        // 运行多次模拟
        for (let iter = 0; iter < iterations; iter++) {
            // 对每个未开启的格子进行采样
            for (let i = 0; i < 49; i++) {
                if (!grid[i]) {
                    const reward = fastSimulate(grid, i);
                    scores[i] += reward;
                    visits[i]++;
                }
            }
        }
        
        // 计算平均分数
        const result = [];
        for (let i = 0; i < 49; i++) {
            if (!grid[i] && visits[i] > 0) {
                result.push({ 
                    i, 
                    score: scores[i] / visits[i] 
                });
            }
        }
        
        // 如果没有结果，返回空数组
        if (result.length === 0) {
            // 返回所有未开启格子的默认分数
            for (let i = 0; i < 49; i++) {
                if (!grid[i]) {
                    result.push({ i, score: 50 });
                }
            }
        }
        
        return result;
    }
};

// 纯随机模拟：每次随机选择一个未开启的格子
function runRandomSimulation(iterations = 1000) {
    // 复制当前状态设置
    const baseProbs = [...state.probs];
    const enablePity = state.enablePity;
    const pityStart = state.pityStart;
    const pityMax = state.pityMax;
    
    // 模拟函数
    function simulateOneRandomGame() {
        let grid = Array(49).fill(false);
        let clicks = 0;
        let currentMisses = 0;
        
        // 辅助函数：应用事件
        const applyEventToGrid = (type, r, c, grid) => {
            const mark = (row, col) => {
                if (row >= 0 && row < 7 && col >= 0 && col < 7) {
                    const idx = row * 7 + col;
                    grid[idx] = true;
                }
            };
            if (type === 1) {
                mark(r, c);
                currentMisses++;
            } else {
                if (type === 2) for(let i=0; i<7; i++) mark(i, c);
                else if (type === 3) for(let i=0; i<7; i++) mark(r, i);
                else if (type === 4) { for(let i=0; i<7; i++) { mark(i, c); mark(r, i); } }
                else if (type === 5) { mark(r, c); mark(r-1,c); mark(r+1,c); mark(r,c-1); mark(r,c+1); }
                else if (type === 6) { for(let i=-1; i<=1; i++) for(let j=-1; j<=1; j++) mark(r+i, c+j); }
                else if (type === 7) { grid.fill(true); }
                currentMisses = 0;
            }
            return grid;
        };
        
        // 选择事件类型（考虑保底）
        const chooseEventType = () => {
            // 检查是否达到最大保底次数，如果是则必触发非类型1事件
            if (enablePity && currentMisses >= pityMax) {
                // 必触发非类型1事件（2-7）
                // 随机选择2-7中的一种，按原始概率比例
                const nonType1Probs = baseProbs.slice(1); // 获取类型2-7的概率
                const totalNonType1 = nonType1Probs.reduce((a, b) => a + b, 0);
                const normalizedNonType1 = nonType1Probs.map(p => p / totalNonType1);
                
                const rand = Math.random();
                let accum = 0;
                for (let i = 0; i < 6; i++) {
                    accum += normalizedNonType1[i];
                    if (rand <= accum) return i + 2; // 返回2-7
                }
                return 7; // 默认
            }
            
            // 动态概率调整
            let adjustedProbs = [...baseProbs];
            if (enablePity && currentMisses >= pityStart) {
                const progress = Math.min((currentMisses - pityStart + 1) / (pityMax - pityStart + 1), 1.0);
                // 逐步增加非类型1事件的概率
                // 类型1的概率减少，其他类型的概率按比例增加
                const type1Reduction = 0.5 * progress; // 最多减少50%
                adjustedProbs[0] = baseProbs[0] * (1 - type1Reduction);
                
                // 将减少的概率分配到其他类型
                const reductionAmount = baseProbs[0] * type1Reduction;
                const otherTotal = baseProbs.slice(1).reduce((a, b) => a + b, 0);
                
                for (let i = 1; i < 7; i++) {
                    adjustedProbs[i] = baseProbs[i] + (reductionAmount * (baseProbs[i] / otherTotal));
                }
            }
            
            // 归一化
            const sum = adjustedProbs.reduce((a, b) => a + b, 0);
            const normalized = adjustedProbs.map(p => p / sum);
            
            // 随机选择
            const rand = Math.random();
            let accum = 0;
            for (let i = 0; i < 7; i++) {
                accum += normalized[i];
                if (rand <= accum) return i + 1;
            }
            return 7;
        };
        
        // 随机选择一个未开启的格子
        const chooseRandomCell = (grid) => {
            // 收集所有未开启格子的索引
            const unopenedIndices = [];
            for (let i = 0; i < 49; i++) {
                if (!grid[i]) unopenedIndices.push(i);
            }
            if (unopenedIndices.length === 0) return null;
            
            // 随机选择一个
            const randomIndex = Math.floor(Math.random() * unopenedIndices.length);
            const idx = unopenedIndices[randomIndex];
            return { r: Math.floor(idx / 7), c: idx % 7 };
        };
        
        // 主循环
        while (grid.some(cell => !cell)) {
            const randomCell = chooseRandomCell(grid);
            if (!randomCell) break;
            const eventType = chooseEventType();
            applyEventToGrid(eventType, randomCell.r, randomCell.c, grid);
            clicks++;
        }
        return clicks;
    }
    
    // 运行多次模拟
    const results = [];
    for (let i = 0; i < iterations; i++) {
        results.push(simulateOneRandomGame());
    }
    return results;
}

// 模拟单个游戏直到完成，返回点击次数
function runSimulation(algorithmType, iterations = 1000) {
    // 复制当前状态设置
    const baseProbs = [...state.probs];
    const enablePity = state.enablePity;
    const pityStart = state.pityStart;
    const pityMax = state.pityMax;
    const heuristicWeight = state.heuristicWeight;
    
    // 模拟函数
    function simulateOneGame() {
        let grid = Array(49).fill(false);
        let clicks = 0;
        let currentMisses = 0;
        
        // 辅助函数：应用事件
        const applyEventToGrid = (type, r, c, grid) => {
            const mark = (row, col) => {
                if (row >= 0 && row < 7 && col >= 0 && col < 7) {
                    const idx = row * 7 + col;
                    grid[idx] = true;
                }
            };
            if (type === 1) {
                mark(r, c);
                currentMisses++;
            } else {
                if (type === 2) for(let i=0; i<7; i++) mark(i, c);
                else if (type === 3) for(let i=0; i<7; i++) mark(r, i);
                else if (type === 4) { for(let i=0; i<7; i++) { mark(i, c); mark(r, i); } }
                else if (type === 5) { mark(r, c); mark(r-1,c); mark(r+1,c); mark(r,c-1); mark(r,c+1); }
                else if (type === 6) { for(let i=-1; i<=1; i++) for(let j=-1; j<=1; j++) mark(r+i, c+j); }
                else if (type === 7) { grid.fill(true); }
                currentMisses = 0;
            }
            return grid;
        };
        
        // 选择事件类型（考虑保底）
        const chooseEventType = () => {
            // 检查是否达到最大保底次数，如果是则必触发非类型1事件
            if (enablePity && currentMisses >= pityMax) {
                // 必触发非类型1事件（2-7）
                // 随机选择2-7中的一种，按原始概率比例
                const nonType1Probs = baseProbs.slice(1); // 获取类型2-7的概率
                const totalNonType1 = nonType1Probs.reduce((a, b) => a + b, 0);
                const normalizedNonType1 = nonType1Probs.map(p => p / totalNonType1);
                
                const rand = Math.random();
                let accum = 0;
                for (let i = 0; i < 6; i++) {
                    accum += normalizedNonType1[i];
                    if (rand <= accum) return i + 2; // 返回2-7
                }
                return 7; // 默认
            }
            
            // 动态概率调整
            let adjustedProbs = [...baseProbs];
            if (enablePity && currentMisses >= pityStart) {
                const progress = Math.min((currentMisses - pityStart + 1) / (pityMax - pityStart + 1), 1.0);
                // 逐步增加非类型1事件的概率
                // 类型1的概率减少，其他类型的概率按比例增加
                const type1Reduction = 0.5 * progress; // 最多减少50%
                adjustedProbs[0] = baseProbs[0] * (1 - type1Reduction);
                
                // 将减少的概率分配到其他类型
                const reductionAmount = baseProbs[0] * type1Reduction;
                const otherTotal = baseProbs.slice(1).reduce((a, b) => a + b, 0);
                
                for (let i = 1; i < 7; i++) {
                    adjustedProbs[i] = baseProbs[i] + (reductionAmount * (baseProbs[i] / otherTotal));
                }
            }
            
            // 归一化
            const sum = adjustedProbs.reduce((a, b) => a + b, 0);
            const normalized = adjustedProbs.map(p => p / sum);
            
            // 随机选择
            const rand = Math.random();
            let accum = 0;
            for (let i = 0; i < 7; i++) {
                accum += normalized[i];
                if (rand <= accum) return i + 1;
            }
            return 7;
        };
        
        // 选择最佳格子
        const chooseBestCell = (grid, algorithmType) => {
            // 动态概率调整（用于计算分数，与chooseEventType一致）
            let adjustedProbs = [...baseProbs];
            if (enablePity && currentMisses >= pityStart) {
                const progress = Math.min((currentMisses - pityStart + 1) / (pityMax - pityStart + 1), 1.0);
                
                // 如果达到最大保底次数，类型1的概率为0
                if (currentMisses >= pityMax) {
                    adjustedProbs[0] = 0;
                    // 其他类型的概率按原始比例分配
                    const otherTotal = baseProbs.slice(1).reduce((a, b) => a + b, 0);
                    for (let i = 1; i < 7; i++) {
                        adjustedProbs[i] = (baseProbs[i] / otherTotal) * 100;
                    }
                } else {
                    // 逐步调整概率
                    const type1Reduction = 0.5 * progress;
                    adjustedProbs[0] = baseProbs[0] * (1 - type1Reduction);
                    
                    // 将减少的概率分配到其他类型
                    const reductionAmount = baseProbs[0] * type1Reduction;
                    const otherTotal = baseProbs.slice(1).reduce((a, b) => a + b, 0);
                    
                    for (let i = 1; i < 7; i++) {
                        adjustedProbs[i] = baseProbs[i] + (reductionAmount * (baseProbs[i] / otherTotal));
                    }
                }
                
                // 确保总和为100
                const total = adjustedProbs.reduce((a, b) => a + b, 0);
                if (total > 0) {
                    for (let i = 0; i < 7; i++) {
                        adjustedProbs[i] = (adjustedProbs[i] * 100) / total;
                    }
                }
            }
            const p = adjustedProbs.map(v => v / 100);
            
            // 如果算法类型是'auto'，根据当前未开启格子数动态选择算法
            let actualAlgorithm = algorithmType;
            if (algorithmType === 'auto') {
                // 计算未开启格子数
                let unopened = 0;
                for (let i = 0; i < 49; i++) {
                    if (!grid[i]) unopened++;
                }
                // 使用带滞后的阶段判断
                let stageForSim;
                if (unopened > 37) {
                    stageForSim = "前期";
                } else if (unopened > 35 && window.lastStage === "前期") {
                    stageForSim = "前期";
                } else if (unopened >= 17) {
                    stageForSim = "中期";
                } else if (unopened >= 15 && window.lastStage === "中期") {
                    stageForSim = "中期";
                } else if (unopened >= 13) {
                    stageForSim = "后期";
                } else {
                    stageForSim = "末期";
                }
                
                if (stageForSim === "前期") {
                    actualAlgorithm = 'heuristic';
                } else if (stageForSim === "中期") {
                    actualAlgorithm = 'greedy';
                } else {
                    actualAlgorithm = 'entropy';
                }
            }
            
            let scores;
            if (actualAlgorithm === 'greedy') {
                scores = Algorithms.greedy(p, grid);
            } else if (actualAlgorithm === 'heuristic') {
                scores = Algorithms.heuristic(p, grid, heuristicWeight);
            } else if (actualAlgorithm === 'entropy') {
                scores = Algorithms.entropy(p, grid);
            } else if (actualAlgorithm === 'comprehensive') {
                scores = Algorithms.comprehensive(p, grid, heuristicWeight, state.comprehensiveAlgorithms);
            } else if (actualAlgorithm === 'mcts') {
                scores = Algorithms.mcts(p, grid, state.mctsIterations);
            } else if (actualAlgorithm === 'fastMCTS') {
                scores = Algorithms.fastMCTS(p, grid, Math.min(state.mctsIterations || 200, 100));
            } else {
                scores = Algorithms.greedy(p, grid);
            }
            
            // 找到最高分
            if (scores.length === 0) return null;
            let maxScore = -Infinity;
            // 收集所有最高分的格子索引
            let bestIndices = [];
            for (const s of scores) {
                if (s.score > maxScore) {
                    maxScore = s.score;
                    bestIndices = [s.i];
                } else if (s.score === maxScore) {
                    bestIndices.push(s.i);
                }
            }
            if (bestIndices.length === 0) return null;
            // 随机选择一个最高分格子
            const randomIndex = Math.floor(Math.random() * bestIndices.length);
            const bestIdx = bestIndices[randomIndex];
            return { r: Math.floor(bestIdx / 7), c: bestIdx % 7 };
        };
        
        // 主循环
        while (grid.some(cell => !cell)) {
            const best = chooseBestCell(grid, algorithmType);
            if (!best) break;
            const eventType = chooseEventType();
            applyEventToGrid(eventType, best.r, best.c, grid);
            clicks++;
        }
        return clicks;
    }
    
    // 运行多次模拟
    const results = [];
    for (let i = 0; i < iterations; i++) {
        results.push(simulateOneGame());
    }
    return results;
}

function updateAnalysis() {
    let unopened = 0;
    let scores = [];
    
    // 统计未开启格子数量
    for (let i = 0; i < 49; i++) {
        if (!state.grid[i]) unopened++;
    }
    
    // 判断阶段并确定推荐算法（基于实际表现优化）
    let stage, recommendedAlgorithm;
    
    // 上次阶段记录
    if (!window.lastStage) window.lastStage = '';
    
    // 根据未开启格子数判断阶段（优化后的阈值）
    // 前期：大量未开启格子，需要探索
    if (unopened > 30) { // 降低阈值，让启发式算法更早介入
        stage = "前期";
        recommendedAlgorithm = "heuristic";
    } 
    // 中期：中等数量格子，平衡探索与利用
    else if (unopened >= 10) {
        stage = "中期";
        // 在中期，根据格子分布决定使用贪心还是启发式
        // 计算孤立格子数量
        let isolatedCount = 0;
        for (let i = 0; i < 49; i++) {
            if (state.grid[i]) continue;
            const r = Math.floor(i / 7), c = i % 7;
            let neighborCount = 0;
            for(let dr=-1;dr<=1;dr++) {
                for(let dc=-1;dc<=1;dc++) {
                    if(dr===0 && dc===0) continue;
                    let nr=r+dr, nc=c+dc;
                    if(nr>=0&&nr<7&&nc>=0&&nc<7 && !state.grid[nr*7+nc]) {
                        neighborCount++;
                    }
                }
            }
            if (neighborCount <= 2) isolatedCount++;
        }
        // 如果孤立格子较多，使用熵减算法
        if (isolatedCount > unopened * 0.3) {
            recommendedAlgorithm = "entropy";
        } else {
            recommendedAlgorithm = "greedy";
        }
    } 
    // 后期：少量格子，优先清理孤立格子
    else {
        stage = "后期";
        recommendedAlgorithm = "entropy";
    }
    
    // 记录本次阶段
    window.lastStage = stage;
    
    // 动态调整启发式权重：前期权重较高，后期降低
    if (state.autoWeight && state.currentAlgorithm === 'heuristic') {
        if (stage === "前期") {
            // 前期：探索更重要，权重较高（1.5-2.0）
            state.heuristicWeight = Math.max(1.5, Math.min(2.0, 
                state.heuristicWeight || 1.5
            ));
        } else if (stage === "中期") {
            // 中期：平衡探索与利用（1.0-1.5）
            state.heuristicWeight = Math.max(1.0, Math.min(1.5,
                state.heuristicWeight || 1.0
            ));
        } else {
            // 后期：更注重利用（0.5-1.0）
            state.heuristicWeight = Math.max(0.5, Math.min(1.0,
                state.heuristicWeight || 0.8
            ));
        }
    }
    
    // 更新权重输入框显示
    const weightInput = document.getElementById('heuristicWeight');
    if (weightInput) {
        weightInput.value = state.heuristicWeight.toFixed(1);
        // 如果自动调整开启，将输入框设为只读
        if (state.autoWeight && state.currentAlgorithm === 'heuristic') {
            weightInput.readOnly = true;
            weightInput.style.backgroundColor = '#f0f0f0';
        } else {
            weightInput.readOnly = false;
            weightInput.style.backgroundColor = 'white';
        }
    }
    
    // 处理算法选择逻辑
    let currentAlgorithm = state.currentAlgorithm;
    const algorithmSelect = document.getElementById('algorithmSelect');
    
    // 不再有动态切换逻辑
    // 确保当前算法不是'auto'
    if (currentAlgorithm === 'auto') {
        currentAlgorithm = 'comprehensive';
        algorithmSelect.value = 'comprehensive';
    }
    
    // 动态概率调整（与模拟中的逻辑一致）
    let adjustedProbs = [...state.probs];
    if (state.enablePity && state.currentMisses >= state.pityStart) {
        const progress = Math.min((state.currentMisses - state.pityStart + 1) / (state.pityMax - state.pityStart + 1), 1.0);
        
        // 如果达到最大保底次数，类型1的概率为0，其他类型概率按比例增加
        if (state.currentMisses >= state.pityMax) {
            adjustedProbs[0] = 0;
            // 其他类型的概率按原始比例分配
            const otherTotal = state.probs.slice(1).reduce((a, b) => a + b, 0);
            for (let i = 1; i < 7; i++) {
                adjustedProbs[i] = (state.probs[i] / otherTotal) * 100;
            }
        } else {
            // 逐步调整概率
            const type1Reduction = 0.5 * progress; // 最多减少50%
            adjustedProbs[0] = state.probs[0] * (1 - type1Reduction);
            
            // 将减少的概率分配到其他类型
            const reductionAmount = state.probs[0] * type1Reduction;
            const otherTotal = state.probs.slice(1).reduce((a, b) => a + b, 0);
            
            for (let i = 1; i < 7; i++) {
                adjustedProbs[i] = state.probs[i] + (reductionAmount * (state.probs[i] / otherTotal));
            }
        }
        
        // 确保总和为100
        const total = adjustedProbs.reduce((a, b) => a + b, 0);
        if (total > 0) {
            for (let i = 0; i < 7; i++) {
                adjustedProbs[i] = (adjustedProbs[i] * 100) / total;
            }
        }
    }
    
    const p = adjustedProbs.map(v => v / 100);
    const totalP = state.probs.reduce((a, b) => a + b, 0);
    const warningEl = document.getElementById('probWarning');
    warningEl.innerText = `当前总权重: ${totalP}% | 未触发计数: ${state.currentMisses}`;
    warningEl.style.color = totalP === 100 ? 'var(--primary)' : 'var(--danger)';
    
    // 更新显示
    document.getElementById('currentMissesDisplay').textContent = state.currentMisses;

    // 计算所有算法的分数，并统一到相同的总分尺度
    const allScores = {
        greedy: Algorithms.greedy(p, state.grid),
        heuristic: Algorithms.heuristic(p, state.grid, state.heuristicWeight),
        entropy: Algorithms.entropy(p, state.grid),
        comprehensive: Algorithms.comprehensive(p, state.grid, state.heuristicWeight, state.comprehensiveAlgorithms),
        mcts: Algorithms.mcts(p, state.grid, state.mctsIterations),
        fastMCTS: Algorithms.fastMCTS(p, state.grid, Math.min(state.mctsIterations || 200, 100))
    };
    
    // 计算每个算法的总分
    const algorithmTotals = {};
    Object.keys(allScores).forEach(alg => {
        algorithmTotals[alg] = allScores[alg].reduce((sum, s) => sum + s.score, 0);
    });
    
    // 找到目标总分：使用贪心算法的总分作为基准（因为它最稳定）
    const targetTotal = algorithmTotals.greedy;
    
    // 调整每个算法的分数，使它们的总分与目标总分一致
    const normalizedScores = {};
    Object.keys(allScores).forEach(alg => {
        const currentTotal = algorithmTotals[alg];
        const scaleFactor = currentTotal > 0 ? targetTotal / currentTotal : 1;
        
        normalizedScores[alg] = allScores[alg].map(s => ({
            i: s.i,
            score: s.score * scaleFactor
        }));
    });
    
    // 现在所有算法的总分应该大致相同，但为了更好的显示，可以再进行一次归一化到0-100
    // 收集所有调整后的分数
    let allNormalizedValues = [];
    Object.values(normalizedScores).forEach(algScores => {
        algScores.forEach(s => allNormalizedValues.push(s.score));
    });
    const minScore = Math.min(...allNormalizedValues);
    const maxScore = Math.max(...allNormalizedValues);
    const range = maxScore - minScore;
    
    // 最终归一化到0-100
    Object.keys(normalizedScores).forEach(alg => {
        normalizedScores[alg] = normalizedScores[alg].map(s => {
            if (range === 0) return { i: s.i, score: 50 };
            const normalizedScore = ((s.score - minScore) / range) * 100;
            return { i: s.i, score: normalizedScore };
        });
    });
    
    // 计算综合分数：仅在使用综合推荐算法时，使用用户勾选的算法计算平均值
    const combinedScores = [];
    if (currentAlgorithm === 'comprehensive') {
        for (let i = 0; i < 49; i++) {
            if (state.grid[i]) continue;
            let sum = 0;
            let count = 0;
            
            // 只使用用户勾选的算法
            if (state.comprehensiveAlgorithms.greedy) {
                const scoreObj = normalizedScores.greedy?.find(s => s.i === i);
                if (scoreObj) {
                    sum += scoreObj.score;
                    count++;
                }
            }
            if (state.comprehensiveAlgorithms.heuristic) {
                const scoreObj = normalizedScores.heuristic?.find(s => s.i === i);
                if (scoreObj) {
                    sum += scoreObj.score;
                    count++;
                }
            }
            if (state.comprehensiveAlgorithms.entropy) {
                const scoreObj = normalizedScores.entropy?.find(s => s.i === i);
                if (scoreObj) {
                    sum += scoreObj.score;
                    count++;
                }
            }
            if (state.comprehensiveAlgorithms.mcts) {
                const scoreObj = normalizedScores.mcts?.find(s => s.i === i);
                if (scoreObj) {
                    sum += scoreObj.score;
                    count++;
                }
            }
            
            const avgScore = count > 0 ? sum / count : 0;
            combinedScores.push({ i, score: avgScore });
        }
    } else {
        // 如果不是综合推荐算法，combinedScores为空
        // 这不会影响其他算法的显示
    }
    
    // 根据当前选择的算法决定显示哪个分数
    let displayScores;
    if (currentAlgorithm === 'greedy') {
        displayScores = normalizedScores.greedy;
    } else if (currentAlgorithm === 'heuristic') {
        displayScores = normalizedScores.heuristic;
    } else if (currentAlgorithm === 'entropy') {
        displayScores = normalizedScores.entropy;
    } else if (currentAlgorithm === 'comprehensive') {
        displayScores = normalizedScores.comprehensive;
    } else if (currentAlgorithm === 'mcts') {
        displayScores = normalizedScores.mcts;
    } else if (currentAlgorithm === 'fastMCTS') {
        displayScores = normalizedScores.fastMCTS;
    } else {
        // 默认使用综合推荐
        displayScores = normalizedScores.comprehensive;
    }
    
    // 更新算法下拉菜单的呼吸灯特效
    algorithmSelect.classList.remove('algorithm-pulse');
    // 不再有自动切换，所以不需要呼吸灯
    
    // 更新显示
    for (let i = 0; i < 49; i++) {
        const el = document.getElementById(`cell-${i}`);
        el.classList.remove('best', 'good', 'combined-best');
        if (state.grid[i]) continue;
        
        // 显示当前算法的归一化分数
        const scoreObj = displayScores.find(s => s.i === i);
        if (scoreObj) {
            document.getElementById(`s-${i}`).innerText = scoreObj.score.toFixed(1);
        } else {
            document.getElementById(`s-${i}`).innerText = '0';
        }
    }

    // 标记最佳格子（基于当前显示算法）
    if(displayScores.length > 0){
        const max = Math.max(...displayScores.map(s => s.score));
        // 确保max是有效的数字
        if (isFinite(max) && max > 0) {
            displayScores.forEach(s => {
                if(s.score === max) {
                    document.getElementById(`cell-${s.i}`).classList.add('best');
                } else if(s.score > max * 0.8) {
                    document.getElementById(`cell-${s.i}`).classList.add('good');
                }
            });
        }
    }
    
    // 额外标记被多个算法推荐的格子（绿框）
    // 只有在使用综合推荐算法时才显示绿框，并且只使用用户勾选的算法
    if (currentAlgorithm === 'comprehensive') {
        // 计算每个格子被推荐的程度（在归一化分数中排名前3）
        const recommendationCount = Array(49).fill(0);
        
        // 只考虑用户勾选的算法
        const selectedAlgorithms = [];
        if (state.comprehensiveAlgorithms.greedy) selectedAlgorithms.push('greedy');
        if (state.comprehensiveAlgorithms.heuristic) selectedAlgorithms.push('heuristic');
        if (state.comprehensiveAlgorithms.entropy) selectedAlgorithms.push('entropy');
        if (state.comprehensiveAlgorithms.mcts) selectedAlgorithms.push('mcts');
        
        selectedAlgorithms.forEach(alg => {
            const algScores = normalizedScores[alg];
            if (!algScores) return;
            // 按分数排序
            const sorted = [...algScores].sort((a, b) => b.score - a.score);
            // 取前3名
            const top3 = sorted.slice(0, 3);
            top3.forEach(s => {
                recommendationCount[s.i]++;
            });
        });
        
        // 标记被至少2个算法推荐的格子
        for (let i = 0; i < 49; i++) {
            if (state.grid[i]) continue;
            if (recommendationCount[i] >= 2) {
                document.getElementById(`cell-${i}`).classList.add('combined-best');
            }
        }
    }
    // 其他算法下不显示绿框

    if (unopened === 0 && state.clicks > 0) {
        document.getElementById('winOverlay').style.display = 'flex';
        document.getElementById('winMessage').innerText = `已锁定全图坐标！本轮共反馈 ${state.clicks} 次。`;
        localStorage.removeItem(STORAGE_KEY);
    }
    
    // 更新状态栏，显示阶段和算法
    const algorithmDisplay = currentAlgorithm;
    let scoreType = ' (归一化)';
    let mctsNote = '';
    
    // 如果是蒙特卡洛算法，添加说明
    if (currentAlgorithm === 'mcts' || currentAlgorithm === 'fastMCTS') {
        mctsNote = state.mctsStable ? ' [稳定模式]' : ' [动态模式]';
        if (!state.mctsStable) {
            mctsNote += ' - 结果会有正常波动';
        }
    }
    
    const statusText = window.innerWidth <= 768 
        ? `剩余:${unopened} 阶段:${stage} 算法:${algorithmDisplay}${mctsNote}`
        : `剩余: ${unopened} | 阶段: ${stage} | 算法: ${algorithmDisplay}${mctsNote}${scoreType} | 点击: ${state.clicks}`;
    document.getElementById('statusBar').innerText = statusText;
    
    // 添加说明文本
    if (currentAlgorithm === 'comprehensive') {
        const hasCombinedBest = document.querySelector('.cell.combined-best');
        if (hasCombinedBest) {
            document.getElementById('statusBar').innerText += ' | 绿框:多算法推荐';
        }
    }
    saveState();
}

// 计算统计信息的辅助函数
function calcStats(arr) {
    if (arr.length === 0) return { mean: 0, variance: 0, std: 0, min: 0, max: 0 };
    const mean = arr.reduce((a,b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    const std = Math.sqrt(variance);
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    return { mean, variance, std, min, max };
}

function runBatchSimulation() {
    const iterations = parseInt(document.getElementById('simIterations').value) || 1000;
    const includeMCTS = document.getElementById('includeMCTS').checked;
    const includeFastMCTS = document.getElementById('includeFastMCTS').checked;
    
    // 如果用户选择了蒙特卡洛算法，显示警告
    if (includeMCTS || includeFastMCTS) {
        const warningMsg = "⚠️ 注意：蒙特卡洛算法消耗大量性能，可能导致网页无响应，仅供测试！\n\n点击'确定'继续，点击'取消'返回修改设置。";
        if (!confirm(warningMsg)) {
            return;
        }
    }
    
    // 显示加载状态
    const resultsDiv = document.getElementById('simResults');
    const contentDiv = document.getElementById('simResultsContent');
    resultsDiv.style.display = 'block';
    contentDiv.innerHTML = '<p>正在运行多算法对比模拟，请稍候...</p>';
    
    // 使用 setTimeout 避免阻塞 UI
    setTimeout(() => {
        try {
            // 定义要测试的算法列表和对应的模拟次数
            // 基础算法列表（不包含蒙特卡洛）
            const algorithmsToTest = [
                { 
                    id: 'greedy', 
                    name: '贪心算法',
                    simCount: Math.min(iterations, 1000), // 最多1000次
                    description: '快速简单，适合前期'
                },
                { 
                    id: 'heuristic', 
                    name: '带权启发',
                    simCount: Math.min(iterations, 1000),
                    description: '平衡探索与利用'
                },
                { 
                    id: 'entropy', 
                    name: '熵减算法',
                    simCount: Math.min(iterations, 1000),
                    description: '清理孤立格子'
                },
                { 
                    id: 'comprehensive', 
                    name: '综合推荐',
                    simCount: Math.min(iterations, 1000),
                    description: '多算法融合'
                }
            ];
            
            // 蒙特卡洛算法作为可选测试项
            const mctsAlgorithms = [
                { 
                    id: 'mcts', 
                    name: '蒙特卡洛搜索',
                    simCount: Math.min(iterations, 100), // 大幅减少次数以避免性能问题
                    description: '深度前瞻（计算量大）'
                },
                { 
                    id: 'fastMCTS', 
                    name: '快速蒙特卡洛',
                    simCount: Math.min(iterations, 200), // 快速版可以多跑一些
                    description: '平衡性能与效果'
                }
            ];
            
            // 检查用户是否选择了蒙特卡洛算法进行测试
            const includeMCTS = document.getElementById('includeMCTS').checked;
            const includeFastMCTS = document.getElementById('includeFastMCTS').checked;
            const hasMCTS = includeMCTS || includeFastMCTS;
            
            // 运行所有算法的模拟
            const allResults = {};
            const allStats = {};
            const computeTimes = {}; // 记录计算时间
            
            // 先运行纯随机算法作为基准
            contentDiv.innerHTML = '<p>正在运行纯随机算法基准测试...</p>';
            const randomStart = performance.now();
            // 根据是否包含蒙特卡洛决定模拟次数
            const randomSimCount = hasMCTS ? Math.min(iterations, 1000) : iterations;
            const randomResults = runRandomSimulation(randomSimCount);
            const randomTime = performance.now() - randomStart;
            const randomStats = calcStats(randomResults);
            
            // 更新基础算法的模拟次数：如果没有选择蒙特卡洛，使用用户指定的完整次数
            if (!hasMCTS) {
                // 用户没有选择蒙特卡洛，所有算法都使用完整的用户指定次数
                for (const alg of algorithmsToTest) {
                    alg.simCount = iterations;
                }
            } else {
                // 用户选择了蒙特卡洛，基础算法仍然使用限制次数（最多1000次）
                for (const alg of algorithmsToTest) {
                    alg.simCount = Math.min(iterations, 1000);
                }
            }
            
            // 运行基础算法的模拟
            for (const alg of algorithmsToTest) {
                contentDiv.innerHTML = `<p>正在测试 ${alg.name} (${alg.simCount}次模拟)...</p>`;
                const startTime = performance.now();
                const results = runSimulation(alg.id, alg.simCount);
                const endTime = performance.now();
                
                allResults[alg.id] = results;
                allStats[alg.id] = calcStats(results);
                computeTimes[alg.id] = endTime - startTime;
            }
            
            // 如果用户选择包含蒙特卡洛算法，运行它们的模拟
            if (includeMCTS || includeFastMCTS) {
                for (const alg of mctsAlgorithms) {
                    // 根据勾选框决定是否运行该算法
                    if (alg.id === 'mcts' && !includeMCTS) continue;
                    if (alg.id === 'fastMCTS' && !includeFastMCTS) continue;
                    
                    contentDiv.innerHTML = `<p>正在测试 ${alg.name} (${alg.simCount}次模拟)...</p>`;
                    const startTime = performance.now();
                    const results = runSimulation(alg.id, alg.simCount);
                    const endTime = performance.now();
                    
                    allResults[alg.id] = results;
                    allStats[alg.id] = calcStats(results);
                    computeTimes[alg.id] = endTime - startTime;
                }
            }
        
        // 生成多算法对比结果表格
        let html = `
            <div style="background:#f8f9fa; padding:10px; border-radius:8px; margin-bottom:10px;">
                <h5 style="margin:0 0 8px 0;">多算法性能对比</h5>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <tr>
                        <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">算法</th>
                        <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">模拟次数</th>
                        <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">平均点击</th>
                        <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">标准差</th>
                        <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">提升%</th>
                        <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">计算时间</th>
                    </tr>
        `;
        
        // 找到最佳平均点击次数（排除蒙特卡洛，因为它们模拟次数不同）
        let bestMean = Infinity;
        let bestAlgorithm = '';
        for (const alg of algorithmsToTest) {
            const stats = allStats[alg.id];
            // 只比较模拟次数相近的算法
            if (alg.simCount >= 800 && stats.mean < bestMean) {
                bestMean = stats.mean;
                bestAlgorithm = alg.id;
            }
        }
        
        // 如果没有找到（可能蒙特卡洛模拟次数太少），使用所有算法
        if (bestMean === Infinity) {
            for (const alg of algorithmsToTest) {
                const stats = allStats[alg.id];
                if (stats.mean < bestMean) {
                    bestMean = stats.mean;
                    bestAlgorithm = alg.id;
                }
            }
        }
        
        // 添加随机算法行
        const randomImprovement = ((randomStats.mean - bestMean) / randomStats.mean * 100).toFixed(1);
        html += `
            <tr style="background:#f0f0f0;">
                <td style="padding:4px; border-bottom:1px solid #eee;"><b>纯随机算法</b></td>
                <td style="padding:4px; border-bottom:1px solid #eee;">${randomSimCount}</td>
                <td style="padding:4px; border-bottom:1px solid #eee;">${randomStats.mean.toFixed(2)}</td>
                <td style="padding:4px; border-bottom:1px solid #eee;">${randomStats.std.toFixed(2)}</td>
                <td style="padding:4px; border-bottom:1px solid #eee;">-</td>
                <td style="padding:4px; border-bottom:1px solid #eee;">${randomTime.toFixed(0)}ms</td>
            </tr>
        `;
        
        // 添加基础算法的行
        for (const alg of algorithmsToTest) {
            const stats = allStats[alg.id];
            const improvement = ((randomStats.mean - stats.mean) / randomStats.mean * 100).toFixed(1);
            const isBest = alg.id === bestAlgorithm;
            const timePerSim = (computeTimes[alg.id] / alg.simCount).toFixed(2);
            
            html += `
                <tr ${isBest ? 'style="background:#e6f7e6;"' : ''}>
                    <td style="padding:4px; border-bottom:1px solid #eee;">${alg.name}${isBest ? ' 🏆' : ''}</td>
                    <td style="padding:4px; border-bottom:1px solid #eee;">${alg.simCount}</td>
                    <td style="padding:4px; border-bottom:1px solid #eee; ${isBest ? 'font-weight:bold;' : ''}">${stats.mean.toFixed(2)}</td>
                    <td style="padding:4px; border-bottom:1px solid #eee;">${stats.std.toFixed(2)}</td>
                    <td style="padding:4px; border-bottom:1px solid #eee; color:${parseFloat(improvement) > 0 ? 'green' : 'red'}">${improvement}%</td>
                    <td style="padding:4px; border-bottom:1px solid #eee; font-size:10px;">${computeTimes[alg.id].toFixed(0)}ms (${timePerSim}ms/次)</td>
                </tr>
            `;
        }
        
        // 如果用户选择了包含蒙特卡洛算法，添加它们的行
        if (includeMCTS || includeFastMCTS) {
            for (const alg of mctsAlgorithms) {
                // 根据勾选框决定是否显示该算法
                if (alg.id === 'mcts' && !includeMCTS) continue;
                if (alg.id === 'fastMCTS' && !includeFastMCTS) continue;
                
                const stats = allStats[alg.id];
                if (stats) {
                    const improvement = ((randomStats.mean - stats.mean) / randomStats.mean * 100).toFixed(1);
                    const isBest = alg.id === bestAlgorithm;
                    const timePerSim = (computeTimes[alg.id] / alg.simCount).toFixed(2);
                    
                    html += `
                        <tr ${isBest ? 'style="background:#e6f7e6;"' : ''}>
                            <td style="padding:4px; border-bottom:1px solid #eee; color:#ff4757;">${alg.name} ⚠️${isBest ? ' 🏆' : ''}</td>
                            <td style="padding:4px; border-bottom:1px solid #eee;">${alg.simCount}</td>
                            <td style="padding:4px; border-bottom:1px solid #eee; ${isBest ? 'font-weight:bold;' : ''}">${stats.mean.toFixed(2)}</td>
                            <td style="padding:4px; border-bottom:1px solid #eee;">${stats.std.toFixed(2)}</td>
                            <td style="padding:4px; border-bottom:1px solid #eee; color:${parseFloat(improvement) > 0 ? 'green' : 'red'}">${improvement}%</td>
                            <td style="padding:4px; border-bottom:1px solid #eee; font-size:10px; color:#ff4757;">${computeTimes[alg.id].toFixed(0)}ms (${timePerSim}ms/次)</td>
                        </tr>
                    `;
                }
            }
        }
        
        html += `
                </table>
                <p style="font-size:10px; color:#666; margin-top:5px;">
                    <b>注：</b>点击次数越少越好。蒙特卡洛算法模拟次数较少（计算量大），但每次决策质量更高。
                    提升% = (随机平均 - 算法平均) / 随机平均 × 100%
                </p>
            </div>
            
            <div style="background:#f8f9fa; padding:10px; border-radius:8px;">
                <h5 style="margin:0 0 8px 0;">算法性能分析</h5>
                <div style="font-size:11px; line-height:1.4;">
                    <p><b>📊 测试说明：</b></p>
                    <ul style="margin:5px 0; padding-left:15px;">
                        <li><b>贪心算法</b>：快速简单，适合前期快速决策（计算最快）</li>
                        <li><b>带权启发</b>：平衡探索与利用，适合中期（计算快）</li>
                        <li><b>熵减算法</b>：优先清理孤立格子，适合后期（计算快）</li>
                        <li><b>综合推荐</b>：多算法融合，稳定性好（计算中等）</li>
                        <li><b>蒙特卡洛搜索</b>：多步深度前瞻，适合复杂局面（计算量大，但实际优势有限）</li>
                        <li><b>快速蒙特卡洛</b>：平衡性能与效果（计算量中等，实际优势有限）</li>
                    </ul>
                    <p><b>🎯 蒙特卡洛表现预期：</b></p>
                    <ul style="margin:5px 0; padding-left:15px;">
                        <li><b>前期</b>（未开启>30）：不如贪心/启发式（计算开销大）</li>
                        <li><b>中期</b>（未开启10-30）：优势不明显，多步前瞻效果有限</li>
                        <li><b>后期</b>（未开启<10）：表现与其他算法相近，无明显优势</li>
                    </ul>
                    <p style="font-size:10px; color:#666; margin-top:5px;">
                        <b>💡 建议：</b>在实际游戏中，<span style="color:#ff4757; font-weight:bold;">不建议优先使用蒙特卡洛算法</span>。它更适合作为算法学习案例。
                    </p>
                </div>
            </div>
            
            <div style="background:#f8f9fa; padding:10px; border-radius:8px; margin-top:10px;">
                <h5 style="margin:0 0 8px 0;">📈 性能-质量平衡分析</h5>
                <div style="font-size:11px;">
                    <p>蒙特卡洛算法的理论优势：<b>多步前瞻</b>和<b>概率优化</b>。</p>
                    <p><span style="color:#ff4757; font-weight:bold;">然而在实际测试中，由于游戏机制限制，这些优势并未转化为实际效果。</span></p>
                    <p>在批量模拟中，我们做了以下平衡：</p>
                    <ol style="margin:5px 0; padding-left:15px;">
                        <li><b>减少模拟次数</b>：蒙特卡洛300次 vs 其他算法1000次</li>
                        <li><b>保持决策质量</b>：每次决策使用足够迭代（30-100次）</li>
                        <li><b>动态调整</b>：根据未开启格子数调整计算深度</li>
                        <li><b>公平对比</b>：虽然次数少，但每次决策更精确</li>
                    </ol>
                    <p style="font-size:10px; color:#666;">
                        测试结果表明，蒙特卡洛的<b>计算成本远高于收益</b>，在实际游戏中优势有限。
                    </p>
                </div>
            </div>
        `;
        
        contentDiv.innerHTML = html;
    } catch (error) {
        console.error('模拟过程中出现错误:', error);
        contentDiv.innerHTML = `<p style="color:red;">模拟过程中出现错误: ${error.message}</p>`;
    }
    }, 10);
}

function confirmReset() {
    if(confirm("确定重置吗？")){
        historyLog = [];
        state = JSON.parse(JSON.stringify(defaultData));
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY_HISTORY);
        document.getElementById('winOverlay').style.display = 'none';
        init();
    }
}

function exportHistory() {
    if (historyLog.length === 0) {
        alert("暂无操作记录，请先在网格上进行触发操作。");
        return;
    }
    const labels = ["仅当前 📍", "同列 ↕️", "同行 ↔️", "同行同列 ➕", "十字 💠", "九宫格 🍷", "全开 🌟"];
    const friendlyLogs = historyLog.map((entry, index) => {
        const step = index + 1;
        const row = entry.row + 1;
        const col = entry.col + 1;
        const eventName = (entry.type >= 1 && entry.type <= 7) ? labels[entry.type - 1] : "事件" + entry.type;
        return `第${step}步：点击了(${row},${col})，触发了${eventName}事件`;
    });
    const exportData = {
        version: "1.2",
        exportTime: new Date().toISOString(),
        totalSteps: historyLog.length,
        logs: historyLog,
        friendlyLogs: friendlyLogs
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mc_history_${new Date().toISOString().slice(0,10)}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function updateLogDisplay() {
    const labels = ["仅当前 📍", "同列 ↕️", "同行 ↔️", "同行同列 ➕", "十字 💠", "九宫格 🍷", "全开 🌟"];
    const logDisplay = document.getElementById('logDisplay');
    if (!logDisplay) return;
    if (historyLog.length === 0) {
        logDisplay.textContent = '暂无操作记录';
        requestAnimationFrame(() => {
            logDisplay.scrollTop = logDisplay.scrollHeight;
        });
        return;
    }
    const friendlyLogs = historyLog.map((entry, index) => {
        const step = index + 1;
        const row = entry.row + 1;
        const col = entry.col + 1;
        const eventName = (entry.type >= 1 && entry.type <= 7) ? labels[entry.type - 1] : "事件" + entry.type;
        return `第${step}步：点击了(${row},${col})，触发了${eventName}事件`;
    });
    logDisplay.textContent = friendlyLogs.join('\n');
    requestAnimationFrame(() => {
        logDisplay.scrollTop = logDisplay.scrollHeight;
    });
}

function undoStep() {
    const entry = historyLog.pop();
    if (!entry) {
        alert("没有可撤销的步骤");
        return;
    }
    saveHistory();
    // 恢复操作前的状态
    state.grid = entry.grid;
    state.clicks = entry.clicks;
    state.currentMisses = entry.currentMissesBefore;
    // 保存到 localStorage，这样 init() 中的 loadState() 能读到正确的状态
    saveState();
    closeMenu();
    document.getElementById('winOverlay').style.display = 'none';
    init();
}

window.onload = init;
