#!/usr/bin/env python3
"""Build the original Grade Wobble approximation. Requires fonttools.
The reference is an incomplete word sample, so unseen characters are designed,
not recovered from it. Centreline coordinates are editable font source.
"""
import math,json
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[1]
# Uppercase: informal rounded monoline strokes, irregular baselines/crossbars.
raw={
'A':'2,0 10,35 24,91 31,98 39,75 59,0|12,37 47,40',
'B':'4,0 5,98 34,98 51,92 54,79 45,61 7,54 39,55 58,44 61,27 52,9 36,2 4,0',
'C':'61,86 47,98 25,97 9,81 3,55 7,26 23,6 43,1 62,13',
'D':'6,0 6,98 25,99 48,90 62,70 65,46 56,20 36,3 6,0',
'E':'57,97 7,97 7,2 59,3|8,53 49,56',
'F':'7,0 6,98 60,96|8,54 48,56',
'G':'61,84 45,98 24,96 8,76 4,52 10,23 29,3 53,7 63,26 63,48 36,47',
'H':'6,0 7,99|61,97 61,0|7,47 59,50',
'I':'6,98 48,99|27,97 28,2|5,2 51,1',
'J':'7,98 57,97 55,28 45,7 27,0 9,8 3,23',
'K':'7,98 6,1|61,99 8,46 30,51 65,1',
'L':'7,98 5,1 61,3',
'M':'5,0 6,98 14,98 36,35 58,97 65,96 67,0',
'N':'6,1 6,97 13,97 62,3 65,2 64,98',
'O':'34,99 14,91 5,69 3,40 12,13 30,2 49,6 63,26 67,56 60,83 43,98 34,99',
'P':'7,0 6,98 37,99 57,89 60,72 50,57 32,52 7,52',
'Q':'34,99 14,91 5,69 3,40 12,13 30,2 49,6 63,26 67,56 60,83 43,98 34,99|41,27 70,-8',
'R':'7,0 6,98 36,100 58,90 60,74 50,59 8,53|28,53 65,1',
'S':'60,94 44,99 21,96 7,83 5,66 15,54 44,47 59,35 61,19 47,5 23,0 5,8',
'T':'2,96 69,99|35,96 34,1',
'U':'6,97 6,28 14,8 33,0 52,6 64,25 65,98',
'V':'3,98 17,45 30,2 38,1 67,98',
'W':'2,98 15,2 23,1 39,65 54,2 63,2 78,98',
'X':'4,97 65,1|65,97 4,0',
'Y':'3,98 32,51 61,98|32,51 33,0',
'Z':'4,97 65,97 6,1 66,2',
'a':'44,49 29,59 12,54 4,36 7,14 22,4 41,12 47,32 45,59 46,8 57,4',
'b':'6,99 5,4|7,42 22,57 40,57 52,43 52,24 40,7 23,2 7,12',
'c':'47,52 31,60 13,53 5,37 7,17 22,5 43,10',
'd':'48,97 47,3|46,47 33,59 16,56 5,41 6,21 20,5 35,6 48,23',
'e':'6,32 47,36 45,49 33,58 16,55 6,42 5,25 16,9 34,4 48,12',
'f':'8,-20 14,74 20,94 35,99 46,92|2,55 42,58',
'g':'46,47 32,59 14,55 5,38 8,17 21,7 37,11 46,30 48,57 47,-13 37,-30 19,-32 7,-24',
'h':'6,98 5,3|7,36 20,54 35,59 46,52 49,37 49,3',
'i':'12,57 12,4 21,5|12,85 13,86',
'j':'23,57 23,-13 16,-29 4,-31 -4,-24|24,86 25,87',
'k':'6,99 6,3|45,58 7,25 24,31 50,4',
'l':'9,98 8,14 14,4 25,6',
'm':'5,56 5,3|6,38 18,55 28,55 34,40 34,3|34,40 45,56 59,55 66,41 67,2',
'n':'6,56 5,3|7,39 21,56 37,57 48,44 49,3',
'o':'28,59 12,54 4,39 6,20 18,6 34,6 48,20 50,40 40,55 28,59',
'p':'6,-30 6,56|7,45 21,57 38,56 51,42 50,24 37,9 21,7 7,19',
'q':'46,-31 47,57|46,47 33,58 16,55 5,40 7,20 21,6 37,11 47,25',
'r':'6,3 6,56|8,38 19,55 33,59 43,53',
's':'44,53 28,59 12,53 8,41 18,31 36,26 45,16 36,5 18,4 5,11',
't':'18,88 16,19 22,6 36,6 44,13|2,55 43,59',
'u':'5,58 5,22 13,7 28,4 44,20 46,57 46,8 56,4',
'v':'3,57 20,5 28,3 49,58',
'w':'3,57 13,4 21,4 32,42 43,4 52,6 65,57',
'x':'4,57 48,4|48,57 4,4',
'y':'4,57 21,7 28,7|49,57 29,-15 19,-30 5,-31',
'z':'5,55 48,57 6,5 49,6',
'0':'30,96 13,84 8,55 12,22 27,3 45,9 54,37 51,73 40,95 30,96',
'1':'8,76 28,97 29,3|9,2 49,3',
'2':'5,80 16,96 35,98 52,87 55,70 42,51 8,6 55,5',
'3':'7,93 48,96 29,57 46,56 57,40 53,18 37,4 16,4 4,15',
'4':'45,2 46,97 5,35 59,36',
'5':'53,95 11,96 8,56 31,60 51,51 57,32 47,12 29,3 8,12',
'6':'49,94 29,97 13,81 7,49 9,21 24,5 44,8 55,26 50,47 33,58 9,43',
'7':'4,96 59,96 21,2',
'8':'28,98 11,89 10,70 24,54 46,43 55,25 44,7 24,3 7,14 8,35 26,53 49,70 50,86 37,97 28,98',
'9':'51,54 29,41 12,48 5,68 12,89 30,99 48,89 55,63 49,29 34,6 16,3',
'.':'10,3 11,4', ',':'13,5 9,-10', ':':'10,47 11,48|10,3 11,4',';':'10,47 11,48|13,5 8,-10',
'!':'12,98 11,28|11,4 12,5','?':'4,80 15,96 33,98 49,86 47,69 25,51 24,29|24,5 25,6',
'-':'2,36 37,37','_':'1,-10 60,-9',"'":'12,99 10,77','"':'10,99 8,77|26,99 24,77',
'(':'28,99 12,79 7,48 12,17 28,-4',')':'7,99 23,79 28,48 23,17 7,-4',
'/':'3,-8 44,100','\\':'3,100 44,-8','+':'3,42 53,42|28,68 28,15','=':'3,54 53,54|3,30 53,30',
'[':'30,99 8,99 8,-4 30,-4',']':'6,99 28,99 28,-4 6,-4',
'<':'43,72 6,43 43,14','>':'6,72 43,43 6,14','|':'12,100 12,-10',
'#':'20,94 12,4|48,94 40,4|4,64 60,65|2,32 58,33',
'*':'25,79 25,35|5,68 45,45|5,45 45,68',
'&':'57,8 16,63 12,82 23,96 39,90 40,74 9,30 9,14 25,3 43,12 57,35',
'@':'61,11 42,0 20,6 6,26 3,59 17,86 43,96 66,81 76,51 69,31 56,30 56,64 40,73 25,63 21,43 30,28 46,34 57,52',
'%':'3,1 66,97|14,97 4,88 5,75 15,67 25,74 25,88 14,97|56,32 46,25 46,11 56,3 66,10 66,24 56,32',
'$':'50,86 34,97 13,88 8,70 20,56 40,48 53,34 48,15 27,5 6,16|31,110 28,-10',
'£':'53,87 38,98 21,89 16,71 21,30 13,6 58,7|4,50 42,51',
'^':'3,62 25,96 48,63','`':'8,99 23,82','~':'1,42 14,51 30,36 46,45',
'{':'34,99 20,99 16,87 17,62 6,49 17,36 16,10 22,-2 35,-2',
'}':'6,99 20,99 24,87 23,62 34,49 23,36 24,10 18,-2 5,-2'
}
# Generate rounded stroked outlines as consistently wound overlapping capsules.
# No raster tracing, substituted existing font, or training is represented here.
def paths(text):return [[tuple(map(float,p.split(','))) for p in stroke.split()] for stroke in text.split('|')]
def contour(pen,points):
 pen.moveTo(points[0])
 for p in points[1:]:pen.lineTo(p)
 pen.closePath()
