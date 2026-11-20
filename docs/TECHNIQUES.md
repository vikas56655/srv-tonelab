# Guitar Technique Analyzer — v0.3

## What is implemented
The analyser adds **experimental candidate** annotations to time-resolved F0 estimates. These are not measured SRV guitar techniques, not machine-learning classifier outputs, and not validated on real guitar.

Every annotated event includes approximate start/end times, median estimated pitch, and a tracking-strength heuristic. The browser displays a clickable event timeline, counts by event type, and a detail panel.

## Method
- Input: monophonic pitch-track frames from the baseline normalized-autocorrelation estimator.
- A frame is accepted only when its fundamental is between 75 and 1100 Hz and its correlation strength is at least 0.56.
- Contiguous frames are segmented; pitch jumps above 250 cents or gaps over 0.2 seconds split segments.
- Segments shorter than 0.28 seconds or with median time step over 95 ms are excluded.
- All pitch comparisons are made in cents, 1200 × log2(f2 / f1).
- **Sustain:** length ≥ 0.45s, 10th–90th percentile pitch span below 42 cents, drift below 40 cents.
- **Pitch slide candidate:** length ≥ 0.35s, approximately 80–650 cents of directed motion, low residual deviation. This may indicate a slide, bend, or a melody transition.
- **Vibrato candidate:** at least 0.65s, median sampling step at most 85ms, detrended pitch spread 35–240 cents, ≥4 zero-crossings and approximate 3–8Hz oscillation frequency. This can be fooled by notes and octave errors.
- A single pitch segment receives at most one annotation. These rules are *heuristics*, not trained statistical probabilities. A score attached to an event represents tracking strength, not probability that its musical label is correct.

## Reproducible validation
Tests in `services/api/tests/test_api.py` use deterministic **manually generated pitch trajectories** for a stable note, continuous rising pitch, 5Hz sinusoidal vibrato and silence, and check the response contract.

The audio-to-pitch step is tested separately with original synthesized sounds. Tests of individual components do **not** prove that the entire system reliably classifies gestures in real music.

To run:

```bash
pip install -r services/api/requirements-dev.txt
PYTHONPATH=services/api pytest -q services/api/tests
PYTHONPATH=services/api python -m benchmarks.evaluate
```

## Important limitations
- Guitar bends, slides, and changing notes can share similar pitch trajectories, so the algorithm cannot reliably distinguish them from pitch alone.
- Normal guitar recordings can contain chords, accompaniment, distortion, noise and reverb.
- Frame-based pitch tracking is inaccurate for many polyphonic recordings; note attacks and vibrato may be smoothed.
- No labeled, licensed real-guitar evaluation dataset has yet been used to establish precision/recall.
- If nothing is detected, it means **no candidate cleared the thresholds**, not that the performance contains no technique.
- Do not interpret this as stylistic identification or a reconstruction of Stevie Ray Vaughan's playing.

## Next research stage
Gather original or properly licensed single-note guitar recordings with ground-truth labels; split by player/session, quantify precision and recall on withheld recordings, add calibrated confidence, and compare improved pitch tracking against the baseline.
