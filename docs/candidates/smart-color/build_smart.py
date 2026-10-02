# 由 yt-test.html 複製出 yt-test-smart.html（不動原檔），加上「智慧取色」。資料表取自 smartcolor/0925-smart.json
import re
s = open('yt-test.html', encoding='utf-8').read()
data = open('smartcolor/0925-smart.json', encoding='utf-8').read().strip()
def sub(old, new, count=1):
    global s
    assert s.count(old) == count, (old, s.count(old))
    s = s.replace(old, new)

sub('<title>YouTube 字幕對時測試</title>', '<title>YouTube 智慧取色測試</title>')
sub('<h1>YouTube 字幕對時測試</h1>', '<h1>YouTube 智慧取色測試</h1>')
sub('<p class="sub">真的 YouTube 影片加上我們自己的字幕（9/25 的 13:32 到 15:12，28 行）。播放、聽聲音，看字幕有沒有對上。</p>',
    '<p class="sub">同一支 9/25 影片與字幕，加上「智慧取色」：按下去，依目前播放到的畫面列出 5 個描邊色候選，點哪個就套哪個。</p>')

css = '''.smart{display:grid;gap:8px}
.sinfo{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:.78rem;color:var(--mut);font-variant-numeric:tabular-nums}
.sinfo i{display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--c);border:1px solid var(--line);flex:none}
.sinfo b{color:var(--fg);font-weight:700}
.cands{display:grid;gap:6px}
.cand{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:10px;align-items:center;height:auto;width:100%;padding:6px 10px;text-align:left;font-weight:500;color:var(--fg);background:var(--soft);border:1px solid var(--line);border-radius:12px}
.cand:hover:not(:disabled){background:var(--hi)}
.cand[aria-pressed="true"]{background:var(--hi);border-color:var(--yline)}
.cand .dot{width:26px;height:26px;border-radius:50%;background:var(--c);border:2px solid var(--line)}
.cand[aria-pressed="true"] .dot{outline:2px solid var(--fg);outline-offset:1px}
.cand .tx{display:grid;gap:1px;min-width:0}
.cand .tx b{font-size:.8rem;font-variant-numeric:tabular-nums}
.cand .tx small{color:var(--mut);font-size:.72rem;line-height:1.35;font-weight:500}
.cand .pv{width:64px;height:30px;border-radius:8px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:.95rem;font-weight:800;color:#fff;-webkit-text-stroke:3px var(--c);paint-order:stroke fill;background:var(--bg0)}
'''
sub('</style></head>', css + '</style></head>')

sub('<button id="csave" class="mini" type="button">存成快捷色</button></div>',
    '<button id="csave" class="mini" type="button">存成快捷色</button><button id="smart" class="mini solid" type="button">智慧取色</button></div>\n<div id="smartbox" class="smart" hidden><div id="sinfo" class="sinfo"></div><div id="cands" class="cands"></div></div>')

js = r'''
var SM=__SMART__;
var RS=["深色・亮場景對比高","互補色・避開背景同色相","高明度・暗場景","異色相・避開背景色","中性色・不搶色","中明度・折衷","深色・比暗背景更深"];
function hx2lum(h){var c=[0,2,4].map(function(i){var v=parseInt(h.substr(i,2),16)/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function cr(a,b){return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
function mmss(x){var m=Math.floor(x/60),s=Math.round(x-m*60);return m+":"+(s<10?"0":"")+s}
var smartBox=document.getElementById("smartbox"),sinfo=document.getElementById("sinfo"),candBox=document.getElementById("cands");
function smartNone(txt){smartBox.hidden=false;sinfo.textContent=txt;candBox.textContent=""}
function smartPick(){
 if(!ready||!player.getCurrentTime){smartNone("播放器還沒就緒，沒有時間可以查。");return}
 var t=player.getCurrentTime()+off/1000,k=Math.round(t/SM.iv);
 if(!(t>=0)||t>SM.iv*SM.f.length||!SM.f[Math.min(k,SM.f.length-1)]){smartNone("這一秒沒有資料。");return}
 k=Math.min(k,SM.f.length-1);var e=SM.f[k],bg=e[0],yb=e[1]/1000;
 sinfo.textContent="";
 var dot=document.createElement("i");dot.style.setProperty("--c","#"+bg);sinfo.appendChild(dot);
 var b=document.createElement("b");b.textContent="#"+bg.toUpperCase();sinfo.appendChild(b);
 var tx=document.createElement("span");tx.textContent="背景亮度 "+Math.round(yb*100)+"%・取樣畫面 "+mmss(k*SM.iv)+"（約每 "+Math.round(SM.iv)+" 秒一張，取最近的）";sinfo.appendChild(tx);
 if(Math.abs(cur.sb-SM.band[0])>3){var w=document.createElement("span");w.textContent="・取色依字幕在距底 "+SM.band[0]+"% 算的，你現在是 "+cur.sb+"%";sinfo.appendChild(w)}
 candBox.textContent="";
 e[2].forEach(function(v,n){var i=v>>3,r=v&7,c="#"+SM.pal[i],yc=hx2lum(SM.pal[i]);
  var x=document.createElement("button");x.type="button";x.className="cand";x.dataset.c=c;x.style.setProperty("--c",c);x.style.setProperty("--bg0","#"+bg);
  var d=document.createElement("span");d.className="dot";
  var t2=document.createElement("span");t2.className="tx";
  var h=document.createElement("b");h.textContent=(n+1)+"　"+c.toUpperCase()+(i===0?"　原色深藍":i===1?"　原色酒紅":"");
  var sm=document.createElement("small");sm.textContent=RS[r]+"・白字 "+(1.05/(yc+.05)).toFixed(1)+":1・背景 "+cr(yc,yb).toFixed(1)+":1";
  t2.appendChild(h);t2.appendChild(sm);
  var pv=document.createElement("span");pv.className="pv";pv.textContent="字幕";
  x.appendChild(d);x.appendChild(t2);x.appendChild(pv);
  x.onclick=function(){cur.c=c;persist();apply()};
  candBox.appendChild(x)});
 smartBox.hidden=false;
 cur.c=("#"+SM.pal[e[2][0]>>3]);persist();apply();
}
document.getElementById("smart").onclick=smartPick;
var _apply=apply;apply=function(){_apply();candBox.querySelectorAll(".cand").forEach(function(x){x.setAttribute("aria-pressed",String(x.dataset.c===cur.c))})};
'''.replace('__SMART__', data)
sub('document.getElementById("reset").onclick=function(){cur=Object.assign({},DEF);persist();apply()};\napply();',
    'document.getElementById("reset").onclick=function(){cur=Object.assign({},DEF);persist();apply()};' + js + 'apply();')
open('yt-test-smart.html', 'w', encoding='utf-8').write(s)
print('ok', len(s))
