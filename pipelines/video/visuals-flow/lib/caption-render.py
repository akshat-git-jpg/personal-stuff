import sys
import json
import os
from PIL import Image, ImageDraw, ImageFont

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data:
            return
        
        data = json.loads(input_data)
        out_dir = data['outDir']
        width = data['width']
        font_px = data['fontPx']
        chunks = data.get('chunks', [])
        
        os.makedirs(out_dir, exist_ok=True)
        
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', font_px)
        height = int(font_px * 2.2)
        stroke_width = max(2, font_px // 16)
        
        count = 0
        for chunk in chunks:
            i = chunk['i']
            text = chunk['text']
            
            img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            
            x = (width - text_w) // 2 - bbox[0]
            y = (height - text_h) // 2 - bbox[1]
            
            draw.text((x, y), text, font=font, fill='white', stroke_width=stroke_width, stroke_fill='black')
            
            img.save(os.path.join(out_dir, f'cap-{i}.png'))
            count += 1
            
        print(f"{count} rendered")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
