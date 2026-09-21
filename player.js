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
let lockedSpeedOffset = 0;
let audioContext = null;
let audioBuffer = null;
let audioBufferPromise = null;
let audioSource = null;
let audioOffset = 0;
let audioStartedAt = 0;
let audioRate = 1;
let tapeAudioIsPlaying = false;
let useElementFallback = false;

audio.dataset.playbackState = 'paused';

const formatRate = (value) => `${Number(value).toFixed(2)}×`;
const minimumRate = Number(audioSpeed.min);
const maximumRate = Number(audioSpeed.max);

function clampRate(value) {
  return Math.min(maximumRate, Math.max(minimumRate, value));
}

function setLockedRatesFromAudio(value) {
  let nextAudioRate = Number(value);
  let nextVideoRate = nextAudioRate + lockedSpeedOffset;

  if (nextVideoRate > maximumRate) {
    nextVideoRate = maximumRate;
    nextAudioRate = maximumRate - lockedSpeedOffset;
  } else if (nextVideoRate < minimumRate) {
    nextVideoRate = minimumRate;
    nextAudioRate = minimumRate - lockedSpeedOffset;
  }

  audioSpeed.value = String(clampRate(nextAudioRate));
  videoSpeed.value = String(clampRate(nextVideoRate));
}

function setLockedRatesFromVideo(value) {
  let nextVideoRate = Number(value);
  let nextAudioRate = nextVideoRate - lockedSpeedOffset;

  if (nextAudioRate > maximumRate) {
    nextAudioRate = maximumRate;
    nextVideoRate = maximumRate + lockedSpeedOffset;
  } else if (nextAudioRate < minimumRate) {
    nextAudioRate = minimumRate;
    nextVideoRate = minimumRate + lockedSpeedOffset;
  }

  audioSpeed.value = String(clampRate(nextAudioRate));
  videoSpeed.value = String(clampRate(nextVideoRate));
}

function getLockedStatus() {
  return `Speeds locked: audio ${formatRate(audioSpeed.value)}, video ${formatRate(videoSpeed.value)}.`;
}

function setStatus(message) {
  status.textContent = message;
}

function updatePlaybackButton(isPlaying) {
  playButton.setAttribute('aria-pressed', String(isPlaying));
  playButtonLabel.textContent = isPlaying ? 'Pause' : 'Play';
}

function updateRateDisplay() {
  audioSpeedValue.value = formatRate(audioSpeed.value);
  audioSpeedValue.textContent = formatRate(audioSpeed.value);
  videoSpeedValue.value = formatRate(videoSpeed.value);
  videoSpeedValue.textContent = formatRate(videoSpeed.value);
}

async function ensureTapeAudio() {
  if (audioBuffer || useElementFallback) return;
  if (audioBufferPromise) return audioBufferPromise;

  audioBufferPromise = (async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is unavailable.');

      audioContext = new AudioContextClass();
      const response = await fetch(audio.currentSrc || audio.src);
      if (!response.ok) throw new Error('The soundtrack could not be loaded.');

      audioBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
      audio.dataset.engine = 'webaudio-varispeed';
    } catch {
      useElementFallback = true;
      audio.dataset.engine = 'media-element';
      audio.preservesPitch = false;
      if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = false;
    }
  })();

  return audioBufferPromise;
}

function getTapeAudioDuration() {
  return useElementFallback ? audio.duration : audioBuffer?.duration;
}

function getTapeAudioTime() {
  if (useElementFallback) return audio.currentTime;
  if (!audioBuffer) return audioOffset;

  const elapsed = tapeAudioIsPlaying ? (audioContext.currentTime - audioStartedAt) * audioRate : 0;
  return (audioOffset + elapsed) % audioBuffer.duration;
}

function stopBufferSource(preservePosition = true) {
  if (!audioSource) {
    tapeAudioIsPlaying = false;
    audio.dataset.playbackState = 'paused';
    return;
  }

  if (preservePosition) audioOffset = getTapeAudioTime();
  audioSource.onended = null;
  audioSource.stop();
  audioSource.disconnect();
  audioSource = null;
  tapeAudioIsPlaying = false;
  audio.dataset.playbackState = 'paused';
}

function startBufferSource() {
  if (!audioBuffer || !audioContext) return;

  stopBufferSource(false);
  audioOffset %= audioBuffer.duration;
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.loop = true;
  audioSource.playbackRate.value = audioRate;
  audioSource.connect(audioContext.destination);
  audioStartedAt = audioContext.currentTime;
  audioSource.start(0, audioOffset);
  tapeAudioIsPlaying = true;
  audio.dataset.playbackState = 'playing';
}

