/**
 * ============================================
 * HELMET DETECTION APP - Teachable Machine Version
 * ============================================
 * This uses the standard Teachable Machine image model
 * with the webcam helper from the TM library.
 * 
 * Filename: app.js
 * Version: 2.0.0
 * ============================================
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // IMPORTANT: Point this to your model folder
    // If your model is in the same folder as index.html, use "./my_model/"
    // If it's in a subfolder, use "./path/to/your/model/"
    MODEL_PATH: "./my_model/", // <-- CHANGE THIS to your model path
    
    // Camera settings
    CAMERA_WIDTH: 200,
    CAMERA_HEIGHT: 200,
    FLIP_CAMERA: true,
    
    // Detection settings
    CONFIDENCE_THRESHOLD: 0.5,
    
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
    classLabels: []
};

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
    DOM.statusText.style.color = isError ? '#e74c3c' : '#333';
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
        setStatus('Loading model...');
        
        // Build the URLs
        const modelURL = CONFIG.MODEL_PATH + "model.json";
        const metadataURL = CONFIG.MODEL_PATH + "metadata.json";
        
        console.log('📂 Loading model from:', modelURL);
        console.log('📂 Loading metadata from:', metadataURL);
        
        // Check if path is configured
        if (CONFIG.MODEL_PATH === "./my_model/") {
            throw new Error('Please update CONFIG.MODEL_PATH to point to your model folder.');
        }
        
        // Load the model and metadata using Teachable Machine
        State.model = await tmImage.load(modelURL, metadataURL);
        State.maxPredictions = State.model.getTotalClasses();
        State.classLabels = State.model.getClassLabels();
        
        console.log('✅ Model loaded successfully!');
        console.log('📊 Classes:', State.classLabels);
        console.log('📊 Total classes:', State.maxPredictions);
        
        setStatus('✅ Model loaded! Click "Start Camera" to begin');
        DOM.predictionText.textContent = 'Ready';
        DOM.predictionText.style.backgroundColor = 'rgba(0,0,0,0.7)';
        
        return true;
    } catch (error) {
        console.error('❌ Error loading model:', error);
        setStatus(`❌ Error: ${error.message}`, true);
        DOM.predictionText.textContent = 'Error';
        return false;
    }
}

// ============================================
// CAMERA FUNCTIONS (Using Teachable Machine Webcam)
// ============================================
async function setupCamera() {
    try {
        // Use Teachable Machine's Webcam helper
        State.webcam = new tmImage.Webcam(
            CONFIG.CAMERA_WIDTH, 
            CONFIG.CAMERA_HEIGHT, 
            CONFIG.FLIP_CAMERA
        );
        
        await State.webcam.setup(); // Request camera access
        await State.webcam.play();
        
        // The TM webcam creates its own canvas, we need to append it
        // But we want to use our video element, so we'll sync them
        // Actually, let's use the TM webcam's canvas directly
        const canvas = State.webcam.canvas;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        
        // Replace the video element with the canvas
        const videoContainer = DOM.video.parentElement;
        // Remove the video element
        DOM.video.style.display = 'none';
        // Insert the canvas before the video
        videoContainer.insertBefore(canvas, DOM.video);
        // Store reference to canvas
        DOM.canvas = canvas;
        
        console.log('📷 Camera started successfully using TM Webcam');
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
        // Remove the canvas if it exists
        if (DOM.canvas && DOM.canvas.parentElement) {
            DOM.canvas.parentElement.removeChild(DOM.canvas);
        }
        // Show the video element again
        DOM.video.style.display = 'block';
        State.webcam = null;
        console.log('📷 Camera stopped');
    }
}

// ============================================
// PREDICTION FUNCTIONS (Using TM Model)
// ============================================
async function predictLoop() {
    if (!State.isRunning) return;

    try {
        // Update webcam frame
        State.webcam.update();
        
        // Predict using the TM model
        const predictions = await State.model.predict(State.webcam.canvas);
        
        // Find highest confidence prediction
        let maxPrediction = predictions[0];
        for (let i = 1; i < predictions.length; i++) {
            if (predictions[i].probability > maxPrediction.probability) {
                maxPrediction = predictions[i];
            }
        }

        const className = maxPrediction.className;
        const confidence = (maxPrediction.probability * 100).toFixed(1);
        
        // Only update if confidence is above threshold
        if (maxPrediction.probability >= CONFIG.CONFIDENCE_THRESHOLD) {
            // Update UI
            const emoji = getEmoji(className);
            const color = getColor(className);
            
            DOM.predictionText.textContent = `${emoji} ${className}`;
            DOM.predictionText.style.borderColor = color;
            DOM.predictionText.style.backgroundColor = 'rgba(0,0,0,0.8)';
            
            setStatus(`Detected: ${className}`);
            setConfidence(confidence);
            
            // Update stats only if prediction changed
            if (State.lastPrediction !== className) {
                updateStats(className);
                State.lastPrediction = className;
            }
        } else {
            DOM.predictionText.textContent = '🔍 Low confidence...';
            setStatus('Waiting for clearer detection...');
            setConfidence(null);
        }
        
        // Show all predictions
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

        // Continue loop
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
        
        // Draw the webcam canvas
        ctx.drawImage(canvas, 0, 0);
        
        // Add overlay text
        const text = DOM.predictionText.textContent;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(10, screenshotCanvas.height - 60, screenshotCanvas.width - 20, 50);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, screenshotCanvas.width / 2, screenshotCanvas.height - 25);
        
        // Download
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

    // Check if model is loaded
    if (!State.model) {
        setStatus('⏳ Loading model...');
        const loaded = await loadModel();
        if (!loaded) return;
    }

    // Setup camera
    setStatus('📷 Starting camera...');
    const cameraReady = await setupCamera();
    if (!cameraReady) return;

    // Start prediction
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 's' && e.ctrlKey) {
        e.preventDefault();
        takeScreenshot();
    }
    if (e.key === 'Enter' && !State.isRunning) {
        startDetection();
    }
    if (e.key === 'Escape' && State.isRunning) {
        stopDetection();
    }
});

// ============================================
// INITIALIZATION
// ============================================
window.addEventListener('load', async () => {
    console.log('🚀 Helmet Detection App starting...');
    console.log('📋 Configuration:', CONFIG);
    console.log('💡 Make sure your model files are in:', CONFIG.MODEL_PATH);
    
    // Check if model files exist by trying to load
    await loadModel();
    
    // Set initial state
    DOM.predictionText.textContent = 'Ready';
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
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopDetection();
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
        loadModel,
        startDetection,
        stopDetection,
        takeScreenshot,
        resetStats
    };
    console.log('🔧 Debug mode enabled. Access via window.__debug');
}

console.log('📝 Update CONFIG.MODEL_PATH to point to your Teachable Machine model folder!');