def smooth(strokes):
 out=[]
 for path in strokes:
  if len(path)<5:out.append(path);continue
  points=[path[0]]
  for i in range(len(path)-1):
   a,b,c,d=path[max(0,i-1)],path[i],path[i+1],path[min(len(path)-1,i+2)]
   for step in range(1,5):
    t=step/4
    points.append(tuple(.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in [0,1]))
  out.append(points)
 return out

def glyph(strokes):
 pen=TTGlyphPen(None)
 for path in strokes:
  for i,(x,y) in enumerate(path):
   # Small original centreline variation keeps stroke direction irregular.
   x=x*7+50;y=y*7
   radius=43
   circle=[(round(x+radius*math.cos(j*2*math.pi/12)),round(y+radius*math.sin(j*2*math.pi/12))) for j in range(12)]
   contour(pen,circle)
   if i:
    px,py=path[i-1];px=px*7+50;py*=7;dx=x-px;dy=y-py;length=math.hypot(dx,dy)
    if length:
     nx=-dy/length*radius;ny=dx/length*radius
     contour(pen,[(round(px+nx),round(py+ny)),(round(px-nx),round(py-ny)),(round(x-nx),round(y-ny)),(round(x+nx),round(y+ny))])
 result=pen.glyph()
 if result.numberOfContours>0:result.flags[0]|=0x40
 return result
