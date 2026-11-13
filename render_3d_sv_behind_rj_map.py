"""
render_3d_sv_behind_rj_map.py
Renders a stunning 3D architectural isometric campus map where:
SV BLOCK IS POSITIONED DIRECTLY BEHIND RJ BLOCK!
Matching the user's hand-drawn placement diagram and real photos of RMKCET.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

def render_map():
    W, H = 2400, 1700
    img = Image.new("RGBA", (W, H), (238, 242, 236, 255))
    draw = ImageDraw.Draw(img)

    # Windows Fonts
    font_dir = r"C:\Windows\Fonts"
    f_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 44)
    f_subtitle = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 22)
    f_block_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 28)
    f_block_sub = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 18)
    f_block_detail = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 16)
    f_badge = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 15)
    f_step = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 20)
    f_legend = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 17)

    # ════════════════════════════════════════════════════════════════════════
    # 1. BASE TERRAIN & GROUNDS
    # ════════════════════════════════════════════════════════════════════════
    draw.rectangle([0, 0, W, H], fill=(234, 241, 231))

    # Lush lawn / garden areas
    garden_col = (212, 228, 204)
    border_col = (182, 204, 172)

    # Left garden (west of avenue & west of road)
    draw.rounded_rectangle([60, 160, 560, 1420], radius=16, fill=garden_col, outline=border_col, width=2)
    # Right garden (east of avenue & east of VR block)
    draw.rounded_rectangle([1650, 1020, 2340, 1420], radius=16, fill=garden_col, outline=border_col, width=2)
    draw.rounded_rectangle([2140, 160, 2340, 1000], radius=16, fill=garden_col, outline=border_col, width=2)

    # Courtyard between RJ and Lower Right Block
    draw.rounded_rectangle([1570, 770, 1730, 960], radius=12, fill=garden_col, outline=border_col, width=2)

    # Bus & Visitor Parking lot on the left of the central avenue
    draw.rounded_rectangle([590, 1040, 1060, 1380], radius=12, fill=(195, 200, 204), outline=(165, 172, 178), width=2)
    for py in [1080, 1150, 1220, 1290, 1350]:
        for px in range(610, 1040, 32):
            draw.line([px, py, px, py + 38], fill=(245, 248, 250), width=2)
    draw.text((825, 1050), "BUS & VISITOR PARKING", fill=(95, 105, 115), font=f_badge, anchor="mt")

    # Formal landscaped gardens on the right of the central avenue
    draw.rounded_rectangle([1340, 1040, 1630, 1380], radius=12, fill=(216, 233, 208), outline=border_col, width=2)
    draw.ellipse([1485 - 80, 1210 - 60, 1485 + 80, 1210 + 60], outline=(170, 195, 155), width=3)
    draw.line([1485, 1060, 1485, 1360], fill=(170, 195, 155), width=3)
    draw.line([1360, 1210, 1610, 1210], fill=(170, 195, 155), width=3)

    # ════════════════════════════════════════════════════════════════════════
    # 2. HIGHWAY AT BOTTOM (Chennai - Tada Highway NH 16)
    # ════════════════════════════════════════════════════════════════════════
    hw_top = 1460
    hw_bot = 1620
    draw.rectangle([0, hw_top, W, hw_bot], fill=(50, 58, 66))
    draw.line([0, hw_top, W, hw_top], fill=(225, 225, 225), width=4)
    draw.line([0, hw_bot, W, hw_bot], fill=(225, 225, 225), width=4)
    mid_hw = (hw_top + hw_bot) // 2
    for x in range(30, W, 70):
        draw.line([x, mid_hw, x + 40, mid_hw], fill=(255, 255, 255), width=4)
    draw.text((W // 2, hw_bot - 24), "CHENNAI - TADA HIGHWAY (NH 16)", fill=(203, 213, 225), font=f_badge, anchor="mb")

    # ════════════════════════════════════════════════════════════════════════
    # 3. RMK MAIN ENTRANCE GATE & CENTRAL AVENUE
    # ════════════════════════════════════════════════════════════════════════
    gate_w = 260
    gate_left = (W - gate_w) // 2
    gate_right = gate_left + gate_w
    gate_top = 1400

    # 3D Gate Shadow & Arch
    draw.rounded_rectangle([gate_left + 4, gate_top + 6, gate_right + 4, gate_top + 46], radius=8, fill=(0, 0, 0, 50))
    draw.rounded_rectangle([gate_left, gate_top, gate_right, gate_top + 42], radius=8, fill=(255, 255, 255), outline=(148, 163, 184), width=3)
    for px in [gate_left + 16, gate_left + 70, gate_right - 70, gate_right - 16]:
        draw.rectangle([px - 8, gate_top - 6, px + 8, gate_top + 46], fill=(241, 245, 249), outline=(148, 163, 184), width=2)
    draw.text((W // 2, gate_top + 21), "RMK MAIN ENTRANCE GATE", fill=(15, 23, 42), font=f_badge, anchor="mm")

    # Central Palm Avenue (leading straight North to RJ Block)
    ave_left = 1080
    ave_right = 1320
    ave_top = 970
    draw.rectangle([ave_left, ave_top, ave_right, gate_top], fill=(72, 82, 92))
    draw.line([ave_left, ave_top, ave_left, gate_top], fill=(55, 65, 75), width=3)
    draw.line([ave_right, ave_top, ave_right, gate_top], fill=(55, 65, 75), width=3)

    # Median with lawn and palms
    med_w = 26
    draw.rectangle([1200 - med_w//2, ave_top + 10, 1200 + med_w//2, gate_top], fill=(130, 175, 110))
    for my in range(ave_top + 25, gate_top - 20, 55):
        draw.ellipse([1200 - 8, my - 8, 1200 + 8, my + 8], fill=(42, 115, 48))

    # Royal Palm Trees along both sides of Avenue
    def draw_palm(cx, cy, r=18):
        draw.ellipse([cx - r + 3, cy - r*0.7 + 5, cx + r + 3, cy + r*0.7 + 5], fill=(0, 0, 0, 40))
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            fx = cx + int(math.cos(rad) * r)
            fy = cy + int(math.sin(rad) * r * 0.8)
            draw.line([cx, cy, fx, fy], fill=(40, 110, 45), width=3)
        draw.ellipse([cx - r//2, cy - int(r*0.4), cx + r//2, cy + int(r*0.4)], fill=(60, 145, 55))
        draw.ellipse([cx - r//4, cy - int(r*0.2), cx + r//4, cy + int(r*0.2)], fill=(85, 175, 70))

    for py in range(ave_top + 20, gate_top - 20, 50):
        draw_palm(ave_left - 24, py)
        draw_palm(ave_right + 24, py)

    # ════════════════════════════════════════════════════════════════════════
    # 4. ROAD NETWORK (MATCHING USER'S SKETCH STRICTLY!)
    # Road curves around the LEFT of RJ Block to get BEHIND RJ Block to SV Block!
    # ════════════════════════════════════════════════════════════════════════
    road_fill = (72, 82, 92)
    road_border = (55, 65, 75)

    # Horizontal road in front of RJ Block:
    # Runs from x=580 across to x=2100 at y=950 to 1020
    draw.rectangle([580, 950, 2100, 1020], fill=road_fill)
    draw.line([580, 950, 2100, 950], fill=road_border, width=2)
    draw.line([580, 1020, 2100, 1020], fill=road_border, width=2)

    # Left Road wrapping around the LEFT (WEST) side of RJ Block:
    # Goes North from y=1020 up to y=260 along x=580 to 670!
    draw.rectangle([580, 260, 670, 1020], fill=road_fill)
    draw.line([580, 260, 580, 1020], fill=road_border, width=2)
    draw.line([670, 260, 670, 950], fill=road_border, width=2)

    # Courtyard Plaza directly BEHIND RJ Block (between RJ and SV Block):
    # Runs x=670 to 1650, y=560 to 760
    draw.rectangle([670, 560, 1650, 760], fill=(95, 105, 115))
    # Dashed activity line across the courtyard in front of SV Block (from user's sketch):
    for dx in range(700, 1620, 50):
        draw.line([dx, 610, dx + 30, 610], fill=(245, 248, 250), width=3)
    draw.text((1160, 590), "COURTYARD ACTIVITY ZONE", fill=(203, 213, 225), font=f_badge, anchor="mb")

    # Connector road running behind RJ Block to VR Block on the East:
    # Runs from x=1550 to 1750 at y=610 to 680
    draw.rectangle([1550, 610, 1760, 680], fill=road_fill)
    draw.line([1550, 610, 1760, 610], fill=road_border, width=2)
    draw.line([1550, 680, 1760, 680], fill=road_border, width=2)

    # North perimeter road behind SV Block:
    draw.rectangle([580, 260, 1650, 320], fill=road_fill)
    draw.line([580, 260, 1650, 260], fill=road_border, width=2)
    draw.line([670, 320, 1650, 320], fill=road_border, width=2)

    # Road on the far right running past VR Block:
    draw.rectangle([2060, 260, 2140, 1020], fill=road_fill)
    draw.line([2060, 260, 2060, 1020], fill=road_border, width=2)
    draw.line([2140, 260, 2140, 1020], fill=road_border, width=2)

    # ════════════════════════════════════════════════════════════════════════
    # 5. 3D ISOMETRIC EXTRUDED BUILDINGS
    # ════════════════════════════════════════════════════════════════════════

    def draw_3d_block(x1, y1, x2, y2, height, body_col, roof_col, shadow_dx=10, shadow_dy=12):
        # 1. 3D Cast Shadow
        draw.rounded_rectangle([x1 + shadow_dx, y1 + shadow_dy, x2 + shadow_dx, y2 + shadow_dy], radius=8, fill=(0, 0, 0, 55))
        # 2. South Facade (Front 3D face)
        draw.rectangle([x1, y2 - height, x2, y2], fill=body_col, outline=(148, 163, 184), width=2)
        # 3. Flat Roof Slab (Top 3D face)
        draw.rounded_rectangle([x1, y1 - height, x2, y2 - height], radius=6, fill=roof_col, outline=(180, 190, 200), width=2)

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 1: RJ BLOCK (Foreground Center)
    # ════════════════════════════════════════════════════════════════════════
    # Position: x=760 to 1560, y=770 to 920
    rj_x1, rj_y1 = 760, 770
    rj_x2, rj_y2 = 1560, 920
    rj_h = 45 # 3-story elevation

    # Shadow
    draw.rounded_rectangle([rj_x1 + 10, rj_y1 + 12, rj_x2 + 10, rj_y2 + 12], radius=10, fill=(0, 0, 0, 60))

    # South Facade (Lower sandstone base, upper white floors)
    draw.rectangle([rj_x1, rj_y2 - rj_h, rj_x2, rj_y2], fill=(255, 255, 255), outline=(148, 163, 184), width=2)
    draw.rectangle([rj_x1, rj_y2 - 16, rj_x2, rj_y2], fill=(234, 219, 195)) # Sandstone lower floor

    # Windows on South Facade
    for wx in range(rj_x1 + 30, rj_x2 - 30, 48):
        draw.rectangle([wx, rj_y2 - rj_h + 8, wx + 24, rj_y2 - rj_h + 20], fill=(51, 65, 85))
        draw.rectangle([wx, rj_y2 - rj_h + 26, wx + 24, rj_y2 - rj_h + 38], fill=(51, 65, 85))

    # Flat Roof Slab
    draw.rounded_rectangle([rj_x1, rj_y1 - rj_h, rj_x2, rj_y2 - rj_h], radius=8, fill=(245, 247, 250), outline=(203, 213, 225), width=2)

    # Hatched West Wing & East Wing (Matching user's sketch)
    draw.rectangle([rj_x1 + 10, rj_y1 - rj_h + 10, rj_x1 + 140, rj_y2 - rj_h - 10], fill=(235, 240, 245), outline=(203, 213, 225), width=1)
    for hx in range(rj_x1 + 20, rj_x1 + 140, 16):
        draw.line([hx, rj_y1 - rj_h + 10, hx + 18, rj_y2 - rj_h - 10], fill=(180, 195, 210), width=2)
    draw.rectangle([rj_x2 - 140, rj_y1 - rj_h + 10, rj_x2 - 10, rj_y2 - rj_h - 10], fill=(235, 240, 245), outline=(203, 213, 225), width=1)
    for hx in range(rj_x2 - 140, rj_x2 - 20, 16):
        draw.line([hx, rj_y1 - rj_h + 10, hx + 18, rj_y2 - rj_h - 10], fill=(180, 195, 210), width=2)

    # Distinctive Orange/Terracotta Triangular Entrance Portico facing South (with entrance ticks!)
    port_cx = (rj_x1 + rj_x2) // 2
    port_w = 90
    draw.polygon([(port_cx - port_w//2, rj_y2), (port_cx, rj_y2 + 38), (port_cx + port_w//2, rj_y2)], fill=(224, 112, 45), outline=(180, 80, 25))
    # Entrance ticks
    draw.line([port_cx - 24, rj_y2, port_cx - 24, rj_y2 + 28], fill=(255, 255, 255), width=3)
    draw.line([port_cx + 24, rj_y2, port_cx + 24, rj_y2 + 28], fill=(255, 255, 255), width=3)

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 2: SV BLOCK (SRINIVASA BLOCK & AUDITORIUM)
    # POSITIONED DIRECTLY BEHIND (NORTH OF) RJ BLOCK!
    # ════════════════════════════════════════════════════════════════════════
    sv_x1, sv_y1 = 760, 340
    sv_x2, sv_y2 = 1560, 540
    sv_h = 55 # High elevation for Auditorium

    # 3D Shadow
    draw.rounded_rectangle([sv_x1 + 10, sv_y1 + 12, sv_x2 + 10, sv_y2 + 12], radius=10, fill=(0, 0, 0, 60))

    # South Facade: Silver-Grey Metallic ACP Cladding + Blue Reflective Glass
    draw.rectangle([sv_x1, sv_y2 - sv_h, sv_x2, sv_y2], fill=(218, 224, 230), outline=(148, 163, 184), width=2)
    # Ribbon blue windows on facade
    draw.rectangle([sv_x1 + 40, sv_y2 - sv_h + 12, sv_x1 + 240, sv_y2 - 12], fill=(30, 64, 175), outline=(23, 37, 84), width=2)
    draw.rectangle([sv_x2 - 240, sv_y2 - sv_h + 12, sv_x2 - 40, sv_y2 - 12], fill=(30, 64, 175), outline=(23, 37, 84), width=2)

    # Flat Roof Slab
    draw.rounded_rectangle([sv_x1, sv_y1 - sv_h, sv_x2, sv_y2 - sv_h], radius=8, fill=(235, 240, 245), outline=(180, 190, 200), width=2)
    # Auditorium acoustic roof block in middle
    draw.rounded_rectangle([sv_x1 + 280, sv_y1 - sv_h + 20, sv_x2 - 280, sv_y2 - sv_h - 20], radius=6, fill=(220, 226, 234), outline=(180, 190, 200), width=1)
    draw.text(((sv_x1 + sv_x2)//2, (sv_y1 + sv_y2)//2 - sv_h), "MAIN AUDITORIUM", fill=(100, 116, 139), font=f_badge, anchor="mm")

    # Entrance ticks on SV Block (from user's sketch):
    # Two ticks at bottom (South, facing courtyard):
    draw.line([sv_x1 + 260, sv_y2, sv_x1 + 260, sv_y2 + 20], fill=(30, 64, 175), width=4)
    draw.line([sv_x1 + 340, sv_y2, sv_x1 + 340, sv_y2 + 20], fill=(30, 64, 175), width=4)
    # Two ticks at left (West, facing side road):
    draw.line([sv_x1, sv_y1 + 80, sv_x1 - 20, sv_y1 + 80], fill=(30, 64, 175), width=4)
    draw.line([sv_x1, sv_y1 + 130, sv_x1 - 20, sv_y1 + 130], fill=(30, 64, 175), width=4)

    # Black-and-White Chevron / Star Striped Activity Tent in Courtyard (between RJ & SV!)
    tent_x1, tent_y1 = 700, 630
    tent_x2, tent_y2 = 840, 740
    draw.rectangle([tent_x1 + 6, tent_y1 + 6, tent_x2 + 6, tent_y2 + 6], fill=(0, 0, 0, 50))
    draw.rectangle([tent_x1, tent_y1, tent_x2, tent_y2], fill=(255, 255, 255), outline=(30, 41, 59), width=2)
    num_chevrons = 5
    ch_h = (tent_y2 - tent_y1) // num_chevrons
    for i in range(num_chevrons):
        cy_t = tent_y1 + i * ch_h
        pts = [(tent_x1, cy_t), ((tent_x1 + tent_x2)//2, cy_t + ch_h//2), (tent_x2, cy_t), (tent_x2, cy_t + ch_h), ((tent_x1 + tent_x2)//2, cy_t + ch_h + ch_h//2), (tent_x1, cy_t + ch_h)]
        draw.polygon(pts, fill=(30, 41, 59) if i % 2 == 0 else (241, 245, 249))
    draw.rounded_rectangle([tent_x1 - 10, tent_y2 + 4, tent_x2 + 10, tent_y2 + 26], radius=4, fill=(15, 23, 42))
    draw.text(((tent_x1 + tent_x2)//2, tent_y2 + 15), "CHEVRON ACTIVITY TENT", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 3: VR BLOCK (East / Upper Right)
    # ════════════════════════════════════════════════════════════════════════
    vr_x1, vr_y1 = 1760, 340
    vr_x2, vr_y2 = 2040, 600
    vr_h = 45

    draw.rounded_rectangle([vr_x1 + 8, vr_y1 + 10, vr_x2 + 8, vr_y2 + 10], radius=8, fill=(0, 0, 0, 50))
    draw.rectangle([vr_x1, vr_y2 - vr_h, vr_x2, vr_y2], fill=(254, 243, 199), outline=(217, 119, 6), width=2)
    draw.rounded_rectangle([vr_x1, vr_y1 - vr_h, vr_x2, vr_y2 - vr_h], radius=6, fill=(253, 230, 138), outline=(245, 158, 11), width=2)

    # Corridor ticks/pathway into VR Block from connector road:
    draw.line([1680, 520, vr_x1, 520], fill=(217, 119, 6), width=4)
    draw.line([1680, 560, vr_x1, 560], fill=(217, 119, 6), width=4)
    for wy in range(500, 580, 8):
        draw.line([1700, wy, 1725, wy + 4], fill=(217, 119, 6), width=2)

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 4: LOWER RIGHT ACADEMIC BLOCK (South of VR, East of RJ)
    # Matching the block drawn below VR in user's sketch!
    # ════════════════════════════════════════════════════════════════════════
    lr_x1, lr_y1 = 1760, 770
    lr_x2, lr_y2 = 2040, 920
    lr_h = 35

    draw.rounded_rectangle([lr_x1 + 8, lr_y1 + 10, lr_x2 + 8, lr_y2 + 10], radius=8, fill=(0, 0, 0, 50))
    draw.rectangle([lr_x1, lr_y2 - lr_h, lr_x2, lr_y2], fill=(241, 245, 249), outline=(148, 163, 184), width=2)
    draw.rounded_rectangle([lr_x1, lr_y1 - lr_h, lr_x2, lr_y2 - lr_h], radius=6, fill=(248, 250, 252), outline=(203, 213, 225), width=2)
    draw.text(((lr_x1 + lr_x2)//2, (lr_y1 + lr_y2)//2 - lr_h), "ACADEMIC & LAB WING", fill=(100, 116, 139), font=f_badge, anchor="mm")

    # ════════════════════════════════════════════════════════════════════════
    # 6. STEP-BY-STEP DIRECTIONAL ROUTE ARROWS
    # ════════════════════════════════════════════════════════════════════════
    def draw_nav_arrow(p1, p2, width=7, arrow_size=20):
        draw.line([p1, p2], fill=(255, 255, 255), width=width + 4)
        draw.line([p1, p2], fill=(220, 38, 38), width=width)
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        dist = math.hypot(dx, dy)
        if dist < 1: return
        ux, uy = dx / dist, dy / dist
        px, py = -uy, ux
        left = (p2[0] - ux * arrow_size + px * (arrow_size * 0.55), p2[1] - uy * arrow_size + py * (arrow_size * 0.55))
        right = (p2[0] - ux * arrow_size - px * (arrow_size * 0.55), p2[1] - uy * arrow_size - py * (arrow_size * 0.55))
        draw.polygon([p2, left, right], fill=(255, 255, 255))
        inner_left = (p2[0] - ux * (arrow_size-3) + px * ((arrow_size-3) * 0.5), p2[1] - uy * (arrow_size-3) + py * ((arrow_size-3) * 0.5))
        inner_right = (p2[0] - ux * (arrow_size-3) - px * ((arrow_size-3) * 0.5), p2[1] - uy * (arrow_size-3) - py * ((arrow_size-3) * 0.5))
        draw.polygon([p2, inner_left, inner_right], fill=(220, 38, 38))

    # Step 1: Up Central Avenue from Main Gate
    draw_nav_arrow((1200, 1400), (1200, 990))

    # Step 2: Turn Left in front of RJ Block and wrap around the LEFT side of RJ Block
    draw_nav_arrow((1200, 985), (625, 985))
    draw_nav_arrow((625, 985), (625, 680))

    # Step 3: Turn right into Courtyard behind RJ Block to SV Block & Chevron Tent
    draw_nav_arrow((625, 680), (740, 680))

    # Step 4: Corridor behind RJ Block leading East to VR Block
    draw_nav_arrow((1560, 645), (1750, 645))
    draw_nav_arrow((1750, 645), (1750, 540))

    # Step Badges
    def draw_step_badge(cx, cy, num_str, title_str):
        r = 16
        draw.ellipse([cx - r + 2, cy - r + 3, cx + r + 2, cy + r + 3], fill=(0, 0, 0, 90))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(220, 38, 38), outline=(255, 255, 255), width=2)
        draw.text((cx, cy), num_str, fill=(255, 255, 255), font=f_step, anchor="mm")
        tw = int(draw.textlength(title_str, font=f_badge))
        draw.rounded_rectangle([cx - tw//2 - 8, cy + r + 4, cx + tw//2 + 8, cy + r + 24], radius=4, fill=(15, 23, 42, 235), outline=(255, 255, 255), width=1)
        draw.text((cx, cy + r + 14), title_str, fill=(255, 255, 255), font=f_badge, anchor="mm")

    draw_step_badge(1200, 1180, "1", "CENTRAL PALM AVENUE")
    draw_step_badge(900, 985, "2", "TURN LEFT AROUND RJ BLOCK")
    draw_step_badge(680, 770, "3", "SV BLOCK COURTYARD & REGISTRATION")
    draw_step_badge(1650, 645, "4", "CORRIDOR PATH TO VR BLOCK")

    # ════════════════════════════════════════════════════════════════════════
    # 7. HIGH-CONTRAST VENUE CALLOUT CARDS
    # ════════════════════════════════════════════════════════════════════════
    def draw_card(x, y, w, h, header_bg, title, subtitle, lines, badge_text=""):
        draw.rounded_rectangle([x + 4, y + 6, x + w + 4, y + h + 6], radius=10, fill=(0, 0, 0, 110))
        draw.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=(255, 255, 255, 250), outline=(226, 232, 240), width=2)
        header_h = 42
        draw.rounded_rectangle([x, y, x + w, y + header_h], radius=10, fill=header_bg)
        draw.rectangle([x, y + header_h - 8, x + w, y + header_h], fill=header_bg)
        draw.text((x + 14, y + 11), title, fill=(255, 255, 255), font=f_block_title)
        if badge_text:
            bw = int(draw.textlength(badge_text, font=f_badge)) + 16
            draw.rounded_rectangle([x + w - bw - 10, y + 7, x + w - 10, y + 35], radius=6, fill=(255, 255, 255))
            draw.text((x + w - bw//2 - 10, y + 21), badge_text, fill=header_bg, font=f_badge, anchor="mm")
        draw.text((x + 14, y + header_h + 9), subtitle, fill=(15, 23, 42), font=f_block_sub)
        ly = y + header_h + 33
        for line in lines:
            draw.text((x + 14, ly), line, fill=(51, 65, 85), font=f_block_detail)
            ly += 21

    # CARD 1: RJ BLOCK (Foreground)
    rj_lines = [
        "• 1st Floor: Idea Lab I (P01) · Idea Lab II (P09)",
        "• 1st Floor: Co-Work Space (P04)",
        "• 1st Floor: Seminar Hall-A (P07) · Seminar Hall-B (P08)",
        "• 2nd Floor: Seminar Hall-A (P02) · Seminar Hall-B (P03)"
    ]
    draw_card(60, 770, 500, 180, (22, 101, 52), "RJ BLOCK", "7 PANELS · ACADEMIC & INNOVATION CORE", rj_lines, "PANELS 1, 2, 3, 4, 7, 8, 9")

    # CARD 2: SV BLOCK (DIRECTLY BEHIND RJ BLOCK!)
    sv_lines = [
        "• Position: DIRECTLY BEHIND RJ BLOCK",
        "• Ground Floor: Registration & Check-In Desk",
        "• Courtyard: Chevron Event Activity Tent",
        "• 1st Floor: Seminar Hall 1 (P13) · Seminar Hall 2 (P14)",
        "• 1st Floor: Seminar Hall 3 (P06)",
        "• Main Auditorium: Inauguration & Valedictory"
    ]
    draw_card(60, 160, 500, 215, (30, 64, 175), "SV BLOCK (SRINIVASA)", "3 PANELS · AUDITORIUM & REGISTRATION", sv_lines, "PANELS 6, 13, 14")

    # CARD 3: VR BLOCK (East / Upper Right)
    vr_lines = [
        "• Ground Floor: Ground Floor - A (P05) · GF - B (P10)",
        "• 1st Floor: First Floor - A (P11) · FF - B (P12)",
        "• 2nd Floor: Second Floor (P15)"
    ]
    draw_card(1840, 160, 500, 175, (194, 65, 12), "VR BLOCK", "5 PANELS · VISVESVARAYA BLOCK", vr_lines, "PANELS 5, 10, 11, 12, 15")

    # ════════════════════════════════════════════════════════════════════════
    # 8. INSTITUTIONAL HEADER & BRANDING
    # ════════════════════════════════════════════════════════════════════════
    HEADER_H = 100
    draw.rectangle([0, 0, W, HEADER_H], fill=(15, 23, 42))
    draw.rectangle([0, 0, W, 5], fill=(234, 179, 8))
    draw.text((36, 18), "RMK JUNIOR HACKATHON 2026", fill=(255, 255, 255), font=f_title)
    draw.text((36, 62), "OFFICIAL CAMPUS VENUE & JURY EVALUATION NAVIGATION MAP · RMKCET", fill=(148, 163, 184), font=f_subtitle)

    # Compass
    cx, cy = W - 70, 50
    draw.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(30, 41, 59), outline=(71, 85, 105), width=2)
    draw.polygon([(cx, cy - 19), (cx - 7, cy + 5), (cx, cy)], fill=(239, 68, 68))
    draw.polygon([(cx, cy - 19), (cx + 7, cy + 5), (cx, cy)], fill=(220, 38, 38))
    draw.polygon([(cx, cy + 19), (cx - 7, cy + 5), (cx, cy)], fill=(203, 213, 225))
    draw.polygon([(cx, cy + 19), (cx + 7, cy + 5), (cx, cy)], fill=(148, 163, 184))
    draw.text((cx, cy - 26), "N", fill=(239, 68, 68), font=f_badge, anchor="mb")

    # ════════════════════════════════════════════════════════════════════════
    # 9. BOTTOM LEGEND BAR
    # ════════════════════════════════════════════════════════════════════════
    draw.rectangle([0, 1630, W, H], fill=(15, 23, 42))
    draw.line([0, 1630, W, 1630], fill=(51, 65, 85), width=2)

    legend_items = [
        ((22, 101, 52), "RJ Block (Foreground · Panels 1, 2, 3, 4, 7, 8, 9)"),
        ((30, 64, 175), "SV Block (Directly Behind RJ · Panels 6, 13, 14 & Auditorium)"),
        ((194, 65, 12), "VR Block (East Wing · Panels 5, 10, 11, 12, 15)"),
        ((220, 38, 38), "Road Loop (Around Left of RJ to reach SV Behind)"),
        ((30, 41, 59), "Chevron Activity Tent & Courtyard")
    ]
    cur_lx = 40
    for col, txt in legend_items:
        draw.rounded_rectangle([cur_lx, 1650, cur_lx + 22, 1672], radius=4, fill=col, outline=(255, 255, 255, 120), width=1)
        draw.text((cur_lx + 30, 1661), txt, fill=(226, 232, 240), font=f_legend, anchor="lm")
        cur_lx += int(draw.textlength(txt, font=f_legend)) + 50

    # Save outputs
    out_map_path = r"frontend\assets\campus_venue_map.jpg"
    img_rgb = img.convert("RGB")
    img_rgb.save(out_map_path, quality=95)
    print("Master Map (SV Behind RJ) saved to:", out_map_path)

    artifact_map_path = r"C:\Users\krish\.gemini\antigravity\brain\85886fa9-8576-486f-bb61-edd05d989cbf\rmk_sv_behind_rj_authoritative_map.jpg"
    img_rgb.save(artifact_map_path, quality=95)
    print("Artifact saved to:", artifact_map_path)

if __name__ == "__main__":
    render_map()
