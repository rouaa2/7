// --- DOM 元素 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const startButton = document.getElementById('startButton');
const gameOverMessage = document.getElementById('gameOverMessage');

// --- 遊戲常數 ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // 方塊像素大小
const EMPTY_COLOR = '#000'; // 遊戲區背景色
const PIECE_COLORS = [
    null, // 索引 0 不使用
    'cyan',   // I
    'blue',   // J
    'orange', // L
    'yellow', // O
    'lime',   // S
    'purple', // T
    'red'     // Z
];
// 定義方塊形狀 (僅基本旋轉)
// 每個方塊用數字索引代表顏色，0 代表空格
const TETROMINOES = {
    'I': { colorIndex: 1, shapes: [[[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], [[0,1,0,0], [0,1,0,0], [0,1,0,0], [0,1,0,0]]] }, // 簡化 I 的旋轉
    'J': { colorIndex: 2, shapes: [[[2,0,0], [2,2,2], [0,0,0]], [[0,2,2], [0,2,0], [0,2,0]], [[0,0,0], [2,2,2], [0,0,2]], [[0,2,0], [0,2,0], [2,2,0]]] },
    'L': { colorIndex: 3, shapes: [[[0,0,3], [3,3,3], [0,0,0]], [[0,3,0], [0,3,0], [0,3,3]], [[0,0,0], [3,3,3], [3,0,0]], [[3,3,0], [0,3,0], [0,3,0]]] },
    'O': { colorIndex: 4, shapes: [[[4,4], [4,4]]] }, // O 不旋轉
    'S': { colorIndex: 5, shapes: [[[0,5,5], [5,5,0], [0,0,0]], [[0,5,0], [0,5,5], [0,0,5]]] }, // 簡化 S 的旋轉
    'T': { colorIndex: 6, shapes: [[[0,6,0], [6,6,6], [0,0,0]], [[0,6,0], [0,6,6], [0,6,0]], [[0,0,0], [6,6,6], [0,6,0]], [[0,6,0], [6,6,0], [0,6,0]]] },
    'Z': { colorIndex: 7, shapes: [[[7,7,0], [0,7,7], [0,0,0]], [[0,0,7], [0,7,7], [0,7,0]]] }  // 簡化 Z 的旋轉
};
const PIECE_KEYS = Object.keys(TETROMINOES); // ['I', 'J', 'L', ...]

// --- 遊戲狀態變數 ---
let board;
let currentPiece;
let score;
let level;
let lines;
let isGameOver;
let gameLoopInterval;
let dropSpeed;

// --- 初始化畫布尺寸 ---
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

// --- Helper Functions ---

// 繪製單一方塊
function drawSquare(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = '#555'; // 方塊邊框顏色
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// 建立空的遊戲板
function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// 繪製整個遊戲板 (背景和已固定的方塊)
function drawBoard() {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            drawSquare(x, y, board[y][x] === 0 ? EMPTY_COLOR : PIECE_COLORS[board[y][x]]);
        }
    }
}

// 繪製當前活動的方塊
function drawPiece() {
    const shapeInfo = TETROMINOES[currentPiece.key];
    const shape = shapeInfo.shapes[currentPiece.rotation];
    const color = PIECE_COLORS[shapeInfo.colorIndex];

    shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                // 只繪製在畫布內的方塊部分 (避免剛生成時繪製到上方外面)
                if (currentPiece.y + y >= 0) {
                     drawSquare(currentPiece.x + x, currentPiece.y + y, color);
                }
            }
        });
    });
}

// 隨機選擇一個方塊類型
function getRandomPieceKey() {
    return PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
}

// 產生新的方塊在頂部
function spawnPiece() {
    const key = getRandomPieceKey();
    const shapeInfo = TETROMINOES[key];
    currentPiece = {
        key: key,
        x: Math.floor(COLS / 2) - Math.ceil(shapeInfo.shapes[0][0].length / 2), // 中心偏左生成
        y: 0, // 從頂部開始 (有時會用 -1 或 -2 讓方塊完全在畫面外生成再落下)
        rotation: 0
    };

    // 檢查是否一生成就碰撞 (Game Over)
    if (!isValidMove(currentPiece.x, currentPiece.y, shapeInfo.shapes[currentPiece.rotation])) {
        gameOver();
    }
}

// 檢查移動或旋轉是否有效
function isValidMove(newX, newY, shape) {
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x] !== 0) {
                const boardX = newX + x;
                const boardY = newY + y;

                // 檢查邊界
                if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
                    return false;
                }
                // 檢查與固定方塊的碰撞 (確保 boardY >= 0)
                if (boardY >= 0 && board[boardY][boardX] !== 0) {
                    return false;
                }
            }
        }
    }
    return true;
}

// 旋轉方塊
function rotatePiece() {
    if (isGameOver || !currentPiece) return;

    const shapeInfo = TETROMINOES[currentPiece.key];
    let nextRotation = (currentPiece.rotation + 1) % shapeInfo.shapes.length;
    let nextShape = shapeInfo.shapes[nextRotation];

    // 檢查旋轉後是否有效
    if (isValidMove(currentPiece.x, currentPiece.y, nextShape)) {
        currentPiece.rotation = nextRotation;
    }
    // (可選) 在這裡可以加入簡單的牆壁踢回邏輯，如果基礎旋轉失敗，嘗試左右移動一格再旋轉
    // else { try simple kicks... }
    drawGame(); // 重繪畫面
}