mapping={chr(c):raw.get(chr(c),'') for c in range(33,127)}
mapping.update({'£':raw['£'],'‘':raw["'"],'’':raw["'"],'“':raw['"'],'”':raw['"'],'–':raw['-'],'—':raw['-']})
order=['.notdef','space']+[f'uni{ord(c):04X}' for c in mapping]
glyphs={'.notdef':glyph(paths('4,0 4,98 56,98 56,0 4,0')),'space':glyph([])}
metrics={'.notdef':(520,30),'space':(300,0)}
for char,text in mapping.items():
 name=f'uni{ord(char):04X}';strokes=paths(text) if text else []
 glyphs[name]=glyph(smooth(strokes) if char in 'BCDGOPQRSUabcdegmnopqrsu0235689@&?' else strokes);width=max((x for path in strokes for x,y in path),default=35)
 metrics[name]=(round(width*7+140),25)
b=FontBuilder(1000,isTTF=True);b.setupGlyphOrder(order);b.setupCharacterMap({32:'space',160:'space',**{ord(c):f'uni{ord(c):04X}' for c in mapping}})
b.setupGlyf(glyphs);b.setupHorizontalMetrics(metrics);b.setupHorizontalHeader(ascent=850,descent=-250,lineGap=50)
b.setupNameTable({'familyName':'Grade Wobble','styleName':'Regular','uniqueFontIdentifier':'GradeWobble-1.0','fullName':'Grade Wobble Regular','psName':'GradeWobble-Regular','version':'Version 1.000','copyright':'Original approximation made for PaintPlus, 2026. MIT License.','description':'First approximation inspired by the supplied incomplete handwriting sample; unseen glyphs are designed.'})
b.setupOS2(sTypoAscender=850,sTypoDescender=-250,sTypoLineGap=50,usWinAscent=850,usWinDescent=250,sxHeight=420,sCapHeight=700);b.setupPost();b.setupMaxp()
b.font['head'].created=b.font['head'].modified=3875212800;b.font.recalcTimestamp=False
folder=ROOT/'assets/fonts';b.save(folder/'grade-wobble.ttf')
(folder/'grade-wobble-LICENSE.txt').write_text((ROOT/'LICENSE').read_text())
(folder/'grade-wobble-source.json').write_text(json.dumps({'family':'Grade Wobble','status':'Original first approximation, not an exact traced or trained reconstruction','strokes':raw},indent=2)+'\n')
print('Generated Grade Wobble: A–Z, a–z, 0–9, ASCII punctuation, pound sign and typographic quotes.')