async function playTapeAudio() {
  await ensureTapeAudio();

  if (useElementFallback) {
    audio.playbackRate = audioRate;
    await audio.play();
    audio.dataset.playbackState = 'playing';
    return;
  }

  await audioContext.resume();
  if (!tapeAudioIsPlaying) startBufferSource();
}

function pauseTapeAudio() {
  if (useElementFallback) {
    audio.pause();
    audio.dataset.playbackState = 'paused';
    return;
  }

  stopBufferSource(true);
}

function isTapeAudioPaused() {
  return useElementFallback ? audio.paused : !tapeAudioIsPlaying;
}

function seekTapeAudio(time) {
  const duration = getTapeAudioDuration();
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return;

  const nextOffset = ((time % duration) + duration) % duration;
  if (useElementFallback) {
    audio.currentTime = nextOffset;
    return;
  }

  const wasPlaying = tapeAudioIsPlaying;
  stopBufferSource(false);
  audioOffset = nextOffset;
  if (wasPlaying) startBufferSource();
}

function setTapeAudioRate(rate) {
  if (rate === audioRate) {
    if (useElementFallback) audio.playbackRate = rate;
    return;
  }

  if (useElementFallback) {
    audioRate = rate;
    audio.playbackRate = rate;
    return;
  }

  const wasPlaying = tapeAudioIsPlaying;
  if (wasPlaying) stopBufferSource(true);
  audioRate = rate;
  if (wasPlaying) startBufferSource();
}

function applyRates() {
  setTapeAudioRate(Number(audioSpeed.value));
  video.playbackRate = Number(videoSpeed.value);
  updateRateDisplay();
}

async function startPlayback() {
  const shouldAlignFromVideo = !hasStartedSound;
  hasStartedSound = true;

  try {
    await ensureTapeAudio();
    if (audioContext) await audioContext.resume();
    if (shouldAlignFromVideo) seekTapeAudio(video.currentTime);
    await Promise.all([video.play(), playTapeAudio()]);
    updatePlaybackButton(true);
  } catch {
    hasStartedSound = false;
    video.pause();
    pauseTapeAudio();
    updatePlaybackButton(false);
    setStatus('Select play to start the video and sound together.');
  }
}

function pausePlayback() {
  video.pause();
  pauseTapeAudio();
  updatePlaybackButton(false);
}

playButton.addEventListener('click', () => {
  if (video.paused || isTapeAudioPaused()) {
    startPlayback();
  } else {
    pausePlayback();
  }
});

audioSpeed.addEventListener('input', () => {
  if (speedsLocked) setLockedRatesFromAudio(audioSpeed.value);
  applyRates();
  setStatus(speedsLocked ? getLockedStatus() : 'Audio speed adjusted independently.');
});

videoSpeed.addEventListener('input', () => {
  if (speedsLocked) setLockedRatesFromVideo(videoSpeed.value);
  applyRates();
  setStatus(speedsLocked ? getLockedStatus() : 'Video speed adjusted independently.');
});

lockButton.addEventListener('click', () => {
  speedsLocked = !speedsLocked;
  lockButton.setAttribute('aria-pressed', String(speedsLocked));
  lockButtonLabel.textContent = speedsLocked ? 'Unlock speeds' : 'Lock speeds';

  if (speedsLocked) {
    lockedSpeedOffset = Number(videoSpeed.value) - Number(audioSpeed.value);
    setStatus(getLockedStatus());
  } else {
    setStatus('Audio and video speeds are independent.');
  }
});

resetButton.addEventListener('click', async () => {
  audioSpeed.value = '1';
  videoSpeed.value = '1';
  if (speedsLocked) lockedSpeedOffset = 0;
  applyRates();
  pausePlayback();
  video.currentTime = 0;
  seekTapeAudio(0);
  hasStartedSound = false;
  await startPlayback();

  if (hasStartedSound) setStatus('Resynced from the beginning at 1.00×.');
});

video.addEventListener('click', () => {
  if (!hasStartedSound || video.paused || isTapeAudioPaused()) {
    startPlayback();
  } else {
    pausePlayback();
  }
});

video.addEventListener('play', () => {
  updatePlaybackButton(true);
});

video.addEventListener('pause', () => {
  // Ignore a delayed pause event from the playback session that Resync just replaced.
  if (!video.paused) return;
  updatePlaybackButton(false);
  pauseTapeAudio();
});

applyRates();
