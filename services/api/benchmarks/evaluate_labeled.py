"""Reference-label evaluation for SRV ToneLab's experimental technique detector.

Manifest format: {"schema_version":"1.0","recordings":[{"id":"clip-001",
"audio_path":"../private/clip-001.wav","session_id":"playerA_take1",
"labels":[{"type":"sustain","start":0.25,"end":1.0}]}]}

No example item is scored as real-world validation; supply independent, authorized WAV
recordings annotated without viewing model predictions. Files remain local.
"""
from __future__ import annotations
import argparse
import io
import json
from pathlib import Path
import wave

import numpy as np
from app.main import analyze

CATEGORIES = ("sustain", "pitch_slide_candidate", "vibrato_candidate")
ALIASES = {"sustain":"sustain","slide":"pitch_slide_candidate",
           "bend":"pitch_slide_candidate","pitch_slide_candidate":"pitch_slide_candidate",
           "vibrato":"vibrato_candidate","vibrato_candidate":"vibrato_candidate"}

def read_wav(path: Path) -> tuple[np.ndarray,int]:
    with wave.open(str(path),"rb") as f:
        if f.getcomptype() != "NONE" or f.getnchannels() not in (1,2):
            raise ValueError(f"{path}: only uncompressed mono/stereo PCM WAV supported")
        sample_width=f.getsampwidth()
        if sample_width not in (1,2,3,4):
            raise ValueError(f"{path}: unsupported sample width")
        sr=f.getframerate()
        frames=f.getnframes()
        if sr < 8000 or sr > 192000 or frames / max(sr,1) > 40:
            raise ValueError(f"{path}: 8–192 kHz, <=40 seconds only")
        raw=f.readframes(frames)
    if sample_width == 3:
        a=np.frombuffer(raw,dtype=np.uint8).reshape(-1,3)
        samples=a[:,0].astype(np.int32)|(a[:,1].astype(np.int32)<<8)|(a[:,2].astype(np.int32)<<16)
        samples=np.where(samples & 0x800000,samples-0x1000000,samples).astype(np.float64)/8388608.
    else:
        dtype={1:np.uint8,2:np.int16,4:np.int32}[sample_width]
        samples=np.frombuffer(raw,dtype=dtype).astype(np.float64)
        samples=(samples-128)/128 if sample_width==1 else samples/(2**(8*sample_width-1))
    if f.getnchannels()==2:
        samples=samples.reshape(-1,2).mean(axis=1)
    if len(samples)<1024:
        raise ValueError("Audio too short")
    return samples,sr

def normalize_label(value: str) -> str:
    if value not in ALIASES:
        raise ValueError(f"Unknown label {value!r}; expected one of {sorted(ALIASES)}")
    return ALIASES[value]

def overlap(a: dict,b: dict) -> float:
    """Temporal intersection-over-union for two intervals."""
    intersection=max(0.,min(float(a["end"]),float(b["end"]))-max(float(a["start"]),float(b["start"])))
    union=max(float(a["end"]),float(b["end"]))-min(float(a["start"]),float(b["start"]))
    return intersection/union if union>0 else 0.

def match_events(reference: list[dict], predicted: list[dict], threshold: float=.3) -> dict:
    """Maximum-cardinality deterministic greedy matching by overlap, same label only.

    Each prediction and reference can match at most once. Candidate pairs are
    sorted by descending IoU, then stable source index; no label leakage.
    """
    if not 0 < threshold <= 1:
        raise ValueError("Temporal IoU threshold must be within (0,1]")
    candidates=[]
    for i,g in enumerate(reference):
        for j,p in enumerate(predicted):
            if normalize_label(g["type"]) == normalize_label(p["type"]):
                score=overlap(g,p)
                if score>=threshold:
                    candidates.append((-score,i,j))
    used_gt=set()
    used_pred=set()
    for _,i,j in sorted(candidates):
        if i not in used_gt and j not in used_pred:
            used_gt.add(i);used_pred.add(j)
    tp=len(used_gt)
    return {"tp":tp,"fp":len(predicted)-tp,"fn":len(reference)-tp}

def metrics(counts: dict) -> dict:
    tp,fp,fn=(counts[k] for k in ("tp","fp","fn"))
    precision=tp/(tp+fp) if tp+fp else None
    recall=tp/(tp+fn) if tp+fn else None
    f1=(2*precision*recall/(precision+recall)) if precision is not None and recall is not None and precision+recall else (0. if precision is not None and recall is not None else None)
    return dict(**counts,precision=precision,recall=recall,f1=f1)

def validate_manifest(manifest: dict) -> list[dict]:
    if manifest.get("schema_version")!="1.0":
        raise ValueError("Expected schema_version 1.0")
    rows=manifest.get("recordings")
    if not isinstance(rows,list) or not rows:
        raise ValueError("Supply at least one independently annotated recording")
    seen=set()
    for row in rows:
        if not all(key in row for key in ("id","audio_path","session_id","labels")):
            raise ValueError("Every recording needs id, audio_path, session_id and labels")
        if row["id"] in seen:
            raise ValueError("Duplicate recording ID")
        seen.add(row["id"])
        if not isinstance(row["labels"],list):
            raise ValueError("labels must be an array (can be empty for negative examples)")
        for e in row["labels"]:
            normalize_label(e["type"])
            if not 0<=float(e["start"])<float(e["end"])<=40:
                raise ValueError("Annotation time range invalid")
    return rows

def evaluate(manifest_path: Path, threshold: float=.3) -> dict:
    root=manifest_path.resolve().parent
    manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    rows=validate_manifest(manifest)
    if not 0<threshold<=1:
        raise ValueError("Invalid IoU threshold")
    count={k:dict(tp=0,fp=0,fn=0) for k in CATEGORIES}
    per_recording=[]
    for item in rows:
        path=(root/item["audio_path"]).resolve()
        x,sr=read_wav(path)
        prediction=analyze(x,sr)["technique_analysis"]["events"]
        gt=item["labels"]
        for cat in CATEGORIES:
            one=match_events([g for g in gt if normalize_label(g["type"])==cat],
                             [p for p in prediction if p["type"]==cat], threshold)
            for k in ("tp","fp","fn"):
                count[cat][k]+=one[k]
        per_recording.append({"id":item["id"],"session_id":item["session_id"],
                             "ground_truth_count":len(gt),"prediction_count":len(prediction)})
    overall={k:sum(count[cat][k] for cat in CATEGORIES) for k in ("tp","fp","fn")}
    return {"evaluation_version":"1.0",
            "data_type":"independent human-labeled WAV recordings",
            "recording_count":len(rows),
            "session_count":len({r["session_id"] for r in rows}),
            "temporal_iou_threshold":threshold,
            "overall_micro":metrics(overall),
            "by_class":{cat:metrics(count[cat]) for cat in CATEGORIES},
            "per_recording":per_recording,
            "caveats":["No claim of generalization without held-out performers and sessions.",
                       "Null metric means its denominator is zero; it is not zero performance.",
                       "Bend and slide are grouped into the pitch_slide_candidate class."]}

def main() -> None:
    p=argparse.ArgumentParser()
    p.add_argument("manifest",type=Path)
    p.add_argument("--iou",type=float,default=.3)
    p.add_argument("--out",type=Path,default=None)
    args=p.parse_args()
    report=evaluate(args.manifest,args.iou)
    output=json.dumps(report,indent=2,allow_nan=False)
    if args.out:
        args.out.write_text(output+"\n",encoding="utf-8")
    print(output)

if __name__=="__main__":
    main()
