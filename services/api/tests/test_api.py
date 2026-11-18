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
