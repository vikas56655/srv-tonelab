from app.main import app
from fastapi.testclient import TestClient
c=TestClient(app)
def test_health():assert c.get('/health').json()['status']=='ok'
def test_catalog():assert len(c.get('/api/recordings').json()['items'])>=5
def test_demo():
 d=c.get('/api/demo-analysis').json()
 assert d['estimated_pitch_hz'] is not None
 assert abs(d['estimated_pitch_hz']-220)<15
 assert len(d['waveform'])>80
def test_wav_restriction():
 r=c.post('/api/analyze',files={'file':('a.mp3',b'123','audio/mpeg')})
 assert r.status_code==415

def test_timeline_shape_and_bounds():
 d=c.get('/api/demo-analysis').json()
 assert d['method'].startswith('FFT')
 assert len(d['pitch_track'])>2
 assert len(d['pitch_track'])<=620
 assert len(d['spectrogram']['times'])==len(d['pitch_track'])
 assert len(d['spectrogram']['intensity'])==len(d['pitch_track'])
 assert all(len(col)==48 for col in d['spectrogram']['intensity'])
 assert d['spectrogram']['times']==sorted(d['spectrogram']['times'])
 assert all(0<=v<=1 for col in d['spectrogram']['intensity'] for v in col)
 assert all(p['time']>=0 for p in d['onsets'])

def test_timeline_steady_tone():
 import numpy as np
 from app.timeline import make_timeline
 sr=22050
 t=np.arange(sr*2)/sr
 x=.24*np.sin(2*np.pi*220*t)
 result=make_timeline(x,sr)
 values=[p['hz'] for p in result['pitch_track'] if p['hz'] is not None]
 assert len(values)>3
 assert abs(float(np.median(values))-220)<8

def test_silence_has_no_pitch():
 import numpy as np
 from app.timeline import make_timeline
 r=make_timeline(np.zeros(22050),22050)
 assert all(p['hz'] is None for p in r['pitch_track'])
 assert len(r['onsets'])==0


def test_synthetic_research_benchmark_contract():
 from benchmarks.evaluate import benchmark
 result=benchmark()["results"]
 assert set(result)=={"steady_A3","two_semitone_slide","40_cent_vibrato","two_note_chord","silence"}
 assert result["silence"]["voiced_fraction"]==0
 assert result["steady_A3"]["voiced_fraction"]>.5
 assert result["steady_A3"]["median_absolute_pitch_error_cents"]<50
 for name in ("steady_A3","two_semitone_slide","40_cent_vibrato"):
  assert 0<=result[name]["within_50_cents_fraction_of_voiced"]<=1
  assert result[name]["frames"]<=140

def test_technique_detector_manual_trajectories():
 import numpy as np
 from app.techniques import analyze_techniques
 def frames(fn, duration=1.5, step=.05):
  return [dict(time=round(float(t),3),hz=round(float(220*2**(fn(t)/1200)),4),confidence=.92,energy=.2)
          for t in np.arange(0,duration,step)]
 steady=analyze_techniques(frames(lambda t:0))
 assert any(e["type"]=="sustain" for e in steady["events"])
 slide=analyze_techniques(frames(lambda t:160*t/1.5))
 assert any(e["type"]=="pitch_slide_candidate" for e in slide["events"])
 # A continuous 5Hz periodic deviation yields a vibrato candidate.
 vib=analyze_techniques(frames(lambda t:50*np.sin(2*np.pi*5*t)))
 assert any(e["type"]=="vibrato_candidate" for e in vib["events"])
 assert not any(e["type"]=="vibrato_candidate" for e in steady["events"])
 assert not analyze_techniques([dict(time=t*.05,hz=None,confidence=0) for t in range(30)])["events"]

def test_demo_has_gesture_schema():
 d=c.get('/api/demo-analysis').json()
 assert "technique_analysis" in d
 assert "events" in d["technique_analysis"]
 assert all(0 <= event["tracking_strength"] <= 1 for event in d["technique_analysis"]["events"])
