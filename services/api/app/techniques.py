"""Conservative exploratory guitar-technique candidates derived from F0 trajectories.

This is rule-based signal analysis, not a validated music-technique classifier.
No use of copyrighted audio is required. Confidence is a heuristic score.
"""
from __future__ import annotations
import numpy as np

def analyze_techniques(pitch_track: list[dict]) -> dict:
    """Classify contiguous, confidently voiced spans; no inference over gaps.

    Works in log-frequency cents. Rejects very short spans and improbable
    octave jumps. Candidate labels are not asserted as ground truth.
    """
    points = pitch_track
    spans = []
    current = []
    for p in points:
        hz = p.get("hz")
        confidence = float(p.get("confidence", 0))
        if hz is not None and 75 <= hz <= 1100 and confidence >= .56:
            if current:
                dt = float(p["time"]) - float(current[-1]["time"])
                jump = abs(1200 * np.log2(float(hz)/float(current[-1]["hz"])))
                if dt > .20 or jump > 250:
                    if len(current) >= 4:
                        spans.append(current)
                    current = []
            current.append(p)
        else:
            if len(current) >= 4:
                spans.append(current)
            current = []
    if len(current) >= 4:
        spans.append(current)

    events = []
    for part in spans:
        times = np.array([float(p["time"]) for p in part])
        frequency = np.array([float(p["hz"]) for p in part])
        confidence = np.array([float(p["confidence"]) for p in part])
        median_dt = float(np.median(np.diff(times)))
        length = float(times[-1]-times[0])
        if length < .28 or median_dt > .095:
            continue
        cents = 1200*np.log2(frequency/frequency[0])
        baseline = float(np.median(cents))
        centered = cents-baseline
        slope = float(np.polyfit(times-times[0], cents, 1)[0])
        drift = float(slope * length)
        fitted = np.polyval(np.polyfit(times-times[0], cents, 1), times-times[0])
        residual = cents - fitted
        variability = float(np.percentile(cents,90)-np.percentile(cents,10))
        common = dict(start=round(float(times[0]),3),end=round(float(times[-1]),3),
                      duration=round(length,3),median_pitch_hz=round(float(np.median(frequency)),1),
                      mean_tracking_strength=round(float(np.mean(confidence)),2))
        label = None
        description = None
        measure = {}
        # Sustained note: stable trajectory for at least 0.45s
        if length >= .45 and variability < 42 and abs(drift) < 40:
            label="sustain"
            description="Relatively stable voiced pitch over this interval"
            measure={"pitch_spread_cents":round(variability,1)}
        # Candidate bend/slide: strong net directed motion with restrained wiggle.
        if length >= .35 and 80 <= abs(drift) <= 650 and abs(slope)>=90:
            coherent = float(np.std(residual))
            if coherent < max(40, .36*abs(drift)):
                label="pitch_slide_candidate"
                description="Directional pitch change: may be bend, slide, or a note transition"
                measure={"pitch_change_cents":round(drift,1)}
        # Candidate vibrato: residual oscillations after removing linear trend.
        # Sampling and periodicity checks prevent slow bends from being called vibrato.
        if length >= .65 and median_dt <= .085 and abs(drift) < 65:
            amp = float(np.percentile(residual,90)-np.percentile(residual,10))
            r = residual - float(np.mean(residual))
            sign = np.sign(r)
            reversals = int(np.sum(sign[1:]*sign[:-1]<0))
            # zero crossing should support >=2 full cycles
            if 35 <= amp <= 240 and reversals >= 4:
                # coarse frequency estimate from zero-crossing count / (2*duration)
                hz = reversals/(2*length)
                if 3 <= hz <= 8:
                    label="vibrato_candidate"
                    description="Oscillating pitch deviation; verify against audio"
                    measure={"pitch_oscillation_range_cents":round(amp,1),
                             "estimated_oscillation_hz":round(hz,1)}
        if label:
            # score reflects voiced tracking quality only; not classification probability
            score = round(float(np.clip(np.mean(confidence),0,1)),2)
            events.append(dict(type=label,description=description,
                               tracking_strength=score,**common,**measure))
    return {
        "events":events[:60],
        "counts":{k:sum(e["type"]==k for e in events) for k in
                  ("sustain","pitch_slide_candidate","vibrato_candidate")},
        "method":"Conservative, rule-based heuristics on time-resolved F0 estimates",
        "limitations":"Exploratory candidate labels, not verified guitar techniques. Polyphony, note transitions, distortion and weak pitch tracking can mislead the detector. Tracking strength is not a probability."
    }
