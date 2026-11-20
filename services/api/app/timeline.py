"""Bounded, transparent, CPU-only guitar-analysis visual features (v0.2).

Pitch is a normalized-autocorrelation baseline, NOT a polyphonic transcription.
Spectrogram uses a fixed-size log-frequency representation to limit response size.
"""
from __future__ import annotations
import math
import numpy as np

def _note(hz: float) -> str:
    midi = int(round(69 + 12 * math.log2(hz / 440)))
    return ('C','C#','D','D#','E','F','F#','G','G#','A','A#','B')[midi % 12] + str(midi // 12 - 1)

def make_timeline(signal: np.ndarray, sr: int) -> dict:
    x = np.asarray(signal, dtype=np.float64)
    duration = len(x) / sr
    nfft = 2048 if sr >= 16000 else 1024
    # Denser frames for note-expression research; <= 620 to bound CPU and JSON payload.
    count = min(620, max(1, math.ceil(duration / 0.05)))
    centers = np.linspace(min(duration / 2, nfft/(2*sr)), max(min(duration / 2,nfft/(2*sr)),duration - nfft/(2*sr)), count)
    if duration < nfft/sr:
        centers = np.array([duration / 2.])
    window = np.hanning(nfft)
    freqs = np.fft.rfftfreq(nfft, 1/sr)
    # 48 musical/log-frequency bands between 80 and 6000Hz, clipped to Nyquist
    edges = np.geomspace(80, min(6000, sr/2 - 1), 49)
    centers_hz = np.sqrt(edges[:-1] * edges[1:])
    bands = np.zeros((len(centers), 48))
    time_series = []
    fluxes = []
    prev = None
    overall = float(np.sqrt(np.mean(x*x))) if x.size else 0.
    for i, t in enumerate(centers):
        center = int(t*sr)
        lo = center - nfft // 2
        start = max(0, lo)
        end = min(len(x), lo + nfft)
        frame = np.zeros(nfft, dtype=float)
        if end > start:
            frame[start-lo:end-lo] = x[start:end]
        level = float(np.sqrt(np.mean(frame*frame)))
        spec = np.abs(np.fft.rfft(frame*window))
        energy = spec*spec
        # frequency band energies rather than max, rendered in decibels
        for b in range(48):
            mask = (freqs >= edges[b]) & (freqs < edges[b+1])
            bands[i,b] = 10*np.log10(max(1e-12, float(np.mean(energy[mask])))) if np.any(mask) else -120
        normspec = spec / (np.sum(spec) + 1e-12)
        flux = float(np.sum(np.maximum(0, normspec - prev))) if prev is not None else 0.
        fluxes.append(flux)
        prev = normspec

        hz = None
        confidence = 0.
        # Autocorrelation of windowed signal; require energy and strong periodicity.
        if level > max(.002, overall * .12):
            ac = np.fft.irfft(np.abs(np.fft.rfft(frame*window, n=2*nfft))**2)[:nfft]
            minlag = max(2, int(sr / 1100))
            maxlag = min(nfft-2, int(sr / 75))
            lag_range = np.arange(minlag, maxlag+1)
            if len(lag_range):
                vals = ac[lag_range] / (ac[0]+1e-12)
                peaks_mask = (vals[1:-1] > vals[:-2]) & (vals[1:-1] >= vals[2:])
                peaks = lag_range[1:-1][peaks_mask]
                if len(peaks):
                    strengths = ac[peaks]/(ac[0]+1e-12)
                    best = float(np.max(strengths))
                    eligible = peaks[strengths >= max(.55, best * .88)]
                    if best >= .55 and len(eligible):
                        lag = int(eligible[0])
                        hz = float(sr / lag)
                        confidence = float(np.clip(ac[lag] / (ac[0]+1e-12),0,1))
        time_series.append({'time':round(float(t),3),'hz':round(hz,2) if hz else None,
                            'note':_note(hz) if hz else None,
                            'confidence':round(confidence,3),
                            'energy':round(level,5)})

    # Onsets are merely spectral-flux candidate peaks, not ground-truth note boundaries.
    flux = np.asarray(fluxes)
    onsets = []
    if len(flux) >= 3:
        threshold = max(.025, float(np.median(flux) + 1.5*np.std(flux)))
        for i in range(1, len(flux)-1):
            if flux[i] > threshold and flux[i]>=flux[i-1] and flux[i]>flux[i+1]:
                if not onsets or centers[i]-onsets[-1]['time'] >= .12:
                    onsets.append({'time':round(float(centers[i]),3),'strength':round(float(flux[i]),3)})
    # Relative dB shading; clamp to a [-65,0] display range.
    maximum = float(np.max(bands))
    shading = np.clip((bands-maximum+65)/65,0,1)
    from .techniques import analyze_techniques
    gestures = analyze_techniques(time_series)
    return {
        'technique_analysis': gestures,
        'method': 'FFT log-frequency spectrogram + normalized autocorrelation pitch + spectral-flux onsets',
        'pitch_track': time_series,
        'onsets': onsets[:80],
        'spectrogram': {
            'times': [round(float(t),3) for t in centers],
            'frequencies_hz': [round(float(f),1) for f in centers_hz],
            'intensity': np.round(shading,3).tolist()
        },
        'limitations': 'Experimental estimates for isolated monophonic guitar. Chords, drums, effects and vibrato can cause missing or incorrect pitch and onset detections.'
    }
