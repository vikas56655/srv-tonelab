# Annotation Studio — v0.4 (browser UI)

Annotation Studio is available in the site's sidebar and homepage cards. It is designed for **human-in-the-loop evaluation**, not automatic ground-truth creation. It uses the existing experimental FastAPI technique detector, without changing its algorithm.

## Workflow

1. Open **Annotation Studio** and load an authorized WAV recording (maximum 35 MB, first 40 seconds).
2. Play/pause, scrub, zoom (up to 8×) and pan. Click the waveform to seek; drag over a region to select a time range.
3. Choose **Sustain**, **Bend**, **Slide**, **Vibrato**, or **Ordinary playing** and add an annotation. Click a label to edit its type and time bounds or delete it.
4. **Annotate first, then reveal predictions** to reduce confirmation bias. Click **Run model comparison** to send a compact, normalized WAV excerpt to the existing analysis API.
5. Inspect matched and unmatched prediction intervals, and view precision, recall, F1 and TP/FP/FN at your selected temporal intersection-over-union (IoU) threshold (default 0.30).
6. Export your reference annotations as JSON or CSV, import JSON annotations for the currently loaded recording, or export an evaluation report.

## Data handling

The original WAV is decoded and played in the browser. The app retains current annotations in component memory; refreshing or closing the tab discards unsaved work. **Export JSON before leaving**.

If you choose to compare with the algorithm, the existing browser-side audio preparation downsamples to 22,050 Hz mono, 16-bit PCM, and sends a maximum 40-second excerpt to the FastAPI service for processing. No annotation labels are uploaded to the API.

There is no persistent account, database, automatic autosave, or server-side storage of human labels. Your source WAV is not automatically uploaded when you load it into the editor.

## Format and Python compatibility

JSON export uses the repository's evaluation-manifest schema:

```json
{
  "schema_version": "1.0",
  "recordings": [
    {
      "id": "original_recording",
      "audio_path": "original_recording.wav",
      "session_id": "performer-a-session-1",
      "labels": [
        {"type": "bend", "start": 0.5, "end": 1.2},
        {"type": "vibrato", "start": 1.4, "end": 2.0}
      ]
    }
  ]
}
```

Place the original WAV next to the exported manifest (or adjust `audio_path`), then run the Python evaluator from the repository root:

```bash
python -m pip install -r services/api/requirements-dev.txt
PYTHONPATH=services/api python -m benchmarks.evaluate_labeled /path/to/annotations.json --iou 0.3
```

**Ordinary playing is an unscored reference category**, useful for notes and negative-case annotation. Exported JSON omits it from scored reference labels; CSV retains all labels. Bend and slide remain separate human labels but map to the same `pitch_slide_candidate` predicted class.

## Evaluation semantics

The browser evaluates predicted and annotated time intervals with **one-to-one greedy matching by descending temporal IoU**, consistent with the Python evaluator's intended scheme. Matching is restricted to the same normalized technique class. The model is still a heuristic candidate detector: matching scores for a single audio clip are not a validated accuracy claim.

Metrics:

- Precision = TP/(TP+FP) when any predictions exist.
- Recall = TP/(TP+FN) when reference labels exist.
- F1 = 2PR/(P+R), when both P and R are defined.
- Undefined denominators are displayed as a dash, not as a fabricated 0%.
- A zero-label / zero-prediction clip has no defined precision or recall; it does not prove perfect performance.

Choose human labels without seeing predictions, record rights and annotation quality, and reserve independent performers/sessions for final validation. This is a **single-clip exploratory tool**, not a substitute for the offline multi-session evaluation pipeline in [REAL_GUITAR_VALIDATION.md](REAL_GUITAR_VALIDATION.md).

## Current boundaries

- WAV playback and peak extraction rely on Web Audio; unsupported codecs will not open.
- Zoom and drag operate on an overview waveform, not on a sample-accurate DAW waveform.
- No automated evaluation on commercial or SRV recordings is included.
- The interface does not distinguish a bend from a slide in model outputs.
- Importing labels assumes they belong to the open WAV; users must verify provenance.
- Annotation data should be exported rather than relying on browser persistence.
