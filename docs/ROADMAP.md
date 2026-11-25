# SRV ToneLab — Development roadmap

## Shipped v0.1
- Public dashboard, original demo waveform and static FFT spectrum, guitar-inspired synth, curated SRV catalog.
- WAV processing using browser-side normalization and a Vercel-hosted Python API.

## Shipped v0.2 — Experimental Guitar Intelligence
- A time-resolved estimated pitch track (normalized autocorrelation with voiced/unvoiced gaps).
- A log-frequency, 48-band spectrogram with bounded frame count for low-cost processing.
- Spectral-flux onset candidates, a time scrubber and optional onset-marker overlays.
- Bound-checked API payloads and tests for steady tone, silence and output shape.

**Important:** These are exploratory signal-processing baselines; accuracy on commercial music or polyphonic recordings has not been established. v0.3 only adds conservative *candidate* pitch gestures, not validated technique classification.

## Shipped v0.3 — Candidate Guitar Techniques
- Experimental sustained-pitch, pitch slide/bend and vibrato-like candidate events from pitch trajectories.
- Clickable event timeline, counts, time ranges and heuristic tracking strength.
- Controlled unit tests on synthetic trajectories; no quantified real-guitar precision/recall yet.
- Research methodology: [TECHNIQUES.md](TECHNIQUES.md).

## Shipped v0.4 — Annotation Studio and evaluation infrastructure
- Browser-based annotation workspace with zoomable waveform, playback, editable intervals, independent labels and JSON/CSV export.
- Optional overlay of prediction candidates with one-to-one temporal IoU evaluation and TP/FP/FN, precision, recall, F1 (client-side, single recording).
- [Annotation Studio documentation](ANNOTATION_STUDIO.md).
- Independent annotation manifest template in `data/annotation-manifest.example.json`.
- Local evaluator for precision, recall, F1 and one-to-one temporal IoU matching (`services/api/benchmarks/evaluate_labeled.py`).
- Matching and schema tests (`services/api/tests/test_labeled_evaluation.py`).
- [Human annotation protocol](REAL_GUITAR_VALIDATION.md).
- **Not complete:** real labeled audio dataset, verified metrics, inter-rater agreement and held-out player/session evaluation.

## Upcoming research
- v0.4 completion: Gather licensed labeled guitar data and establish held-out real-world metrics; improve temporal smoothing and uncertainty calibration.
- v0.5: Source-verified MusicBrainz discography and metadata caching, plus documented influences.
- v0.6: Audio-embedding similarity search with retrieval quality evaluation.
- v0.7: Security hardening, upload rate limits, observability, authenticated background jobs and persistence.

No copyrighted SRV recordings are hosted. All music-history relationships labeled illustrative are not independently verified.
