# SRV ToneLab — Evaluating the Guitar Intelligence baseline

## Research question
How accurately does the **CPU-only normalized autocorrelation pitch tracker** recover the fundamental frequency of simple monophonic, plucked-note-like signals across time?

This is a *sanity benchmark*, not a validated estimate of performance on real guitar performances, bends, vocals, drums, or Stevie Ray Vaughan recordings.

## Reproducible protocol
From the repository root, install the API test requirements and run:

```bash
python -m pip install -r services/api/requirements-dev.txt
PYTHONPATH=services/api python -m benchmarks.evaluate
PYTHONPATH=services/api pytest -q services/api/tests
```

The benchmark constructs deterministic 22,050 Hz original test signals:

| Fixture | Ground truth | What it checks |
| --- | --- | --- |
| Steady A3 | 220 Hz | Basic fundamental tracking |
| Two-semitone slide | 220 Hz rising continuously to ~247 Hz | Pitch following in a controlled sweep |
| 40-cent vibrato | 220 Hz with ±40 cents at 5 Hz | Time-varying F0 sensitivity |
| Two-note chord | 220 and 277.18 Hz together | Polyphonic failure-mode diagnostic; no single F0 |
| Silence | All zeros | Unvoiced rejection |

All pitched fixtures combine a fundamental with two harmonics and an exponentially decaying amplitude envelope. These are illustrative synthetic signals, **not models of SRV's actual guitar tone**.

## Metrics

- **Voiced fraction:** Fraction of analyzed windows with a non-null predicted frequency. A tracker that abstains on hard signals may have low error but poor coverage; report both.
- **Median absolute pitch error (cents):** Median of `abs(1200 × log2(estimated_hz / true_hz))` over voiced windows only.
- **Within ±50 cents:** Proportion of voiced predictions with less than 50 cents absolute error.
- **Octave-error fraction:** Fraction of voiced predictions whose absolute error exceeds 600 cents.
- **Silence false-voicing:** Should be zero.

The chord case is reported as a diagnostic rather than scored against one ground-truth F0. No number of detected onsets is treated as the true number of played notes.

## Limitations and next experiments

- The synthetic test set is not representative of pickups, amplifiers, string noise, distortion, reverb, compression, polyphonic playing, or recording mixes.
- Autocorrelation confidence is a normalized peak-strength heuristic, **not a calibrated probability**.
- Samples are analyzed in windows; short pitch bends or rapid vibrato may be smoothed or missed.
- Real-world accuracy requires licensed, annotated recordings with independently verified note/frequency trajectories and held-out performers/sessions.
- No quantitative benchmark results are asserted until the benchmark actually runs. GitHub Actions is configured to execute it and save a `synthetic-pitch-benchmark` artifact.

## Interpretation rules
Keep displayed pitch trajectories labeled estimates. Do not label a pitch change as an SRV-style bend or vibrato without a validated classifier and suitable ground truth.
