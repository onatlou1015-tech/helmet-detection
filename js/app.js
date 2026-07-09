/**
 * ============================================
 * HELMET DETECTION APP - Complete Version
 * ============================================
 * Model: Local folder "./model/"
 * Version: 2.1.0
 * ============================================
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // Model path - points to local folder
    MODEL_PATH: "./model/", // <-- Your model folder
    
    // Camera settings
    CAMERA_WIDTH: 200,
    CAMERA_HEIGHT: 200,
    FLIP_CAMERA: true,
    
    // Detection settings
    CONFIDENCE_THRESHOLD: 0.5,
    
    // Serial settings
    SERIAL: {
        ENABLED: true,
        BAUD_RATE: 9600,
        DATA_FORMAT: 'json', // 'json' or 'simple'
        SEND_INTERVAL: 500 // milliseconds between sends
    },
    
    // Color coding for different classes
    COLORS: {
        helmet: '#2ecc71',
        noHelmet: '#e74c3c',
        noPerson: '#95a5a6',
        default: '#667eea'
    }
};

// ============================================
// DOM REFERENCES
// ============================================
const DOM = {
    video: document.getElementById('webcam'),
    predictionText: document.getElementById('predictionText'),
    statusText: document.getElementById('statusText'),
    confidenceText: document.getElementById('confidenceText'),
    predictionDetails: document.getElementById('predictionDetails'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    screenshotBtn: document.getElementById('screenshotBtn'),
    resetStatsBtn: document.getElementById('resetStatsBtn'),
    serialConnectBtn: document.getElementById('serialConnectBtn'),
    serialStatus: document.getElementById('serialStatus'),
    totalDetections: document.getElementById('totalDetections'),
    helmetCount: document.getElementById('helmetCount'),
    noHelmetCount: document.getElementById('noHelmetCount'),
    noPersonCount: document.getElementById('noPersonCount')
};

// ============================================
// STATE
// ============================================
const State = {
    model: null,
    webcam: null,
    maxPredictions: 0,
    isRunning: false,
    animationId: null,
    stats: {
        total: 0,
        helmet: 0,
        noHelmet: 0,
        noPerson: 0
    },
    lastPrediction: null,
    classLabels: [],
    lastSendTime: 0,
    lastSentData: null
};

// ============================================
// SERIAL COMMUNICATION
// ============================================
class SerialManager {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.isOpen = false;
        this.onDataReceived = null;
    }

    async connect() {
        try {
            if (!('serial' in navigator)) {
                throw new Error('Web Serial API not supported. Please use Chrome or Edge.');
            }

            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: CONFIG.SERIAL.BAUD_RATE });

            const textEncoder = new TextEncoderStream();
            this.writer = textEncoder.writable.getWriter();
            
            const textDecoder = new TextDecoderStream();
            this.reader = textDecoder.readable.getReader();
            
            this.port.readable.pipeTo(textDecoder.writable);
            textEncoder.readable.pipeTo(this.port.writable);
            
            this.isConnected = true;
            this.isOpen = true;
            
            console.log('✅ Serial connection established');
            this.updateStatus('Connected', true);
            
            this.readData();
            return true;
        } catch (error) {
            console.error('❌ Serial connection error:', error);
            this.updateStatus('Connection failed', false);
            this.isConnected = false;
            this.isOpen = false;
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.writer) {
                await this.writer.close();
                this.writer = null;
            }
            if (this.reader) {
                await this.reader.cancel();
                this.reader = null;
            }
            if (this.port && this.port.readable) {
                await this.port.close();
            }
            this.isConnected = false;
            this.isOpen = false;
            this.updateStatus('Disconnected', false);
            console.log('🔌 Serial disconnected');
        } catch (error) {
            console.error('❌ Error disconnecting:', error);
        }
    }

    async readData() {
        try {
            while (this.isOpen && this.reader) {
                const { value, done } = await this.reader.read();
                if (done) break;
                if (value && this.onDataReceived) {
                    this.onDataReceived(value);
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('❌ Serial read error:', error);
            }
        }
    }

    async sendData(data) {
        if (!this.isConnected || !this.writer) {
            return false;
        }

        try {
            let message = '';
            if (CONFIG.SERIAL.DATA_FORMAT === 'json') {
                message = JSON.stringify(data) + '\n';
            } else {
                const status = data.className.toLowerCase().includes('helmet') ? 1 : 
                              data.className.toLowerCase().includes('no helmet') ? 0 : -1;
                message = `${data.className},${data.confidence},${status}\n`;
            }
            
            await this.writer.write(message);
            console.log('📤 Serial sent:', message.trim());
            return true;
        } catch (error) {
            console.error('❌ Serial send error:', error);
            return false;
        }
    }

    updateStatus(text, connected) {
        if (DOM.serialStatus) {
            DOM.serialStatus.textContent = `Serial: ${text}`;
            DOM.serialStatus.className = `serial-status ${connected ? 'connected' : 'disconnected'}`;
        }
        if (DOM.serialConnectBtn) {
            DOM.serialConnectBtn.className = `btn btn-serial ${connected ? 'connected' : 'disconnected'}`;
            DOM.serialConnectBtn.innerHTML = connected ? 
                '<span class="icon">🔌</span> Disconnect Serial' : 
                '<span class="icon">🔌</span> Connect Serial';
        }
    }
}

// Initialize serial manager
const serialManager = new SerialManager();

// ============================================
// UTILITY FUNCTIONS
// ============================================
function getEmoji(className) {
    const lower = className.toLowerCase();
    if (lower.includes('helmet') || lower.includes('with')) return '🪖';
    if (lower.includes('no helmet') || lower.includes('without')) return '⚠️';
    if (lower.includes('no person') || lower.includes('none') || lower.includes('empty')) return '🚫';
    return '👤';
}

function getColor(className) {
    const lower = className.toLowerCase();
    if (lower.includes('helmet') || lower.includes('with')) return CONFIG.COLORS.helmet;
    if (lower.includes('no helmet') || lower.includes('without')) return CONFIG.COLORS.noHelmet;
    if (lower.includes('no person') || lower.includes('none') || lower.includes('empty')) return CONFIG.COLORS.noPerson;
    return CONFIG.COLORS.default;
}

function updateStats(className) {
    State.stats.total++;
    DOM.totalDetections.textContent = State.stats.total;
    
    const lower = className.toLowerCase();
    if (lower.includes('helmet') || lower.includes('with')) {
        State.stats.helmet++;
        DOM.helmetCount.textContent = State.stats.helmet;
    } else if (lower.includes('no helmet') || lower.includes('without')) {
        State.stats.noHelmet++;
        DOM.noHelmetCount.textContent = State.stats.noHelmet;
    } else if (lower.includes('no person') || lower.includes('none') || lower.includes('empty')) {
        State.stats.noPerson++;
        DOM.noPersonCount.textContent = State.stats.noPerson;
    }
}

function setStatus(message, isError = false) {
    DOM.statusText.textContent = message;
    DOM.statusText.className = `status-text${isError ? ' error' : ''}`;
}

function setConfidence(confidence) {
    DOM.confidenceText.textContent = confidence ? `${confidence}%` : '--';
}

function showLoading() {
    DOM.statusText.innerHTML = '<span class="loading"></span>Loading...';
}

// ============================================
// TEACHABLE MACHINE MODEL FUNCTIONS
// ============================================
async function loadModel() {
    try {
        showLoading();
        setStatus('Loading model from local folder...');
        DOM.predictionText.textContent = '⏳ Loading...';
        
        // Build the URLs for local model files
        const modelURL = CONFIG.MODEL_PATH + "model.json";
        const metadataURL = CONFIG.MODEL_PATH + "metadata.json";
        
        console.log('📂 Loading model from:', modelURL);
        console.log('📂 Loading metadata from:', metadataURL);
        
        // Check if model path is configured correctly
        if (CONFIG.MODEL_PATH === "./model/") {
            // Check if model files exist by trying to fetch them
            try {
                const response = await fetch(modelURL);
                if (!response.ok) {
                    throw new Error(`Model file not found at ${modelURL}. Please make sure your model files are in the "model" folder.`);
                }
            } catch (fetchError) {
                throw new Error(`Cannot access model files. Please ensure the "model" folder contains model.json and metadata.json files. Error: ${fetchError.message}`);
            }
        }
        
        // Load the model and metadata using Teachable Machine
        State.model = await tmImage.load(modelURL, metadataURL);
        State.maxPredictions = State.model.getTotalClasses();
        State.classLabels = State.model.getClassLabels();
        
        console.log('✅ Model loaded successfully!');
        console.log('📊 Classes:', State.classLabels);
        console.log('📊 Total classes:', State.maxPredictions);
        
        setStatus('✅ Model loaded! Click "Start Camera" to begin');
        DOM.predictionText.textContent = '✅ Ready';
        
        return true;
    } catch (error) {
        console.error('❌ Error loading model:', error);
        setStatus(`❌ Error: ${error.message}`, true);
        DOM.predictionText.textContent = '❌ Error';
        return false;
    }
}

// ============================================
// CAMERA FUNCTIONS
// ============================================
async function setupCamera() {
    try {
        State.webcam = new tmImage.Webcam(
            CONFIG.CAMERA_WIDTH, 
            CONFIG.CAMERA_HEIGHT, 
            CONFIG.FLIP_CAMERA
        );
        
        await State.webcam.setup();
        await State.webcam.play();
        
        const canvas = State.webcam.canvas;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'cover';
        canvas.style.display = 'block';
        
        const videoContainer = DOM.video.parentElement;
        DOM.video.style.display = 'none';
        videoContainer.insertBefore(canvas, DOM.video);
        DOM.canvas = canvas;
        
        console.log('📷 Camera started successfully');
        return true;
    } catch (error) {
        console.error('❌ Camera error:', error);
        setStatus('❌ Cannot access camera. Please allow camera permissions.', true);
        return false;
    }
}

function stopCamera() {
    if (State.webcam) {
        State.webcam.stop();
        if (DOM.canvas && DOM.canvas.parentElement) {
            DOM.canvas.parentElement.removeChild(DOM.canvas);
        }
        DOM.video.style.display = 'block';
        State.webcam = null;
        console.log('📷 Camera stopped');
    }
}

// ============================================
// SERIAL COMMUNICATION FUNCTIONS
// ============================================
async function connectSerial() {
    try {
        if (serialManager.isConnected) {
            await serialManager.disconnect();
            return;
        }
        
        DOM.serialConnectBtn.textContent = '⏳ Connecting...';
        DOM.serialConnectBtn.disabled = true;
        
        await serialManager.connect();
        
        DOM.serialConnectBtn.disabled = false;
        
        // Set up serial data received callback
        serialManager.onDataReceived = (data) => {
            console.log('📥 Serial received:', data);
            // You can process incoming serial data here
        };
        
    } catch (error) {
        console.error('❌ Failed to connect serial:', error);
        DOM.serialConnectBtn.textContent = '🔌 Connect Serial';
        DOM.serialConnectBtn.disabled = false;
        alert(`Failed to connect to serial device: ${error.message}`);
    }
}

async function sendToSerial(className, confidence) {
    if (!CONFIG.SERIAL.ENABLED || !serialManager.isConnected) {
        return;
    }

    const now = Date.now();
    if (now - State.lastSendTime < CONFIG.SERIAL.SEND_INTERVAL) {
        return;
    }

    const data = {
        timestamp: new Date().toISOString(),
        className: className,
        confidence: parseFloat(confidence),
        confidencePercent: `${confidence}%`,
        helmetDetected: className.toLowerCase().includes('helmet'),
        noHelmetDetected: className.toLowerCase().includes('no helmet'),
        stats: {
            total: State.stats.total,
            helmet: State.stats.helmet,
            noHelmet: State.stats.noHelmet,
            noPerson: State.stats.noPerson
        }
    };

    const dataString = JSON.stringify(data);
    if (dataString !== State.lastSentData) {
        await serialManager.sendData(data);
        State.lastSentData = dataString;
        State.lastSendTime = now;
    }
}

// ============================================
// PREDICTION FUNCTIONS
// ============================================
async function predictLoop() {
    if (!State.isRunning) return;

    try {
        State.webcam.update();
        
        const predictions = await State.model.predict(State.webcam.canvas);
        
        let maxPrediction = predictions[0];
        for (let i = 1; i < predictions.length; i++) {
            if (predictions[i].probability > maxPrediction.probability) {
                maxPrediction = predictions[i];
            }
        }

        const className = maxPrediction.className;
        const confidence = (maxPrediction.probability * 100).toFixed(1);
        
        if (maxPrediction.probability >= CONFIG.CONFIDENCE_THRESHOLD) {
            const emoji = getEmoji(className);
            const color = getColor(className);
            
            DOM.predictionText.textContent = `${emoji} ${className}`;
            DOM.predictionText.style.borderColor = color;
            DOM.predictionText.style.backgroundColor = 'rgba(0,0,0,0.8)';
            
            setStatus(`Detected: ${className}`);
            setConfidence(confidence);
            
            if (State.lastPrediction !== className) {
                updateStats(className);
                State.lastPrediction = className;
                await sendToSerial(className, confidence);
            }
        } else {
            DOM.predictionText.textContent = '🔍 Low confidence...';
            setStatus('Waiting for clearer detection...');
            setConfidence(null);
        }
        
        let detailsHTML = '';
        predictions.forEach((pred) => {
            const prob = (pred.probability * 100).toFixed(1);
            const label = pred.className;
            detailsHTML += `
                <div class="prediction-item">
                    <span class="label">${label}:</span>
                    <span class="value">${prob}%</span>
                </div>
            `;
        });
        DOM.predictionDetails.innerHTML = detailsHTML;

        State.animationId = requestAnimationFrame(predictLoop);
    } catch (error) {
        console.error('❌ Prediction error:', error);
        if (State.isRunning) {
            State.animationId = requestAnimationFrame(predictLoop);
        }
    }
}

// ============================================
// SCREENSHOT FUNCTION
// ============================================
function takeScreenshot() {
    if (!State.isRunning || !State.webcam) {
        setStatus('⚠️ Start camera first to take screenshot', true);
        return;
    }

    try {
        const canvas = State.webcam.canvas;
        const screenshotCanvas = document.createElement('canvas');
        screenshotCanvas.width = canvas.width;
        screenshotCanvas.height = canvas.height;
        const ctx = screenshotCanvas.getContext('2d');
        
        ctx.drawImage(canvas, 0, 0);
        
        const text = DOM.predictionText.textContent;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(10, screenshotCanvas.height - 60, screenshotCanvas.width - 20, 50);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, screenshotCanvas.width / 2, screenshotCanvas.height - 25);
        
        const link = document.createElement('a');
        link.download = `helmet-detection-${Date.now()}.png`;
        link.href = screenshotCanvas.toDataURL('image/png');
        link.click();
        
        setStatus('📸 Screenshot saved!');
    } catch (error) {
        console.error('❌ Screenshot error:', error);
        setStatus('❌ Failed to take screenshot', true);
    }
}

// ============================================
// START / STOP FUNCTIONS
// ============================================
async function startDetection() {
    if (State.isRunning) {
        console.log('⚠️ Detection already running');
        return;
    }

    if (!State.model) {
        setStatus('⏳ Loading model...');
        const loaded = await loadModel();
        if (!loaded) return;
    }

    setStatus('📷 Starting camera...');
    const cameraReady = await setupCamera();
    if (!cameraReady) return;

    State.isRunning = true;
    State.lastPrediction = null;
    DOM.startBtn.textContent = '⏳ Running...';
    DOM.startBtn.disabled = true;
    
    setStatus('🔍 Detecting...');
    DOM.predictionText.textContent = '🔍 Scanning...';
    
    predictLoop();
    console.log('▶️ Detection started');
}

function stopDetection() {
    State.isRunning = false;
    
    if (State.animationId) {
        cancelAnimationFrame(State.animationId);
        State.animationId = null;
    }
    
    stopCamera();
    
    DOM.predictionText.textContent = '⏹ Stopped';
    DOM.predictionText.style.borderColor = '#95a5a6';
    setStatus('⏹ Camera stopped');
    setConfidence(null);
    DOM.predictionDetails.innerHTML = `
        <div class="prediction-item placeholder">
            <span class="label">Detection paused</span>
        </div>
    `;
    DOM.startBtn.textContent = '▶ Start Camera';
    DOM.startBtn.disabled = false;
    
    console.log('⏹ Detection stopped');
}

// ============================================
// RESET STATS
// ============================================
function resetStats() {
    State.stats = { total: 0, helmet: 0, noHelmet: 0, noPerson: 0 };
    DOM.totalDetections.textContent = '0';
    DOM.helmetCount.textContent = '0';
    DOM.noHelmetCount.textContent = '0';
    DOM.noPersonCount.textContent = '0';
    State.lastPrediction = null;
    setStatus('📊 Stats reset');
}

// ============================================
// EVENT LISTENERS
// ============================================
DOM.startBtn.addEventListener('click', startDetection);
DOM.stopBtn.addEventListener('click', stopDetection);
DOM.screenshotBtn.addEventListener('click', takeScreenshot);
DOM.resetStatsBtn.addEventListener('click', resetStats);
DOM.serialConnectBtn.addEventListener('click', connectSerial);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        takeScreenshot();
    }
    if (e.key === 'Enter' && !State.isRunning) {
        e.preventDefault();
        startDetection();
    }
    if (e.key === 'Escape' && State.isRunning) {
        e.preventDefault();
        stopDetection();
    }
    if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        connectSerial();
    }
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetStats();
    }
});

// ============================================
// INITIALIZATION
// ============================================
window.addEventListener('load', async () => {
    console.log('🚀 Helmet Detection App starting...');
    console.log('📋 Configuration:', CONFIG);
    console.log('💡 Model path:', CONFIG.MODEL_PATH);
    console.log('📁 Make sure your model files are in the "model" folder');
    
    if ('serial' in navigator) {
        console.log('✅ Web Serial API is supported');
    } else {
        console.warn('⚠️ Web Serial API not supported. Use Chrome or Edge.');
        DOM.serialConnectBtn.style.opacity = '0.5';
        DOM.serialConnectBtn.title = 'Web Serial API not supported';
    }
    
    // Load the model
    await loadModel();
    
    // Set initial state
    DOM.predictionText.textContent = '✅ Ready';
    DOM.predictionText.style.backgroundColor = 'rgba(0,0,0,0.7)';
    DOM.predictionDetails.innerHTML = `
        <div class="prediction-item placeholder">
            <span class="label">Press "Start Camera" to begin detection</span>
        </div>
    `;
    
    console.log('✅ App initialized successfully');
    console.log('💡 Tips:');
    console.log('   - Press Enter to start detection');
    console.log('   - Press Escape to stop');
    console.log('   - Press Ctrl+S to take screenshot');
    console.log('   - Press Ctrl+C to connect/disconnect serial');
    console.log('   - Press Ctrl+R to reset stats');
    console.log('   - Serial data format:', CONFIG.SERIAL.DATA_FORMAT);
});

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
    stopDetection();
    if (serialManager.isConnected) {
        await serialManager.disconnect();
    }
    console.log('🧹 Cleanup completed');
});

// Handle errors
window.addEventListener('error', (e) => {
    console.error('❌ Unhandled error:', e);
    setStatus('❌ An error occurred. Check console for details.', true);
});

// ============================================
// EXPOSE FOR DEBUGGING
// ============================================
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.__debug = {
        CONFIG,
        State,
        DOM,
        serialManager,
        loadModel,
        startDetection,
        stopDetection,
        takeScreenshot,
        resetStats,
        connectSerial,
        sendToSerial
    };
    console.log('🔧 Debug mode enabled. Access via window.__debug');
}

console.log('📝 Make sure your model files are in the "model" folder:');
console.log('   - model/model.json');
console.log('   - model/metadata.json');
console.log('   - model/weights.bin (or other weight files)');