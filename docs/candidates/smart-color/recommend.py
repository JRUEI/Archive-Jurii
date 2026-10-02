# 預先算每張取樣畫面的「智慧取色」候選：python recommend.py [--bottom 13 --height 14 --side 5] ; python recommend.py --selftest
import json, sys, argparse, numpy as np
from colorlib import *

# ---- 候選色盤：使用者兩色 + 5 圈明度 x 12 色相 + 中性 ----
def build_palette():
    hexes = ['14247a', '7b1226']
    for L, C in ((10, 30), (18, 45), (28, 55), (40, 60), (55, 65), (64, 60), (75, 45)):
        for h in range(10, 360, 30): hexes.append(lch_hex(L, C, h))
    hexes += ['262626', '3d3d3d', 'a6a6a6', 'e6e6e6']
    out = []
    for i, h in enumerate(hexes):
        lab = lab_of_hex(h); L, C, hh = lch(lab)
        out.append(dict(hex=h, Y=lum_of_hex(h), lab=lab, L=L, C=C, h=hh, user=i < 2))
    return out
PAL = build_palette()
PY = np.array([p['Y'] for p in PAL]); PLAB = np.array([p['lab'] for p in PAL])

# ---- 評分 ----
def tier_of(cw, cb, cov):
    if cw >= 7 and cb >= 3 and cov >= .75: return 0
    if cw >= 4.5 and cb >= 3 and cov >= .60: return 1
    if cw >= 3 and cb >= 2.5 and cov >= .40: return 2
    return 3

def score_all(f, prev_top=None, prev_set=()):
    Y = f['Y']; light = Y > .2; wl, wd = 1.0, .35
    dark_scene = f['ls'] < .15
    domL, domC, domh = lch(f['dom'])
    res = []
    for i, p in enumerate(PAL):
        r = contrast(p['Y'], Y)
        ok = (r >= 3) if dark_scene else np.where(light, r >= 3, r >= 1.5)
        w = np.ones_like(Y) if dark_scene else np.where(light, wl, wd)
        cov = float((ok*w).sum()/w.sum())
        cw = float(1.05/(p['Y']+.05)); cb = float(contrast(p['Y'], f['Yb']))
        dE = float(np.sqrt(((p['lab']-f['dom'])**2).sum()))
        comp = .5 if (domC < 10 or p['C'] < 10) else 1-angdiff(p['h'], domh+180)/180
        s = .30*cov + .20*comp + .10*min(p['C']/50, 1) + .14*min(cb/6, 1) + .10*min(cw/10, 1) + .16*min(dE/50, 1)
        if p['user']: s += .04
        if i == prev_top: s += .06
        elif i in prev_set: s += .025
        res.append(dict(i=i, tier=tier_of(cw, cb, cov), s=s, cw=cw, cb=cb, cov=cov, comp=comp, dE=dE))
    # 第 3 級（兩個條件湊不齊）改用「白字與背景對比取較小者」排序，找折衷點
    res.sort(key=lambda r: (r['tier'], -min(r['cw']/3, r['cb']/2.5) if r['tier'] == 3 else -r['s']))
    return res

def far(i, j, de, hue_rule=True):
    a, b = PAL[i], PAL[j]
    if np.sqrt(((a['lab']-b['lab'])**2).sum()) < de: return False
    if not hue_rule: return True
    chroma = a['C'] >= 10 and b['C'] >= 10
    return (not chroma) or angdiff(a["h"], b["h"]) >= 45 or abs(a["L"]-b["L"]) >= 25

def pick(ranked, k):
    out = []
    for de, hr in ((30, True), (20, False), (0, False)):
        for r in ranked:
            if len(out) >= (k if de == 30 else 3): break
            if r['i'] not in [o['i'] for o in out] and all(far(r['i'], o['i'], de, hr) for o in out): out.append(r)
        if len(out) >= 3: break
    return out

# 理由代碼：0 深色·亮場景 1 互補色 2 高明度·暗場景 3 異色相 4 中性色 5 中明度折衷 6 深色·比暗背景更深（原色由色盤索引 0/1 判斷）
def reason(r, f):
    p = PAL[r['i']]; domL, domC, domh = lch(f['dom'])
    if f['ls'] < .15: return 2 if p['Y'] >= .12 else 6
    if p['C'] >= 15 and domC >= 10 and angdiff(p['h'], domh+180) <= 45: return 1
    if p['C'] < 10: return 4
    if p['Y'] <= .10: return 0
    if domC >= 10 and angdiff(p['h'], domh) >= 60: return 3
    return 5

