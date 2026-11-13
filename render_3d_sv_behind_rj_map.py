"""
render_3d_sv_behind_rj_map.py
Renders a clean, photorealistic 3D architectural campus map matching the user's exact description:
1. Behind RJ and in front of SV is just road.
2. From right of RJ there is NO road to VR.
3. The road goes from the front of RJ around the LEFT (SV side), passes behind RJ, and goes EAST to VR.
4. In between the road to VR and the Auditorium/SV Block, there is a grove of coconut trees and shrubs.
5. NO UI cards, banners, or boxes.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

def render_map():
    W, H = 2400, 1600
    img = Image.new("RGBA", (W, H), (236, 242, 234, 255))
    draw = ImageDraw.Draw(img)

    font_dir = r"C:\Windows\Fonts"
    f_badge = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 16)
    f_building_label = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 28)

    # 1. BASE TERRAIN & GROUNDS
    draw.rectangle([0, 0, W, H], fill=(232, 240, 228))

    garden_col = (210, 226, 202)
    border_col = (180, 202, 170)

    # Lush lawns & tropical garden groves flanking both sides of the central avenue (NO parking lot)
    draw.rounded_rectangle([60, 160, 960, 1380], radius=16, fill=garden_col, outline=border_col, width=2)
    draw.rounded_rectangle([1440, 780, 2340, 1380], radius=16, fill=garden_col, outline=border_col, width=2)
    draw.rounded_rectangle([2120, 160, 2340, 780], radius=16, fill=garden_col, outline=border_col, width=2)

    # Ground to the RIGHT of RJ Block is green lawn/trees (NO road from right of RJ to VR!)
    draw.rounded_rectangle([1620, 780, 2100, 1020], radius=12, fill=garden_col, outline=border_col, width=2)

    # Formal Mughal-style landscaped circular hedges on the lawns
    for cx_g in [500, 1750]:
        draw.ellipse([cx_g - 90, 1140 - 70, cx_g + 90, 1140 + 70], outline=(165, 192, 150), width=3)
        draw.line([cx_g, 1020, cx_g, 1260], fill=(165, 192, 150), width=3)
        draw.line([cx_g - 120, 1140, cx_g + 120, 1140], fill=(165, 192, 150), width=3)

    # 2. HIGHWAY AT BOTTOM (Chennai - Tada Highway)
    hw_top = 1420
    hw_bot = 1560
    draw.rectangle([0, hw_top, W, hw_bot], fill=(48, 56, 64))
    draw.line([0, hw_top, W, hw_top], fill=(225, 225, 225), width=4)
    draw.line([0, hw_bot, W, hw_bot], fill=(225, 225, 225), width=4)
    mid_hw = (hw_top + hw_bot) // 2
    for x in range(30, W, 70):
        draw.line([x, mid_hw, x + 40, mid_hw], fill=(255, 255, 255), width=4)
    draw.text((W // 2, hw_bot - 24), "CHENNAI - TADA HIGHWAY (NH 16)", fill=(203, 213, 225), font=f_badge, anchor="mb")

    # 3. RMK MAIN ENTRANCE ARCH GATE
    gate_w = 280
    gate_left = (W - gate_w) // 2
    gate_right = gate_left + gate_w
    gate_top = 1350

    draw.rounded_rectangle([gate_left + 4, gate_top + 6, gate_right + 4, gate_top + 48], radius=8, fill=(0, 0, 0, 50))
    draw.rounded_rectangle([gate_left, gate_top, gate_right, gate_top + 44], radius=8, fill=(255, 255, 255), outline=(148, 163, 184), width=3)
    for px in [gate_left + 20, gate_left + 80, gate_right - 80, gate_right - 20]:
        draw.rectangle([px - 8, gate_top - 6, px + 8, gate_top + 48], fill=(241, 245, 249), outline=(148, 163, 184), width=2)
    draw.text((W // 2, gate_top + 22), "RMK MAIN ENTRANCE GATE", fill=(15, 23, 42), font=f_badge, anchor="mm")

    # 4. LONG CENTRAL PALM AVENUE (Distance is a bit more!)
    ave_left = 1080
    ave_right = 1320
    ave_top = 920 # Long avenue stretching from y=1350 up to y=920
    draw.rectangle([ave_left, ave_top, ave_right, gate_top], fill=(70, 80, 90))
    draw.line([ave_left, ave_top, ave_left, gate_top], fill=(55, 65, 75), width=3)
    draw.line([ave_right, ave_top, ave_right, gate_top], fill=(55, 65, 75), width=3)

    # Median with lawn and royal palm trees
    med_w = 26
    draw.rectangle([1200 - med_w//2, ave_top + 10, 1200 + med_w//2, gate_top], fill=(125, 170, 105))

    def draw_palm(cx, cy, r=20):
        draw.ellipse([cx - r + 3, cy - r*0.7 + 5, cx + r + 3, cy + r*0.7 + 5], fill=(0, 0, 0, 40))
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            fx = cx + int(math.cos(rad) * r)
            fy = cy + int(math.sin(rad) * r * 0.8)
            draw.line([cx, cy, fx, fy], fill=(38, 105, 42), width=3)
        draw.ellipse([cx - r//2, cy - int(r*0.4), cx + r//2, cy + int(r*0.4)], fill=(55, 140, 50))
        draw.ellipse([cx - r//4, cy - int(r*0.2), cx + r//4, cy + int(r*0.2)], fill=(80, 170, 68))

    for py in range(ave_top + 25, gate_top - 20, 55):
        draw.ellipse([1200 - 8, py - 8, 1200 + 8, py + 8], fill=(38, 105, 42)) # On median
        draw_palm(ave_left - 26, py) # Left of avenue
        draw_palm(ave_right + 26, py) # Right of avenue

    # Dense trees filling the lawns left & right of avenue
    tree_coords = [
        (400, 1050), (650, 1080), (850, 1120), (350, 1220), (550, 1260), (750, 1300),
        (1550, 1050), (1800, 1080), (2000, 1120), (1600, 1220), (1850, 1260), (2050, 1300),
        (300, 850), (500, 880), (250, 650), (450, 680), (250, 450), (450, 480)
    ]
    for tx, ty in tree_coords:
        draw_palm(tx, ty, r=24)

    # 5. ROAD NETWORK (MATCHING USER'S EXACT SPECIFICATION!)
    # Road curves around LEFT of RJ Block, passes BEHIND RJ (in front of SV), and goes to VR!
    # THERE IS NO ROAD ON THE RIGHT OF RJ BLOCK!
    road_fill = (70, 80, 90)
    road_border = (55, 65, 75)

    # Road in front of RJ Block:
    # Runs from the avenue (x=1080) LEFT to x=580 at y=900 to 970
    draw.rectangle([580, 900, 1320, 970], fill=road_fill)
    draw.line([580, 970, 1320, 970], fill=road_border, width=2)
    # Notice: It terminates at x=1320 in front of RJ! There is NO road going right of RJ!

    # Left Road wrapping around the LEFT (WEST) side of RJ Block:
    # Runs North from y=970 up to y=480 along x=580 to 670
    draw.rectangle([580, 480, 670, 970], fill=road_fill)
    draw.line([580, 480, 580, 970], fill=road_border, width=2)
    draw.line([670, 480, 670, 900], fill=road_border, width=2)

    # "behind rj and front of sv is just road":
    # Broad asphalt roadway running directly behind RJ Block and in front of SV Block!
    # Runs from x=670 all the way East to x=1760 at y=520 to 640!
    draw.rectangle([670, 520, 1760, 640], fill=road_fill)
    draw.line([670, 520, 1760, 520], fill=road_border, width=2)
    draw.line([670, 640, 1600, 640], fill=road_border, width=2)

    # Road arrives directly at VR Block on the right:
    draw.rectangle([1740, 400, 1820, 640], fill=road_fill)
    draw.line([1820, 400, 1820, 640], fill=road_border, width=2)

    # 6. CENTRAL GARDEN (BETWEEN ROAD TO VR AND AUDITORIUM):
    # "and in between road of vr and auditorium their is some coconut tree and shrubs"
    # Position: North of the road (y < 520), East of SV Block (x = 1580 to 1750), y = 240 to 520
    draw.rounded_rectangle([1580, 240, 1750, 515], radius=12, fill=(195, 218, 185), outline=border_col, width=2)
    for cy_p in range(270, 500, 45):
        draw_palm(1640, cy_p, r=22)
        draw_palm(1700, cy_p + 20, r=20)

    # 7. 3D ISOMETRIC EXTRUDED BUILDINGS

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 1: RJ BLOCK (Foreground Center)
    # ════════════════════════════════════════════════════════════════════════
    rj_x1, rj_y1 = 760, 690
    rj_x2, rj_y2 = 1580, 850
    rj_h = 45

    # Shadow
    draw.rounded_rectangle([rj_x1 + 10, rj_y1 + 12, rj_x2 + 10, rj_y2 + 12], radius=10, fill=(0, 0, 0, 60))
    # South Facade
    draw.rectangle([rj_x1, rj_y2 - rj_h, rj_x2, rj_y2], fill=(255, 255, 255), outline=(148, 163, 184), width=2)
    draw.rectangle([rj_x1, rj_y2 - 16, rj_x2, rj_y2], fill=(234, 219, 195)) # Sandstone lower floor

    # Windows on South Facade
    for wx in range(rj_x1 + 35, rj_x2 - 35, 48):
        draw.rectangle([wx, rj_y2 - rj_h + 8, wx + 24, rj_y2 - rj_h + 20], fill=(51, 65, 85))
        draw.rectangle([wx, rj_y2 - rj_h + 26, wx + 24, rj_y2 - rj_h + 38], fill=(51, 65, 85))

    # Flat Roof Slab
    draw.rounded_rectangle([rj_x1, rj_y1 - rj_h, rj_x2, rj_y2 - rj_h], radius=8, fill=(245, 247, 250), outline=(203, 213, 225), width=2)

    # Orange Triangular Entrance Portico facing South (Avenue)
    port_cx = (rj_x1 + rj_x2) // 2
    port_w = 90
    draw.polygon([(port_cx - port_w//2, rj_y2), (port_cx, rj_y2 + 38), (port_cx + port_w//2, rj_y2)], fill=(224, 112, 45), outline=(180, 80, 25))
    draw.line([port_cx - 24, rj_y2, port_cx - 24, rj_y2 + 28], fill=(255, 255, 255), width=3)
    draw.line([port_cx + 24, rj_y2, port_cx + 24, rj_y2 + 28], fill=(255, 255, 255), width=3)

    # Clean text label on roof
    draw.text(((rj_x1 + rj_x2)//2, (rj_y1 + rj_y2)//2 - rj_h), "RJ BLOCK", fill=(30, 41, 59), font=f_building_label, anchor="mm")

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 2: SV BLOCK (SRINIVASA BLOCK & AUDITORIUM)
    # POSITIONED DIRECTLY BEHIND (NORTH OF) RJ BLOCK!
    # ════════════════════════════════════════════════════════════════════════
    sv_x1, sv_y1 = 760, 240
    sv_x2, sv_y2 = 1580, 460
    sv_h = 55

    # Shadow
    draw.rounded_rectangle([sv_x1 + 10, sv_y1 + 12, sv_x2 + 10, sv_y2 + 12], radius=10, fill=(0, 0, 0, 60))

    # South Facade: Silver-Grey Metallic ACP Cladding + Blue Reflective Glass
    draw.rectangle([sv_x1, sv_y2 - sv_h, sv_x2, sv_y2], fill=(218, 224, 230), outline=(148, 163, 184), width=2)
    draw.rectangle([sv_x1 + 40, sv_y2 - sv_h + 12, sv_x1 + 240, sv_y2 - 12], fill=(30, 64, 175), outline=(23, 37, 84), width=2)
    draw.rectangle([sv_x2 - 240, sv_y2 - sv_h + 12, sv_x2 - 40, sv_y2 - 12], fill=(30, 64, 175), outline=(23, 37, 84), width=2)

    # Flat Roof Slab
    draw.rounded_rectangle([sv_x1, sv_y1 - sv_h, sv_x2, sv_y2 - sv_h], radius=8, fill=(235, 240, 245), outline=(180, 190, 200), width=2)
    draw.text(((sv_x1 + sv_x2)//2, (sv_y1 + sv_y2)//2 - sv_h), "SV BLOCK & AUDITORIUM", fill=(30, 41, 59), font=f_building_label, anchor="mm")

    # Black & White Chevron Pavilion Tent (Sitting on the road in front of SV Block / behind RJ Block)
    tent_x1, tent_y1 = 1040, 530
    tent_x2, tent_y2 = 1260, 630
    draw.rectangle([tent_x1 + 6, tent_y1 + 6, tent_x2 + 6, tent_y2 + 6], fill=(0, 0, 0, 50))
    draw.rectangle([tent_x1, tent_y1, tent_x2, tent_y2], fill=(255, 255, 255), outline=(30, 41, 59), width=2)
    num_chevrons = 5
    ch_h = (tent_y2 - tent_y1) // num_chevrons
    for i in range(num_chevrons):
        cy_t = tent_y1 + i * ch_h
        pts = [(tent_x1, cy_t), ((tent_x1 + tent_x2)//2, cy_t + ch_h//2), (tent_x2, cy_t), (tent_x2, cy_t + ch_h), ((tent_x1 + tent_x2)//2, cy_t + ch_h + ch_h//2), (tent_x1, cy_t + ch_h)]
        draw.polygon(pts, fill=(30, 41, 59) if i % 2 == 0 else (241, 245, 249))

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 3: VR BLOCK (East / Upper Right)
    # ════════════════════════════════════════════════════════════════════════
    vr_x1, vr_y1 = 1800, 240
    vr_x2, vr_y2 = 2080, 540
    vr_h = 45

    draw.rounded_rectangle([vr_x1 + 8, vr_y1 + 10, vr_x2 + 8, vr_y2 + 10], radius=8, fill=(0, 0, 0, 50))
    draw.rectangle([vr_x1, vr_y2 - vr_h, vr_x2, vr_y2], fill=(254, 243, 199), outline=(217, 119, 6), width=2)
    draw.rounded_rectangle([vr_x1, vr_y1 - vr_h, vr_x2, vr_y2 - vr_h], radius=6, fill=(253, 230, 138), outline=(245, 158, 11), width=2)
    draw.text(((vr_x1 + vr_x2)//2, (vr_y1 + vr_y2)//2 - vr_h), "VR BLOCK", fill=(120, 53, 15), font=f_building_label, anchor="mm")

    # Save to frontend/assets/campus_venue_map.jpg
    out_path = r"frontend\assets\campus_venue_map.jpg"
    img_rgb = img.convert("RGB")
    img_rgb.save(out_path, quality=95)
    print("Master clean 3D map saved to:", out_path)

if __name__ == "__main__":
    render_map()
