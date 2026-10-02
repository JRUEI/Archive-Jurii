# 色彩工具與分鏡縮圖讀取。字幕帶狀區域參數：bottom 距底%、height 帶高%、side 左右各去%
import numpy as np
from PIL import Image
M = np.array([[0.4124564,0.3575761,0.1804375],[0.2126729,0.7151522,0.0721750],[0.0193339,0.1191920,0.9503041]])
MI = np.linalg.inv(M)
WP = np.array([0.95047,1.0,1.08883])

def lin(c):
    c = np.asarray(c, float)/255.0
    return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)
def lab_from_lin(rgb):
    xyz = rgb @ M.T / WP
    f = np.where(xyz > 216/24389, np.cbrt(xyz), (24389/27*xyz+16)/116)
    return np.stack([116*f[...,1]-16, 500*(f[...,0]-f[...,1]), 200*(f[...,1]-f[...,2])], -1)
def lab_of_hex(h):
    rgb = np.array([int(h[i:i+2],16) for i in (0,2,4)]); return lab_from_lin(lin(rgb))
def lum_of_rgb(rgb): return float(lin(rgb) @ M[1])
def lum_of_hex(h): return lum_of_rgb([int(h[i:i+2],16) for i in (0,2,4)])
def contrast(y1, y2):
    a, b = np.maximum(y1,y2), np.minimum(y1,y2); return (a+0.05)/(b+0.05)
def lch(lab): return float(lab[0]), float(np.hypot(lab[1],lab[2])), float(np.degrees(np.arctan2(lab[2],lab[1]))%360)
def angdiff(a, b): d = abs(a-b) % 360; return min(d, 360-d)
def lab_to_hex(lab):
    L, a, b = lab
    fy = (L+16)/116; fx = fy+a/500; fz = fy-b/200
    f3 = lambda t: t**3 if t**3 > 216/24389 else (116*t-16)/(24389/27)
    xyz = np.array([WP[0]*f3(fx), f3(fy), WP[2]*f3(fz)])
    rgbl = MI @ xyz
    if (rgbl < -1e-4).any() or (rgbl > 1+1e-4).any(): return None
    rgbl = np.clip(rgbl, 0, 1)
    c = np.where(rgbl <= 0.0031308, 12.92*rgbl, 1.055*rgbl**(1/2.4)-0.055)
    return ''.join('%02x' % int(round(x*255)) for x in c)
def lch_hex(L, C, h):  # 超出色域就降彩度
    while C >= 0:
        x = lab_to_hex((L, C*np.cos(np.radians(h)), C*np.sin(np.radians(h))))
        if x: return x
        C -= 1

def load_frames(folder='sb0', sheets=20):
    out = []
    for s in range(sheets):
        im = np.asarray(Image.open(f'{folder}/M{s}.jpg').convert('RGB'))
        for r in range(3):
            for c in range(3): out.append(im[r*180:(r+1)*180, c*320:(c+1)*320])
    return out
def band_box(bottom, height, side, H=180, W=320):
    return int(round(H*(1-(bottom+height)/100))), int(round(H*(1-bottom/100))), int(round(W*side/100)), W-int(round(W*side/100))

def kmeans(lab, k=3, it=8):
    L = lab[:,0]; srt = np.argsort(L)
    cen = np.stack([lab[srt[int(len(L)*q)]] for q in ((0.15, 0.5, 0.85) if k == 3 else (0.25, 0.75))])
    for _ in range(it):
        a = ((lab[:,None,:]-cen[None])**2).sum(-1).argmin(1)
        for j in range(k):
            if (a == j).any(): cen[j] = lab[a == j].mean(0)
    return cen, np.bincount(a, minlength=k)/len(a)

def band_features(frame, box):
    y1, y0, x0, x1 = box
    px = frame[y1:y0, x0:x1].reshape(-1,3)
    rgb = lin(px); Y = rgb @ M[1]; lab = lab_from_lin(rgb)
    light = Y > .2; ls = float(light.mean())   # 亮像素（白字壓不住的地方）才是描邊要分開的對象
    if ls >= .15:
        cen, w = kmeans(lab[light], k=2); Yb = float(np.median(Y[light]))
    else:
        cen, w = kmeans(lab); Yb = float(np.median(Y))
    dom = cen[int(w.argmax())]; med = np.median(lab, 0)
    return dict(Y=Y, Y50=float(np.median(Y)), Y25=float(np.percentile(Y,25)), Y75=float(np.percentile(Y,75)), Yb=Yb, ls=ls,
                dom=dom, D=float(np.sqrt(((lab-med)**2).sum(-1)).mean()))