def run(feats, k, sticky=True):
    out = []; pt, ps = None, ()
    for f in feats:
        ranked = score_all(f, pt if sticky else None, ps if sticky else ())
        top = pick(ranked, k)
        for r in top: r['why'] = reason(r, f)
        out.append(top); pt = top[0]['i']; ps = tuple(r['i'] for r in top)
    return out

def selftest():
    def synth(Y, rgb):
        lab = lab_from_lin(lin(np.array(rgb)))
        return dict(Y=np.full(2000, Y), Y50=Y, Yb=Y, ls=float(Y > .2), dom=lab)
    for name, f in (('亮米色牆', synth(.62, [215, 195, 175])), ('暗場景', synth(.02, [30, 30, 36])), ('綠牆', synth(.30, [90, 170, 100]))):
        top = pick(score_all(f), 5)
        assert 3 <= len(top) <= 5, name
        for a in top:
            for b in top:
                if a is not b: assert far(a['i'], b['i'], 20, False), (name, 'not diverse')
        t = top[0]; p = PAL[t['i']]
        if name == '亮米色牆': assert t['tier'] == 0 and all(r['tier'] == 0 for r in top) and t['cw'] >= 7 and t['cb'] >= 3
        if name == '暗場景': assert p['Y'] > .1 and t['cb'] >= 3 and reason(t, f) == 2, (p['hex'], t)
        if name == '綠牆': assert any(reason(r, dict(f)) == 1 for r in top), [PAL[r['i']]['hex'] for r in top]
        print(name, [(PAL[r['i']]['hex'], r['tier'], reason(r, f)) for r in top])
    print('selftest ok')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bottom', type=float, default=13); ap.add_argument('--height', type=float, default=14); ap.add_argument('--side', type=float, default=5)
    ap.add_argument('--interval', type=float, default=89.5/9); ap.add_argument('--k', type=int, default=5)
    ap.add_argument('--selftest', action='store_true')
    A = ap.parse_args()
    if A.selftest: selftest(); return

    frames = load_frames(); box = band_box(A.bottom, A.height, A.side)
    feats = [band_features(fr, box) for fr in frames]
    res = run(feats, A.k); raw = run(feats, A.k, sticky=False)
    chg = lambda rr: sum(rr[i][0]['i'] != rr[i-1][0]['i'] for i in range(1, len(rr)))
    print('frames', len(feats), '色盤', len(PAL), '| 首選換色次數 有遲滯', chg(res), '無遲滯', chg(raw))
    import collections
    print('首選 tier', collections.Counter(r[0]['tier'] for r in res), '候選數', collections.Counter(len(r) for r in res))
    print('首選色分佈', collections.Counter(PAL[r[0]['i']]['hex'] for r in res).most_common(8))
    print('原色(深藍/酒紅)出現在候選組的畫面數', sum(any(x['i'] < 2 for x in r) for r in res), '首選為深藍', sum(r[0]['i'] == 0 for r in res))

    def hx(lab): return lab_to_hex(lab) or lch_hex(*lch(lab))
    compact = dict(v=1, vid='XjK0TH3ZmmA', iv=round(A.interval, 3), band=[A.bottom, A.height, A.side], pal=[p['hex'] for p in PAL],
                   f=[[hx(f['dom']), int(round(f['Yb']*1000)), [x['i']*8+x['why'] for x in r]] for f, r in zip(feats, res)])
    s = json.dumps(compact, separators=(',', ':'))
    open('0925-smart.json', 'w').write(s)
    import gzip
    print('0925-smart.json', len(s), 'bytes; gzip', len(gzip.compress(s.encode())))
    dbg = [dict(i=n, t=round(n*A.interval, 1), Y25=f['Y25'], Y50=f['Y50'], Y75=f['Y75'], Yb=f['Yb'], ls=round(f['ls'], 3), dom=hx(f['dom']), domLCH=[round(v, 1) for v in lch(f['dom'])], D=round(f['D'], 1),
                c=[dict(i=x['i'], hex=PAL[x['i']]['hex'], why=x['why'], tier=x['tier'], cw=round(x['cw'], 2), cb=round(x['cb'], 2), cov=round(x['cov'], 2)) for x in r]) for n, (f, r) in enumerate(zip(feats, res))]
    json.dump(dbg, open('0925-debug.json', 'w'), ensure_ascii=False)

if __name__ == '__main__': main()
