/**
 * Browser-side WAV normalization for Vercel's serverless request-size limits.
 * Decodes locally, trims to 40 seconds, mixes to mono and converts to 22.05kHz
 * 16-bit PCM. Original file bytes never leave the browser.
 */
export async function prepareAudioUpload(file: File): Promise<{wav: File; trimmed: boolean; duration: number}> {
  if (!/\.wav$/i.test(file.name)) throw new Error('Please select a .wav audio file.');
  if (file.size > 35 * 1024 * 1024) throw new Error('This file exceeds the 35 MB source limit. Please select a shorter recording.');
  const Context = window.AudioContext;
  if (!Context) throw new Error('Your browser does not support Web Audio decoding.');
  const ctx = new Context();
  try {
    let decoded: AudioBuffer;
    try { decoded = await ctx.decodeAudioData(await file.arrayBuffer()); }
    catch { throw new Error('The WAV could not be decoded. Try exporting it as PCM 16-bit WAV, or choose another file.'); }
    if (!decoded.length || !decoded.numberOfChannels || !decoded.sampleRate) throw new Error('The audio file appears empty or invalid.');
    const seconds = Math.min(decoded.duration, 40);
    if (seconds < 0.05) throw new Error('Please select a recording at least 0.05 seconds long.');
    const hz = 22050;
    const samples = Math.floor(seconds * hz);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    function str(offset: number, value: string) { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); }
    str(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, hz, true); view.setUint32(28, hz * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    str(36, 'data'); view.setUint32(40, samples * 2, true);
    const channels = Math.min(decoded.numberOfChannels, 2);
    const a = decoded.getChannelData(0);
    const b = channels === 2 ? decoded.getChannelData(1) : null;
    const ratio = decoded.sampleRate / hz;
    for (let i = 0; i < samples; i++) {
      const pos = i * ratio;
      const j = Math.min(a.length - 1, Math.floor(pos));
      const next = Math.min(a.length - 1, j + 1);
      const mix = (arr: Float32Array) => arr[j] + (arr[next] - arr[j]) * (pos - j);
      const val = Math.max(-1, Math.min(1, b ? (mix(a) + mix(b)) / 2 : mix(a)));
      view.setInt16(44 + i * 2, Math.round(val < 0 ? val * 32768 : val * 32767), true);
    }
    return {wav: new File([buffer], 'analysis.wav', {type: 'audio/wav'}), trimmed: decoded.duration > 40, duration: seconds};
  } finally { await ctx.close().catch(() => {}); }
}
