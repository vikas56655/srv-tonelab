"""Deterministic matcher checks; no real-world performance claims."""
from benchmarks.evaluate_labeled import match_events,metrics,overlap,validate_manifest

def event(kind,start,end):
    return {"type":kind,"start":start,"end":end}

def test_iou_geometry():
    assert overlap(event("sustain",0,2),event("sustain",1,3)) == 1/3
    assert overlap(event("sustain",0,1),event("sustain",2,3)) == 0

def test_one_prediction_cannot_match_two_annotations():
    truth=[event("sustain",0,1),event("sustain",.1,.9)]
    predicted=[event("sustain",0,1)]
    assert match_events(truth,predicted)=={"tp":1,"fp":0,"fn":1}

def test_class_mismatch_is_not_true_positive():
    assert match_events([event("vibrato",0,1)],[event("bend",0,1)])=={"tp":0,"fp":1,"fn":1}

def test_aliases_match_intentionally():
    assert match_events([event("bend",0,1)],[event("pitch_slide_candidate",0,1)])["tp"]==1

def test_empty_cases_and_undefined_metrics():
    assert match_events([],[])=={"tp":0,"fp":0,"fn":0}
    result=metrics(dict(tp=0,fp=0,fn=3))
    assert result["precision"] is None
    assert result["recall"]==0
    assert result["f1"] is None

def test_manifest_validation_rejects_empty_missing_and_duplicate():
    import pytest
    with pytest.raises(ValueError):
        validate_manifest({"schema_version":"1.0","recordings":[]})
    base={"id":"a","audio_path":"a.wav","session_id":"s1","labels":[]}
    with pytest.raises(ValueError):
        validate_manifest({"schema_version":"1.0","recordings":[base,base]})
    assert len(validate_manifest({"schema_version":"1.0","recordings":[base]}))==1

def test_annotation_boundaries():
    import pytest
    row={"id":"a","audio_path":"a.wav","session_id":"s1","labels":[event("vibrato",1,1)]}
    with pytest.raises(ValueError):
        validate_manifest({"schema_version":"1.0","recordings":[row]})
