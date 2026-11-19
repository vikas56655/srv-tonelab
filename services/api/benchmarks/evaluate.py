"""Reproducible v0.3 pitch-tracking benchmark using generated test signals.

Run from services/api:
  python -m benchmarks.evaluate
No copyrighted recordings, randomness or external downloads are required.
These results do NOT validate performance on real guitar or SRV recordings.
"""
import json
import math
from pathlib import Path

import numpy as np
from app.timeline import make_timeline

SR = 22050
DURATION = 2.4

def synth(frequency, duration=DURATION, vibrato_cents=0.0, attack=.04, decay=.3):
    """Simple deterministic plucked-note-like harmonic signal with defined F0."""
    t = np.arange(int(SR * duration)) / SR
    f0 = np.asarray(frequency(t), dtype=float)
    f0 = np.broadcast_to(f0, t.shape).copy()
    if vibrato_cents:
        f0 *= 2 ** ((vibrato_cents * np.sin(2*np.pi*5*t)) / 1200)
    phase = 2*np.pi*np.cumsum(f0)/SR
    env = np.minimum(1, t / attack) * np.exp(-decay*t)
    return t, env * (.42*np.sin(phase) + .2*np.sin(2*phase) + .09*np.sin(3*phase)), f0

def benchmark():
    t, steady, f_steady = synth(lambda t: np.full_like(t,220.0))
    _, slide, f_slide = synth(lambda t: 220 * 2**(2*t/DURATION/12))
    _, vib, f_vib = synth(lambda t: np.full_like(t,220.0),vibrato_cents=40)
    _, other, _ = synth(lambda t: np.full_like(t,277.18))
    fixtures = {
        "steady_A3": (steady, f_steady, True),
        "two_semitone_slide": (slide, f_slide, True),
        "40_cent_vibrato": (vib, f_vib, True),
        "two_note_chord": (steady+other, None, False),
        "silence": (np.zeros_like(steady), None, False)
    }
    rows = {}
    for label,(audio,truth,monophonic) in fixtures.items():
        result = make_timeline(audio,SR)
        frames=result["pitch_track"]
        estimates=np.asarray([np.nan if p["hz"] is None else p["hz"] for p in frames])
        voiced=np.isfinite(estimates)
        report={
            "frames":len(frames),
            "voiced_fraction":round(float(np.mean(voiced)),3),
            "median_confidence":round(float(np.median([p["confidence"] for p in frames])),3)
        }
        if monophonic:
            exact=np.interp([p["time"] for p in frames],t,truth)
            if voiced.any():
                cents=1200 * np.log2(estimates[voiced]/exact[voiced])
                report.update({
                    "median_absolute_pitch_error_cents":round(float(np.median(np.abs(cents))),2),
                    "within_50_cents_fraction_of_voiced":round(float(np.mean(np.abs(cents)<50)),3),
                    "octave_error_fraction_of_voiced":round(float(np.mean(np.abs(cents)>600)),3)
                })
            else:
                report.update({"median_absolute_pitch_error_cents":None,
                               "within_50_cents_fraction_of_voiced":0.0,
                               "octave_error_fraction_of_voiced":None})
        else:
            report["note"]="Diagnostic only; polyphonic pitch has no single F0" if label=="two_note_chord" else "Must remain unvoiced"
        rows[label]=report
    return {"benchmark_version":"0.3.0",
            "sample_rate":SR,
            "scope":"Synthetic-only sanity benchmark. No real-world generalization claims.",
            "results":rows}

def main():
    print(json.dumps(benchmark(),indent=2,sort_keys=True))

if __name__=="__main__":
    main()
