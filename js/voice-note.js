// Voice notes for Messages: records from the microphone and saves a small, universal .wav file.
// Why .wav: it plays on every phone and computer (iPhone, Android, Windows, Mac), unlike the formats phones
// record by default (iPhones record .m4a, Android records .webm, and each cannot always play the other's).
// Speech is stored at 16,000 samples per second, mono, 16-bit: about 1.9 MB per minute. The limit is 2 minutes.
// Nothing is sent anywhere until the soror taps Send; the recording stays on her phone until then.
window.rcoVoice = (function () {
  const MAX_SECONDS = 120;
  const RATE = 16000;
  const AC = window.AudioContext || window.webkitAudioContext;
  const supported = !!(AC && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.File && window.Blob);

  function writeText(view, offset, text) {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  }

  // chunks: array of Float32Array at inRate. Returns { blob, peak } (peak is the loudest sample, 0 to 1).
  function encodeWav(chunks, inRate) {
    let total = 0;
    chunks.forEach(c => { total += c.length; });
    const all = new Float32Array(total);
    let at = 0;
    chunks.forEach(c => { all.set(c, at); at += c.length; });

    let peak = 0;
    for (let i = 0; i < all.length; i++) { const v = Math.abs(all[i]); if (v > peak) peak = v; }
    // quiet recordings are lifted (up to 8 times) so they are easy to hear
    const gain = peak > 0.005 && peak < 0.5 ? Math.min(8, 0.9 / peak) : 1;

    const ratio = inRate / RATE;
    const outLen = Math.max(0, Math.floor(all.length / ratio));
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      // average the samples that fall in this slot (a simple low-pass that avoids harsh aliasing)
      const start = Math.floor(i * ratio);
      const end = Math.max(start + 1, Math.min(all.length, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j++) sum += all[j];
      const v = Math.max(-1, Math.min(1, (sum / (end - start)) * gain));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }

    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buf);
    writeText(view, 0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); writeText(view, 8, 'WAVE');
    writeText(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeText(view, 36, 'data'); view.setUint32(40, pcm.length * 2, true);
    new Int16Array(buf, 44).set(pcm);
    return { blob: new Blob([buf], { type: 'audio/wav' }), peak, seconds: pcm.length / RATE };
  }

  // Starts recording. Call it directly from a tap (phones only allow the microphone after a tap).
  //   onTick(seconds): called about 4 times a second.  onLimit(result): called if the 2-minute limit is reached.
  // Returns { stop() -> { blob, peak, seconds }, cancel() }. Rejects if the microphone is blocked or missing.
  async function start(onTick, onLimit) {
    if (!supported) throw new Error('unsupported');
    const ctx = new AC();                 // created inside the tap so iPhones allow it
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) { try { ctx.close(); } catch (e) { /* ignore */ } throw err; }
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* ignore */ } }

    const inRate = ctx.sampleRate;
    const source = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const silent = ctx.createGain(); silent.gain.value = 0;      // keeps the recorder running without playing the voice aloud
    const chunks = [];
    let samples = 0, done = false, result = null;
    proc.onaudioprocess = ev => {
      if (done) return;
      const data = ev.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(data));
      samples += data.length;
    };
    source.connect(proc); proc.connect(silent); silent.connect(ctx.destination);

    const timer = setInterval(() => {
      const secs = samples / inRate;
      if (onTick) onTick(Math.min(secs, MAX_SECONDS));
      if (secs >= MAX_SECONDS) { const r = finish(); if (onLimit) onLimit(r); }
    }, 250);

    function release() {
      clearInterval(timer);
      try { proc.onaudioprocess = null; proc.disconnect(); source.disconnect(); silent.disconnect(); } catch (e) { /* ignore */ }
      try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ }
      try { ctx.close(); } catch (e) { /* ignore */ }
    }
    function finish() {
      if (done) return result;
      done = true;
      release();
      result = encodeWav(chunks, inRate);
      return result;
    }
    function cancel() { if (done) return; done = true; release(); }
    return { stop: finish, cancel };
  }

  return { supported, start, encodeWav, MAX_SECONDS };
})();
