# SRV ToneLab — Development roadmap

## Shipped v0.1
- Public dashboard, original demo waveform and static FFT spectrum, guitar-inspired synth, curated SRV catalog.
- WAV processing using browser-side normalization and a Vercel-hosted Python API.

## Shipped v0.2 — Experimental Guitar Intelligence
- A time-resolved estimated pitch track (normalized autocorrelation with voiced/unvoiced gaps).
- A log-frequency, 48-band spectrogram with 140-frame cap for low-cost processing.
- Spectral-flux onset candidates, a time scrubber and optional onset-marker overlays.
- Bound-checked API payloads and tests for steady tone, silence and output shape.

**Important:** These are exploratory signal-processing baselines; accuracy on commercial music or polyphonic recordings has not been established. No claims of bend/vibrato detection yet.

## Upcoming research
- v0.3: Labeled, licensed note, bend and vibrato evaluation dataset; temporal smoothing and uncertainty calibration.
- v0.4: Source-verified MusicBrainz discography and metadata caching, plus documented influences.
- v0.5: Audio-embedding similarity search with retrieval quality evaluation.
- v0.6: Security hardening, upload rate limits, observability, authenticated background jobs and persistence.

No copyrighted SRV recordings are hosted. All music-history relationships labeled illustrative are not independently verified.
