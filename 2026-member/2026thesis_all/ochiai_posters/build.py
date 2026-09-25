"""Build A4 Ochiai-format digests from the 2026 PDIII source decks.
Run from any directory with: python3 path/to/ochiai_posters/build.py
Requires reportlab, Pillow, and pdftoppm.
"""
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import json
import subprocess

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'midterm'
DATA = json.loads((HERE / 'content.json').read_text(encoding='utf-8'))
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
FONT = 'HeiseiKakuGo-W5'
W, H = A4
NAVY = HexColor('#142B40')
TEAL = HexColor('#0E8390')
GOLD = HexColor('#E8A74E')
INK = HexColor('#21374A')
MUTED = HexColor('#577187')
PALE = HexColor('#F4F8F9')
LINE = HexColor('#E0E8EB')
QUESTIONS = [
    'どんなもの？',
    '先行研究と比べてどこがすごい？',
    '技術や手法のキモはどこ？',
    'どうやって有効だと検証した？',
    '議論はある？',
    '次に読むべき論文は？',
]


def paragraph(c, text, x, top, width, size=9, leading=14, color=INK):
    style = ParagraphStyle('jp', fontName=FONT, fontSize=size, leading=leading,
                           textColor=color, wordWrap='CJK')
    obj = Paragraph(escape(text), style)
    _, height = obj.wrap(width, 1000)
    obj.drawOn(c, x, top-height)
    return height


def image_contained(c, im, x, y, width, height):
    iw, ih = im.size
    scale = min(width/iw, height/ih)
    dw, dh = iw*scale, ih*scale
    c.drawImage(ImageReader(im), x+(width-dw)/2, y+(height-dh)/2,
                dw, dh, mask='auto')


def draw_card(c, n, answer, x, y, width, height):
    c.setFillColor(PALE if n in (1, 4) else HexColor('#FFFFFF'))
    c.setStrokeColor(LINE)
    c.roundRect(x, y, width, height, 9, fill=1, stroke=1)
    c.setFillColor(TEAL if n != 4 else GOLD)
    c.roundRect(x+12, y+height-29, 23, 17, 5, fill=1, stroke=0)
    paragraph(c, f'{n:02d}', x+16, y+height-19, 18, 8, 10, HexColor('#FFFFFF'))
    paragraph(c, QUESTIONS[n-1], x+43, y+height-12, width-54, 9.7, 13, NAVY)
    text_height = paragraph(c, answer, x+14, y+height-39, width-28, 8.8, 13.1, INK)
    assert text_height < height-47, (n, text_height, answer)


def build(slug, item):
    path = HERE / f'{slug}.pdf'
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle(item['title'] + ' | 落合メソッド')
    c.setAuthor('中沢研究室')
    c.setFillColor(NAVY)
    c.rect(0, H-130, W, 130, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.rect(0, H-135, W, 5, fill=1, stroke=0)
    paragraph(c, '2026  /  PDIII MIDTERM  /  OCHIAI SIX QUESTIONS',
              34, H-20, W-68, 8, 11, HexColor('#9ED9DB'))
    title_height = paragraph(c, item['title'], 34, H-45, W-68,
                             17.2, 24, HexColor('#FFFFFF'))
    assert title_height <= 72, (slug, title_height)
    paragraph(c, f"中沢研究室  |  {item['name']}", 34, H-51-title_height,
              W-68, 9.2, 13, HexColor('#DFEEF2'))

    # Central visual + one-sentence hook.
    c.setFillColor(HexColor('#EBF4F4'))
    c.roundRect(34, 468, 190, 231, 11, fill=1, stroke=0)
    paragraph(c, 'この研究の一行要約', 48, 680, 160, 8.2, 12, TEAL)
    lead_height = paragraph(c, item['lead'], 48, 653, 160, 15.5, 24, NAVY)
    assert lead_height < 170, (slug, lead_height)
    c.setFillColor(GOLD)
    c.roundRect(48, 492, 84, 21, 7, fill=1, stroke=0)
    paragraph(c, item['status'], 55, 507, 75, 8.2, 11, NAVY)

    media_x, media_y, media_w, media_h = 236, 468, W-270, 231
    c.setFillColor(PALE)
    c.roundRect(media_x, media_y, media_w, media_h, 11, fill=1, stroke=0)
    with ZipFile(SOURCE / item['source']) as deck:
        images = item['images']
        gap = 8
        cell_w = (media_w-20-gap*(len(images)-1))/len(images)
        for i, (filename, caption) in enumerate(images):
            x = media_x+10+i*(cell_w+gap)
            c.setFillColor(HexColor('#FFFFFF'))
            c.roundRect(x, media_y+30, cell_w, media_h-40, 5, fill=1, stroke=0)
            im = Image.open(BytesIO(deck.read('ppt/media/'+filename))).convert('RGBA')
            image_contained(c, im, x+4, media_y+34, cell_w-8, media_h-48)
            caption_height = paragraph(c, caption, x+2, media_y+26, cell_w-4,
                                       7.2, 9, MUTED)
            assert caption_height <= 20, (slug, caption)

    card_w = (W-80)/2
    for index, answer in enumerate(item['a']):
        col, row = index%2, index//2
        x = 34 + col*(card_w+12)
        y = 338 - row*130
        draw_card(c, index+1, answer, x, y, card_w, 118)

    c.setStrokeColor(LINE)
    c.line(34, 61, W-34, 61)
    paragraph(c, '出典：' + item['source'] + '  |  2026-09-25',
              34, 51, W-68, 7, 10, MUTED)
    c.showPage()
    c.save()
    subprocess.run(['pdftoppm', '-f', '1', '-singlefile', '-r', '160', '-png',
                    str(path), str(HERE / slug)], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    for slug, item in DATA.items():
        assert len(item['a']) == 6
        build(slug, item)
    print(f'Built {len(DATA)} A4 PDF and PNG pairs in {HERE}')
