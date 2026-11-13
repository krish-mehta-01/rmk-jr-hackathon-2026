"""
add_minimal_labels.py
Adds clean, minimal, realistic labels for:
- RJ Block
- SV Block
- VR Block
Matching the user's request:
"keep building minimal and related to real and mention rj block vr block and sv block"
"""

import os
from PIL import Image, ImageDraw, ImageFont

def create_labeled_maps():
    base_paths = [
        ("accurate_roads", r"C:\Users\krish\.gemini\antigravity\brain\85886fa9-8576-486f-bb61-edd05d989cbf\rmk_campus_isometric_accurate_roads_1794567296769.jpg"),
        ("center_gate", r"C:\Users\krish\.gemini\antigravity\brain\85886fa9-8576-486f-bb61-edd05d989cbf\rmkcet_campus_isometric_1794566480764.jpg")
    ]

    font_dir = r"C:\Windows\Fonts"
    f_label = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 22)
    f_sub = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 14)

    def draw_minimal_pill(draw, cx, cy, title, sub=None, bg_color=(15, 23, 42, 235), text_color=(255, 255, 255)):
        tw = int(draw.textlength(title, font=f_label))
        sw = int(draw.textlength(sub, font=f_sub)) if sub else 0
        w = max(tw, sw) + 32
        h = 52 if sub else 38
        
        x1 = cx - w // 2
        y1 = cy - h // 2
        x2 = cx + w // 2
        y2 = cy + h // 2

        # Soft drop shadow
        draw.rounded_rectangle([x1 + 2, y1 + 3, x2 + 2, y2 + 3], radius=8, fill=(0, 0, 0, 80))
        # Sleek dark glass pill with crisp white border
        draw.rounded_rectangle([x1, y1, x2, y2], radius=8, fill=bg_color, outline=(255, 255, 255, 200), width=2)

        if sub:
            draw.text((cx, cy - 8), title, fill=text_color, font=f_label, anchor="mm")
            draw.text((cx, cy + 13), sub, fill=(203, 213, 225), font=f_sub, anchor="mm")
        else:
            draw.text((cx, cy), title, fill=text_color, font=f_label, anchor="mm")

    # 1. Label accurate_roads image
    img1 = Image.open(base_paths[0][1]).convert("RGBA")
    d1 = ImageDraw.Draw(img1)
    
    # RJ Block: roof center at (520, 540)
    draw_minimal_pill(d1, 520, 530, "RJ Block", "Panels 1, 2, 3, 4, 7, 8, 9")
    # SV Block: roof center at (460, 150)
    draw_minimal_pill(d1, 460, 140, "SV Block & Auditorium", "Panels 6, 13, 14 · Registration")
    # VR Block: roof center at (1150, 210)
    draw_minimal_pill(d1, 1150, 210, "VR Block", "Panels 5, 10, 11, 12, 15")

    out1 = r"frontend\assets\campus_venue_map.jpg"
    img1.convert("RGB").save(out1, quality=95)
    print("Saved accurate_roads with minimal labels to:", out1)

    # 2. Also label center_gate image for comparison
    img2 = Image.open(base_paths[1][1]).convert("RGBA")
    d2 = ImageDraw.Draw(img2)
    # RJ Block in center_gate: at (690, 360)
    draw_minimal_pill(d2, 690, 360, "RJ Block", "Panels 1, 2, 3, 4, 7, 8, 9")
    # SV Block in center_gate: at (520, 130)
    draw_minimal_pill(d2, 520, 130, "SV Block & Auditorium", "Panels 6, 13, 14 · Registration")
    # VR Block in center_gate: at (1130, 280)
    draw_minimal_pill(d2, 1130, 280, "VR Block", "Panels 5, 10, 11, 12, 15")

    out2 = r"frontend\assets\campus_venue_map_center.jpg"
    img2.convert("RGB").save(out2, quality=95)
    print("Saved center_gate with minimal labels to:", out2)

if __name__ == "__main__":
    create_labeled_maps()
