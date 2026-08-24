import subprocess, numpy as np
SR=48000
def load(name):
    p=subprocess.run(['ffmpeg','-v','error','-i',f'public/sfx2/{name}','-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True)
    return np.frombuffer(p.stdout,dtype=np.float32).reshape(-1,2)
KIT={k:load(v) for k,v in {
 'pop':'card-pop.wav','thock':'thock_1.wav','thockL':'thock_3.wav','whoosh_s':'whoosh_s.wav','whoosh_m':'whoosh_m.wav',
 'whoosh_l':'whoosh_l.wav','tear':'tear.wav','scratch':'scratch_s.wav','tick':'tick.wav','drone':'drone_low.wav',
 'typing':'es_typing.wav','success':'es_success.wav','ping':'es_ping.wav','swell':'es_swell.wav',
 'impact':'es_impact.wav','ticks':'es_ticks.wav','riser':'es_riser.wav',
 'blip':'es_blip.wav','swipe':'es_swipe.wav','select':'es_select.wav'}.items()}  # soft subtle kit
def place(buf,snd,at,g):
    s=int(at*SR); a=KIT[snd]*g; e=min(len(buf),s+len(a))
    if s<0 or s>=len(buf): return
    buf[s:e]+=a[:e-s]
def placeEnd(buf,snd,endAt,g): place(buf,snd, endAt-len(KIT[snd])/SR, g)
# VARIANCE MODEL: a run of enumeration pops must not be one identical bleep repeated (habituation →
# "annoying/mechanical"), nor a random different sound each time (chaos). Two coherent mechanisms:
#  1) MELODIC contour within a run — same timbre, pitched along a gentle arpeggio that MATCHES the
#     on-screen meaning: things accumulating rise, things lost fall, a steady counter barely wobbles.
#  2) TIMBRE by meaning across runs — comments / data-rows / money-events use different samples, and
#     adjacent runs never share a timbre (enforced upstream).
_TRIAD=[0,2,4]  # rising major-third motif; drifts up a semitone each cycle so a long run keeps climbing gently
def pop_semi(contour,i):
    if contour=='down':   return -(_TRIAD[i%3] + i//3)      # falling (events slipping past / lost)
    if contour=='steady': return [0,1,-1,0][i%4]            # near-constant: a regular metronomic tick
    return _TRIAD[i%3] + i//3                                # 'up' = accumulation, gentle rising arpeggio
def place_pop(buf,snd,at,g,semi,seed):
    a=KIT[snd]; sp=2.0**(semi/12.0)                          # pitch by semitone (resample); +semi = higher
    n=int(len(a)/sp)
    if n<1: return
    idx=(np.arange(n)*sp).astype(np.int64); idx=idx[idx<len(a)]; a=a[idx]
    gj=g*(1.0+(((seed*29)%7)-3)*0.04)                        # tiny gain jitter for naturalness
    s=int(at*SR); e=min(len(buf),s+len(a))
    if s<0 or s>=len(buf): return
    buf[s:e]+=a[:e-s]*gj
def drone_bed(buf,g):
    d=KIT['drone']; i=0
    while i<len(buf): e=min(len(buf),i+len(d)); buf[i:e]+=d[:e-i]*g; i+=len(d)
# (time, sound, gain[, 'end']) — samples are -1 dBFS so gain IS the level. Everything SUBTLE: hits <=0.24,
# ambient reveal accents 0.09-0.16. Placed on REAL reveals read from each act's source (frame-diff misses
# smooth slides). Same-sound runs collapsed + ambient accents spaced >=1.5s so it's gentle life, not arcade.
SIG={
 'intro':[(0.85,'ping',0.13),(12.9,'impact',0.18),(18.67,'impact',0.18)],
 'act1':[(4.1,'success',0.13),(9.55,'typing',0.18),(14.9,'swipe',0.14),(15.9,'swipe',0.14),(19.5,'blip',0.11),(20.0,'blip',0.11),(25,'swipe',0.14),(27.8,'thock',0.16),(32.2,'whoosh_l',0.16),(37.6,'tick',0.14),(41.1,'impact',0.18),(47.9,'pop',0.13),(49.3,'whoosh_m',0.16),(53.3,'swipe',0.14),(55.4,'whoosh_s',0.15),(67.0,'whoosh_m',0.15),(74.1,'impact',0.17),(79.5,'impact',0.14),(82.3,'whoosh_m',0.16),(90.2,'blip',0.11),(99.6,'swipe',0.15),(101.9,'swipe',0.14),(104.7,'select',0.12),(105.2,'blip',0.14),(117.3,'whoosh_m',0.15)],
 'act2':[(0.2,'whoosh_s',0.14),(1.95,'tear',0.08),(3.05,'swipe',0.11),(5.55,'pop',0.12),(7.4,'select',0.11),(8.3,'impact',0.18),(10.55,'blip',0.1),(13.6,'ticks',0.12),(17.3,'pop',0.11),(18.6,'ticks',0.12),(21.8,'select',0.12),(23.2,'whoosh_m',0.16),(25.4,'typing',0.12),(31.2,'swipe',0.13),(32.5,'tick',0.11),(33.6,'whoosh_s',0.14),(34.4,'impact',0.14),(35.5,'scratch',0.11),(37.6,'whoosh_m',0.16),(38.6,'blip',0.1),(40.2,'select',0.13),(42.2,'whoosh_m',0.16),(44.6,'impact',0.18),(50,'whoosh_m',0.16),(50.9,'tick',0.15),(51.7,'blip',0.11),(52.6,'swipe',0.13),(53.9,'impact',0.16),(55.4,'blip',0.1),(56.6,'swipe',0.12),(59.4,'select',0.12),(62.6,'swipe',0.12),(66.1,'blip',0.1),(68.3,'thock',0.14),(75.4,'whoosh_s',0.14),(76.6,'swipe',0.12),(78.15,'select',0.12),(79.7,'whoosh_m',0.16),(80.9,'tick',0.1),(82.6,'blip',0.09),(86.8,'blip',0.09),(91.5,'select',0.11),(93.9,'whoosh_s',0.13),(95.9,'success',0.18),(96.8,'ping',0.12),(98.4,'select',0.13),(101.2,'whoosh_s',0.14),(105,'pop',0.13),(110.5,'whoosh_m',0.16),(111.8,'blip',0.11),(113.6,'select',0.11),(115.2,'swell',0.18,'end'),(117.6,'select',0.13)],
 'act3':[(0.5,'whoosh_s',0.14),(2.9,'blip',0.11),(4.2,'ping',0.18),(6.2,'swipe',0.13),(9.8,'blip',0.1),(13.5,'whoosh_m',0.18),(19,'success',0.18),(21.2,'pop',0.12),(24.6,'whoosh_m',0.16),(25.4,'blip',0.11),(27.6,'tick',0.09),(29,'impact',0.18),(33,'swipe',0.14),(33.6,'thock',0.14),(35.8,'impact',0.18),(40.8,'ticks',0.14),(41.6,'swipe',0.13),(44.3,'swipe',0.13),(48.4,'swipe',0.13),(50.8,'blip',0.11),(53.9,'select',0.1),(58.8,'select',0.1),(61.7,'select',0.1),(63.6,'pop',0.12),(68,'pop',0.12),(70.2,'ticks',0.15),(72.5,'select',0.12),(77,'thock',0.16),(79,'blip',0.1),(81.5,'typing',0.13),(84.6,'swipe',0.12),(88.4,'blip',0.11),(94,'thock',0.16),(96,'select',0.11),(101.6,'whoosh_s',0.12),(106.8,'impact',0.18),(108.6,'whoosh_s',0.12),(110.2,'whoosh_m',0.16),(111.2,'select',0.11)],
 'act4':[(2.35,'select',0.12),(3.4,'whoosh_m',0.17),(4.9,'whoosh_s',0.15),(7,'blip',0.1),(8.9,'swipe',0.13),(11.2,'pop',0.13),(13,'typing',0.11),(15,'whoosh_s',0.13),(22.6,'blip',0.1),(26.7,'whoosh_s',0.14),(28.3,'ping',0.16),(30.6,'whoosh_m',0.16),(33,'blip',0.11),(37,'impact',0.18),(40.9,'blip',0.11),(44,'whoosh_m',0.17),(46.2,'tick',0.09),(49.9,'whoosh_s',0.16),(50.4,'select',0.15),(51.3,'success',0.18)],
}
# SIG = structural sounds (transitions, key hits, one-off reveals). POPRUNS = per-ELEMENT pops on
# staggered enumerations, grouped into RUNS so each run gets ONE coherent timbre + a melodic contour
# matched to meaning (pop_semi/place_pop above). Adjacent runs use different timbres.
POPRUNS={  # (timbre, gain, contour, [element onsets]) per staggered run
 'intro':[],
 'act1':[
   ('tick',0.1,'up',[1.5, 2.4]),
   ('select',0.1,'down',[11.6, 11.95, 12.3]),
   ('tick',0.1,'up',[14.5]),
   ('blip',0.1,'up',[28.8, 30.2, 34.4]),
   ('tick',0.1,'up',[46.76, 47.02, 47.28]),
   ('select',0.11,'up',[56.5, 57.5, 58.5, 59.5]),
   ('tick',0.1,'up',[59.2, 59.94, 60.69, 61.43, 62.17, 62.91, 63.66]),
   ('blip',0.1,'up',[67.6, 68.75, 69.9, 71.05, 72.2, 73.35]),
   ('select',0.11,'up',[82.9, 83.3, 83.7, 84.1, 84.5, 84.9, 85.3, 85.7, 86.1]),
   ('blip',0.1,'up',[91.4, 92.6]),
   ('tick',0.11,'up',[106.85, 107.95, 109.05, 110.15, 111.25]),
   ('blip',0.1,'down',[113.8, 114.7, 115.6]),
   ('tick',0.1,'up',[118.9, 120.5, 122.1])],
 'act2':[
   ('tick',0.1,'up',[3.4, 4.2]),
   ('blip',0.09,'up',[10.2, 10.9, 11.25, 13.95, 14.3, 14.65, 15]),
   ('tick',0.11,'up',[19.02, 19.44, 19.86, 20.28]),
   ('select',0.1,'up',[26.3, 27.1]),
   ('blip',0.1,'down',[33.9, 36.4]),
   ('tick',0.1,'up',[52.13, 53.13, 53.47]),
   ('pop',0.11,'steady',[69.5, 70.6]),
   ('blip',0.11,'up',[81.6, 83.8, 85.8, 87.4, 88.9])],
 'act3':[
   ('pop',0.12,'steady',[23.3]),
   ('tick',0.1,'up',[26.6]),
   ('blip',0.08,'steady',[41.1]),
   ('tick',0.1,'up',[45.6, 46.8]),
   ('blip',0.08,'steady',[51.6, 52.6]),
   ('tick',0.11,'up',[51.9, 53]),
   ('blip',0.1,'up',[59.7, 60.5]),
   ('tick',0.08,'steady',[63.9, 66.1, 68.3]),
   ('blip',0.11,'up',[65.8]),
   ('select',0.09,'up',[79.25])],
 'act4':[
   ('blip',0.1,'up',[23, 23.4, 23.8, 24.2, 24.6, 25]),
   ('tick',0.1,'up',[47, 47.8, 48.6])],
}
DUR={'intro':18.752,'act1':123.157,'act2':121.6,'act3':114.09,'act4':53.781}
for seg,dur in DUR.items():
    buf=np.zeros((int(dur*SR)+2*SR,2),dtype=np.float32)
    drone_bed(buf,0.03)
    for entry in SIG[seg]:
        at,snd,g = entry[0],entry[1],entry[2]
        mode = entry[3] if len(entry)>3 else 'hit'
        (placeEnd if mode=='end' else place)(buf,snd,at,g)
    # REDUCTION (user: "waaay too many / too loud"): halve pop level, cap each run so long runs don't
    # machine-gun, drop marginal single-pop runs. Keeps the per-element concept but far more restrained.
    POP_SCALE=0.5; POP_CAP=3
    sigt=[e[0] for e in SIG[seg]]; npop=0
    for ri,(timbre,g,contour,times) in enumerate(POPRUNS.get(seg,[])):
        times=sorted(times)
        if len(times)<=1: continue                                  # drop a lone pop — it's clutter
        if len(times)>POP_CAP:                                       # keep POP_CAP evenly across the run
            keep=set(int(round(x)) for x in np.linspace(0,len(times)-1,POP_CAP))
            times=[times[i] for i in sorted(keep)]
        base=(ri%3-1)*2   # per-run register shift (-2/0/+2) so like-contour runs still differ
        for i,at in enumerate(times):
            if any(abs(at-s)<0.18 for s in sigt): continue  # don't double a structural sound
            npop+=1; place_pop(buf,timbre,at,g*POP_SCALE, pop_semi(contour,i)+base, npop)
    buf=np.tanh(buf*1.02)*0.97
    raw=(buf[:int(dur*SR)]*32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg','-y','-f','s16le','-ar',str(SR),'-ac','2','-i','-','out/sfx19_'+seg+'.wav'],input=raw,capture_output=True)
    print(f"{seg}: {len(SIG[seg])} sig + {npop} pops ({len(POPRUNS.get(seg,[]))} runs)")
