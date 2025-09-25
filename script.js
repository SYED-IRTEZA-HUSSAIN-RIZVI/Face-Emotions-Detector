const video = document.getElementById('video');
const videoContainer = document.getElementById('video-container');
const loader = document.getElementById('loader');
const loadingStatus = document.getElementById('loading-status');
const toggleButton = document.getElementById('toggleButton');
const snapshotButton = document.getElementById('snapshotButton');
const faceCountDisplay = document.getElementById('faceCount');
const expressionSummary = document.getElementById('expressionSummary');
const expressionList = document.getElementById('expressionList');

let detectionInterval;
let stream;

// Expression colors
const expressionColors = {
    happy: 'lime',
    sad: 'blue',
    angry: 'red',
    surprised: 'orange',
    fearful: 'purple',
    disgusted: 'brown',
    neutral: 'white'
};

// Load models
async function loadModels() {
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    try {
        loadingStatus.textContent = 'Loading Face Detector...';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        loadingStatus.textContent = 'Loading Face Landmarks...';
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        loadingStatus.textContent = 'Loading Face Recognition...';
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        loadingStatus.textContent = 'Loading Face Expressions...';
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

        loadingStatus.textContent = 'Models Loaded!';
        loader.style.display = 'none';
        toggleButton.disabled = false;
    } catch (error) {
        console.error(error);
        loadingStatus.textContent = 'Error loading models.';
    }
}

// Start camera
async function startVideo() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        videoContainer.classList.remove('hidden');
        toggleButton.textContent = 'Stop Camera';
        snapshotButton.disabled = false;
    } catch (err) {
        console.error(err);
        loadingStatus.textContent = 'Cannot access webcam.';
        loader.style.display = 'flex';
    }
}

// Stop camera
function stopVideo() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    clearInterval(detectionInterval);
    toggleButton.textContent = 'Start Camera';
    snapshotButton.disabled = true;
    faceCountDisplay.textContent = 'Faces detected: 0';
    expressionSummary.classList.add('hidden');
    const canvas = videoContainer.querySelector('canvas');
    if (canvas) canvas.remove();
}

// Toggle button
toggleButton.addEventListener('click', () => {
    if (video.srcObject) stopVideo();
    else startVideo();
});

// Snapshot button
snapshotButton.addEventListener('click', () => {
    const canvas = videoContainer.querySelector('canvas');
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = 'snapshot.png';
    link.click();
});

// Helper to resize canvas dynamically
function resizeCanvas(canvas, video) {
    const displaySize = { width: video.clientWidth, height: video.clientHeight };
    faceapi.matchDimensions(canvas, displaySize);
    return displaySize;
}

// Video detection
video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    videoContainer.append(canvas);

    let displaySize = resizeCanvas(canvas, video);

    // Resize canvas on window resize
    window.addEventListener('resize', () => {
        displaySize = resizeCanvas(canvas, video);
    });

    detectionInterval = setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length === 0) {
            faceCountDisplay.textContent = 'Faces detected: 0';
            expressionSummary.classList.add('hidden');
            return;
        }

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const expressionCounts = {};

        resizedDetections.forEach(detection => {
            const { expressions, alignedRect } = detection;
            const topExpression = Object.entries(expressions).reduce((prev, curr) => curr[1] > prev[1] ? curr : prev);
            const expression = topExpression[0];
            const color = expressionColors[expression] || 'white';

            expressionCounts[expression] = (expressionCounts[expression] || 0) + 1;

            const { x, y, width, height } = alignedRect.box;

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            ctx.font = `${Math.max(12, video.clientWidth/50)}px Arial`;
            ctx.fillStyle = color;
            ctx.fillText(expression, x + width / 2 - ctx.measureText(expression).width / 2, y - 5);
        });

        faceCountDisplay.textContent = `Faces detected: ${detections.length}`;

        expressionList.innerHTML = '';
        Object.entries(expressionCounts).forEach(([expression, count]) => {
            const li = document.createElement('li');
            li.textContent = `${expression}: ${count}`;
            expressionList.appendChild(li);
        });
        expressionSummary.classList.remove('hidden');

    }, 100);
});

// Initialize
loadModels();
