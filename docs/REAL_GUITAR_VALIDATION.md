# Real-guitar validation protocol — v0.4

This document describes how to **collect** and **evaluate** independent ground truth for SRV ToneLab. There are **no verified real-guitar accuracy numbers yet**.

## 1. Gather recordings with clear rights

Record original monophonic guitar passages (preferred), or use legitimately licensed recordings that permit this analysis. Aim for multiple guitarists, sessions, instruments and settings. Include **negative examples** containing silence, stable tones, chords, note transitions and accompaniment. Never commit private or copyrighted audio to the public repository.

Use 16-bit PCM WAV; the local CLI accepts up to 40 seconds, 8–192 kHz, mono or stereo. Do not assume that a source's licensing terms permit redistribution.

## 2. Annotate without viewing predictions

Two human reviewers should listen independently, preferably blind to the model outputs. Mark **start/end times in seconds** of audible techniques. The supported labels are:

| Reference label | Model output class | What to annotate |
| --- | --- | --- |
| `sustain` | `sustain` | Fairly stable sustained note |
| `bend` | `pitch_slide_candidate` | Deliberate pitch bend |
| `slide` | `pitch_slide_candidate` | Audible continuous pitch slide |
| `vibrato` | `vibrato_candidate` | Repeated oscillation of a sustained note |

Bend and slide **cannot be separately scored with the current model**; both map to the broader pitch-slide class. If uncertain, record uncertainty in your annotation notes outside the scored manifest and adjudicate before evaluation. Multiple valid techniques can overlap; independent annotation is important.

Use session IDs to group recordings from the same performer and capture conditions; avoid placing near-duplicate takes in both training/tuning and final evaluation.

## 3. Prepare a local manifest

Copy the placeholder at `data/annotation-manifest.example.json` to a **private** manifest. Replace the placeholder audio path with the real WAV location relative to the manifest.

```json
{
  "schema_version": "1.0",
  "recordings": [
    {
      "id": "guitar-session-001",
      "audio_path": "../private_audio/guitar-session-001.wav",
      "session_id": "performer-a-session-1",
      "labels": [
        {"type": "sustain", "start": 0.3, "end": 1.1},
        {"type": "bend", "start": 1.2, "end": 1.8}
      ]
    }
  ]
}
```

This is an illustration of the file format, **not an actual annotated clip**. All segments must have `0 <= start < end <= 40`. For recordings deliberately containing no techniques, use `"labels": []`.

## 4. Evaluate

From the repository root:

```bash
python -m pip install -r services/api/requirements-dev.txt
PYTHONPATH=services/api python -m benchmarks.evaluate_labeled data/my-private-manifest.json --iou 0.3 --out my-private-report.json
PYTHONPATH=services/api pytest -q services/api/tests
```

The script processes the recording locally and does not upload your private audio. Keep the resulting evaluation report private if it contains session identifiers.

### Interpreting the metrics

- Match a predicted event with a same-class annotation if temporal **intersection over union** (IoU) is at least 0.3.
- Match predictions one-to-one; unmatched predictions are false positives, unmatched references are false negatives.
- Report per-class and micro-average precision, recall, and F1.
- When a denominator is zero, report `null` rather than inventing a meaningful score.
- Inspect counts and individual recordings, not only overall F1. Empty recordings without events can inflate an impression of quality if only accuracy is reported.

One-to-one greedy matching is used as a transparent initial baseline; it is not necessarily optimal matching for all overlapping events.

## 5. Evaluate scientific validity

Do **not** tune thresholds on the final held-out sessions. Report the number of performers, sessions, annotated intervals, licensing, class balance, uncertainty between raters and a confusion/error analysis. Consider repeated measures from the same guitarist and multiple effects settings. The current rule-based model is experimental and should not be represented as a validated AI classifier.

## Next step

After independently labeled WAV examples are available, run the evaluator, inspect false positives and false negatives, and compare the existing baseline with a more advanced pitch model. Preserve a held-out set before model development.