// 移動方塊
function movePiece(dx, dy) {
    if (isGameOver || !currentPiece) return false;

    const shapeInfo = TETROMINOES[currentPiece.key];
    const shape = shapeInfo.shapes[currentPiece.rotation];
    const newX = currentPiece.x + dx;
    const newY = currentPiece.y + dy;

    if (isValidMove(newX, newY, shape)) {
        currentPiece.x = newX;
        currentPiece.y = newY;
        drawGame(); // 移動後重繪
        return true; // 移動成功
    }
    return false; // 移動失敗
}

// 將方塊固定到遊戲板上
function lockPiece() {
    const shapeInfo = TETROMINOES[currentPiece.key];
    const shape = shapeInfo.shapes[currentPiece.rotation];
    const colorIndex = shapeInfo.colorIndex;

    shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                 // 確保只鎖定在遊戲板內的方塊
                if (currentPiece.y + y >= 0) {
                   board[currentPiece.y + y][currentPiece.x + x] = colorIndex;
                }
            }
        });
    });

    // 檢查並清除行
    clearLines();

    // 產生下一個方塊
    spawnPiece();
}

// 檢查並清除已滿的行
function clearLines() {
    let linesClearedCount = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
        // 檢查該行是否全滿
        if (board[y].every(cell => cell !== 0)) {
            linesClearedCount++;
            // 移除該行
            board.splice(y, 1);
            // 在頂部加入新的空行
            board.unshift(Array(COLS).fill(0));
            // 因為移除了行，需要重新檢查同一行 (y 不變，因為上面的行掉下來了)
            y++; // 抵銷 for 循環的 y--
        }
    }

    if (linesClearedCount > 0) {
        updateScoreAndLevel(linesClearedCount);
    }
}

// 更新分數和等級
function updateScoreAndLevel(clearedCount) {
    // 基本計分規則 (可自訂)
    const lineScores = [0, 100, 300, 500, 800]; // 0, 1, 2, 3, 4 行的分數
    score += lineScores[clearedCount] * level;
    lines += clearedCount;

    // 更新等級 (例如每 10 行升一級)
    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel > level) {
        level = newLevel;
        // 加快遊戲速度
        clearInterval(gameLoopInterval);
        dropSpeed = Math.max(100, 1000 - (level - 1) * 75); // 速度有下限，每次升級減少 75ms
        gameLoopInterval = setInterval(gameLoop, dropSpeed);
    }

    // 更新顯示
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;
}

// 硬降 (直接到底)
function hardDrop() {
    if (isGameOver || !currentPiece) return;
    // 持續向下移動直到無法移動
    while (movePiece(0, 1)) {
        // 空循環，移動邏輯在 movePiece 內完成
    }
    // 鎖定方塊
    lockPiece();
}

// 遊戲主循環
function gameLoop() {
    if (isGameOver) return;

    // 嘗試向下移動
    if (!movePiece(0, 1)) {
        // 如果無法向下移動，鎖定方塊
        // 這裡可以添加鎖定延遲 (Lock Delay) 以獲得更好的體驗，但基礎版省略
        lockPiece();
    }
    // 注意: 移動和鎖定函數會調用 drawGame(), 理論上這裡不需要再畫
    // 但如果沒有鎖定延遲，立即重繪可以確保畫面最新
    // drawGame(); // 可以視情況移除或保留
}

// 繪製整個遊戲畫面 (背景 + 固定方塊 + 活動方塊)
function drawGame() {
     if (isGameOver) return; // 遊戲結束後不再重繪活動方塊
    // 1. 繪製背景和固定方塊
    drawBoard();
    // 2. 繪製當前活動方塊
    if (currentPiece) {
        drawPiece();
    }
     // 3. (可選) 繪製 Ghost Piece
}

// 遊戲結束處理
function gameOver() {
    isGameOver = true;
    clearInterval(gameLoopInterval);
    gameOverMessage.style.display = 'block'; // 顯示 Game Over 訊息
    console.log(`遊戲結束！ 分數: ${score}, 等級: ${level}, 行數: ${lines}`);
}

// 開始遊戲初始化
function startGame() {
    // 初始化遊戲狀態
    board = createEmptyBoard();
    score = 0;
    level = 1;
    lines = 0;
    dropSpeed = 1000; // 初始速度 1 秒
    isGameOver = false;
    gameOverMessage.style.display = 'none'; // 隱藏 Game Over 訊息

    // 更新介面
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;

    // 產生第一個方塊
    spawnPiece();

    // 開始遊戲循環
    clearInterval(gameLoopInterval); // 清除可能存在的舊計時器
    gameLoopInterval = setInterval(gameLoop, dropSpeed);

    // 初始繪製
    drawGame();
}

// --- 事件監聽 ---
document.addEventListener('keydown', (event) => {
    if (isGameOver) return;

    switch (event.key) {
        case 'ArrowLeft':
            movePiece(-1, 0);
            break;
        case 'ArrowRight':
            movePiece(1, 0);
            break;
        case 'ArrowDown':
            // 加速下降
            if (movePiece(0, 1)) {
                 // 如果成功下降，可以選擇重置計時器，讓軟降更流暢
                 // clearInterval(gameLoopInterval);
                 // gameLoopInterval = setInterval(gameLoop, dropSpeed);
            } else {
                // 如果軟降到底了，直接鎖定（可選）
                // lockPiece();
            }
            break;
        case 'ArrowUp':
            rotatePiece();
            break;
        case ' ': // 空格鍵硬降
            event.preventDefault(); // 防止頁面滾動
            hardDrop();
            break;
        // 可以添加其他按鍵，如 'z' 逆時針旋轉等
    }
});

startButton.addEventListener('click', startGame);

// --- 初始顯示 ---
// 頁面載入時繪製一個空的遊戲板
board = createEmptyBoard(); // 需要先有 board 才能畫
drawBoard();