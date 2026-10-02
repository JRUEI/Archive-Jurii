# 9/25 沒有的場景類型，用調色模擬（非真實畫面）：暗場景、綠牆、藍牆（近深藍）、特亮白牆
import numpy as np
from PIL import Image
def hsv_shift(fr, dh=0, sm=1.0, vm=1.0, vadd=0):
    im = Image.fromarray(fr).convert('HSV'); a = np.asarray(im).astype(float)
    a[...,0] = (a[...,0] + dh*255/360) % 256; a[...,1] = np.clip(a[...,1]*sm, 0, 255); a[...,2] = np.clip(a[...,2]*vm + vadd, 0, 255)
    return np.asarray(Image.fromarray(a.astype('uint8'), 'HSV').convert('RGB'))
def dark(fr):  return np.clip(fr.astype(float)*0.22, 0, 255).astype('uint8')
def green(fr): return hsv_shift(fr, dh=62, sm=1.6, vm=0.92)
def blue(fr):  return hsv_shift(fr, dh=170, sm=2.6, vm=0.5)
def white(fr): return hsv_shift(fr, dh=0, sm=0.35, vm=1.0, vadd=32)
SIMS = [('暗場景（亮度壓到約 1/5）', dark), ('綠牆（色相轉到綠）', green), ('藍牆（接近現在的深藍）', blue), ('特亮白牆（飽和度壓低、再提亮）', white)]
