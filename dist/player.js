const video = document.querySelector('#video');
const audio = document.querySelector('#audio');
const playButton = document.querySelector('#playButton');
const playButtonLabel = document.querySelector('#playButtonLabel');
const audioSpeed = document.querySelector('#audioSpeed');
const videoSpeed = document.querySelector('#videoSpeed');
const audioSpeedValue = document.querySelector('#audioSpeedValue');
const videoSpeedValue = document.querySelector('#videoSpeedValue');
const lockButton = document.querySelector('#lockButton');
const lockButtonLabel = document.querySelector('#lockButtonLabel');
const resetButton = document.querySelector('#resetButton');
const status = document.querySelector('#status');

let speedsLocked = false;
let hasStartedSound = false;
let syncTimer = null;

const formatRate = (value) => `${Number(value).toFixed(2)}×`;

function setStatus(message) {
  status.textContent = message;
}

function updateRateDisplay() {
  audioSpeedValue.value = formatRate(audioSpeed.value);
  audioSpeedValue.textContent = formatRate(audioSpeed.value);
  videoSpeedValue.value = formatRate(videoSpeed.value);
  videoSpeedValue.textContent = formatRate(videoSpeed.value);
}

function applyRates() {
  audio.playbackRate = Number(audioSpeed.value);
  video.playbackRate = Number(videoSpeed.value);
  updateRateDisplay();
}

function alignAudioToVideo() {
  if (!Number.isFinite(video.currentTime) || !Number.isFinite(audio.duration) || audio.duration <= 0) return;

  const targetTime = video.currentTime % audio.duration;
  if (Math.abs(audio.currentTime - targetTime) > 0.08) audio.currentTime = targetTime;
}

function startSyncWatch() {
  window.clearInterval(syncTimer);
  if (!speedsLocked) return;

  syncTimer = window.setInterval(() => {
    if (!audio.paused && !video.paused) alignAudioToVideo();
  }, 300);
}

async function startPlayback() {
  hasStartedSound = true;
  alignAudioToVideo();

  try {
    await Promise.all([video.play(), audio.play()]);
    playButton.setAttribute('aria-pressed', 'true');
    playButtonLabel.textContent = 'Pause';
  } catch {
    hasStartedSound = false;
    playButton.setAttribute('aria-pressed', 'false');
    playButtonLabel.textContent = 'Play';
    setStatus('Select play to start the video and sound together.');
  }
}

function pausePlayback() {
  video.pause();
  audio.pause();
  playButton.setAttribute('aria-pressed', 'false');
  playButtonLabel.textContent = 'Play';
}

playButton.addEventListener('click', () => {
  if (video.paused || audio.paused) {
    startPlayback();
  } else {
    pausePlayback();
  }
});

audioSpeed.addEventListener('input', () => {
  if (speedsLocked) videoSpeed.value = audioSpeed.value;
  applyRates();
  setStatus(speedsLocked ? `Speeds locked at ${formatRate(audioSpeed.value)}.` : 'Audio speed adjusted independently.');
});

videoSpeed.addEventListener('input', () => {
  if (speedsLocked) audioSpeed.value = videoSpeed.value;
  applyRates();
  setStatus(speedsLocked ? `Speeds locked at ${formatRate(videoSpeed.value)}.` : 'Video speed adjusted independently.');
});

lockButton.addEventListener('click', () => {
  speedsLocked = !speedsLocked;
  lockButton.setAttribute('aria-pressed', String(speedsLocked));
  lockButtonLabel.textContent = speedsLocked ? 'Unlock speeds' : 'Lock speeds';

  if (speedsLocked) {
    audioSpeed.value = videoSpeed.value;
    applyRates();
    alignAudioToVideo();
    setStatus(`Speeds locked at ${formatRate(videoSpeed.value)}.`);
  } else {
    setStatus('Audio and video speeds are independent.');
  }

  startSyncWatch();
});

resetButton.addEventListener('click', () => {
  audioSpeed.value = '1';
  videoSpeed.value = '1';
  applyRates();
  video.pause();
  audio.pause();
  video.currentTime = 0;
  audio.currentTime = 0;
  hasStartedSound = false;
  playButton.setAttribute('aria-pressed', 'false');
  playButtonLabel.textContent = 'Play';
  setStatus('Reset to the beginning at 1.00×.');
});

video.addEventListener('click', () => {
  if (!hasStartedSound || video.paused || audio.paused) {
    startPlayback();
  } else {
    pausePlayback();
  }
});

video.addEventListener('play', () => {
  if (hasStartedSound && audio.paused) audio.play().catch(() => {});
});

video.addEventListener('pause', () => {
  if (!audio.paused) audio.pause();
});

video.addEventListener('seeked', () => {
  if (speedsLocked) alignAudioToVideo();
});

audio.addEventListener('ended', () => {
  audio.currentTime = 0;
  audio.play().catch(() => {});
});

applyRates();
