"""
generate_final_maps.py
Generates the authoritative 2D and 3D Campus Maps strictly matching the user's placement sketch
and real photos of RMK College of Engineering and Technology.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

def build_2d_authoritative_map():
    W, H = 2400, 1700
    img = Image.new("RGBA", (W, H), (241, 245, 238, 255))
    draw = ImageDraw.Draw(img)

    # Windows Fonts
    font_dir = r"C:\Windows\Fonts"
    f_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 44)
    f_subtitle = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 22)
    f_block_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 26)
    f_block_sub = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 18)
    f_block_detail = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 16)
    f_badge = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 16)
    f_step = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 20)
    f_legend = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 17)

    # 1. BASE BACKGROUND & CAMPUS GROUNDS
    draw.rectangle([0, 0, W, H], fill=(238, 243, 235))

    # Garden zones matching user's wavy tree scribbles:
    garden_bg = (215, 230, 208)
    lawn_border = (185, 205, 175)

    # Tree zone to the left of the main avenue
    draw.rounded_rectangle([60, 960, 880, 1420], radius=16, fill=garden_bg, outline=lawn_border, width=2)
    # Tree zone to the right of the main avenue
    draw.rounded_rectangle([1320, 960, 2340, 1420], radius=16, fill=garden_bg, outline=lawn_border, width=2)
    # Courtyard garden between RJ and Lower East Block
    draw.rounded_rectangle([1230, 720, 1450, 930], radius=12, fill=garden_bg, outline=lawn_border, width=2)
    # Tree zone on the far left (west of SV road)
    draw.rounded_rectangle([60, 140, 360, 940], radius=16, fill=garden_bg, outline=lawn_border, width=2)
    # Garden zone north of VR Block
    draw.rounded_rectangle([1900, 140, 2340, 940], radius=16, fill=garden_bg, outline=lawn_border, width=2)

    # 2. HIGHWAY AT BOTTOM (Matching User's Sketch with center dashes)
    hw_top = 1460
    hw_bot = 1620
    draw.rectangle([0, hw_top, W, hw_bot], fill=(52, 60, 68))
    # Highway edges
    draw.line([0, hw_top, W, hw_top], fill=(220, 220, 220), width=4)
    draw.line([0, hw_bot, W, hw_bot], fill=(220, 220, 220), width=4)
    # Dashed center line
    mid_hw = (hw_top + hw_bot) // 2
    for x in range(30, W, 70):
        draw.line([x, mid_hw, x + 40, mid_hw], fill=(255, 255, 255), width=4)
    draw.text((W // 2, hw_bot - 24), "CHENNAI - TADA HIGHWAY (NH 16)", fill=(203, 213, 225), font=f_badge, anchor="mb")

    # 3. RMK MAIN ENTRANCE GATE & CENTRAL AVENUE
    gate_w = 260
    gate_left = (W - gate_w) // 2
    gate_right = gate_left + gate_w
    gate_top = 1400

    # Gate structure
    draw.rounded_rectangle([gate_left, gate_top, gate_right, gate_top + 45], radius=8, fill=(255, 255, 255), outline=(148, 163, 184), width=3)
    draw.text((W // 2, gate_top + 22), "RMK MAIN ENTRANCE GATE", fill=(15, 23, 42), font=f_badge, anchor="mm")

    # Central Avenue leading straight UP to RJ Block
    ave_left = 940
    ave_right = 1180
    ave_top = 930
    draw.rectangle([ave_left, ave_top, ave_right, gate_top], fill=(75, 85, 95))
    draw.line([ave_left, ave_top, ave_left, gate_top], fill=(55, 65, 75), width=3)
    draw.line([ave_right, ave_top, ave_right, gate_top], fill=(55, 65, 75), width=3)
    # Dashed center line in Avenue (Matching user's sketch!)
    mid_ave = (ave_left + ave_right) // 2
    for y in range(ave_top + 20, gate_top - 20, 60):
        draw.line([mid_ave, y, mid_ave, y + 35], fill=(245, 245, 245), width=4)

    # Royal Palm Trees lining both sides of the avenue
    def draw_palm(cx, cy, r=18):
        draw.ellipse([cx - r + 3, cy - r*0.7 + 5, cx + r + 3, cy + r*0.7 + 5], fill=(0, 0, 0, 40))
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            fx = cx + int(math.cos(rad) * r)
            fy = cy + int(math.sin(rad) * r * 0.8)
            draw.line([cx, cy, fx, fy], fill=(40, 110, 45), width=3)
        draw.ellipse([cx - r//2, cy - int(r*0.4), cx + r//2, cy + int(r*0.4)], fill=(60, 145, 55))
        draw.ellipse([cx - r//4, cy - int(r*0.2), cx + r//4, cy + int(r*0.2)], fill=(85, 175, 70))

    for py in range(ave_top + 30, gate_top - 20, 50):
        draw_palm(ave_left - 26, py)
        draw_palm(ave_right + 26, py)

    # 4. ROAD SYSTEM AROUND RJ & SV BLOCKS (STRICTLY FROM USER'S SKETCH)
    road_fill = (75, 85, 95)
    road_border = (55, 65, 75)

    # Horizontal road in front of RJ Block (connected to the avenue):
    # Runs from x=380 (left) across to x=1880 (right) at y=900 to 970
    draw.rectangle([380, 900, 1880, 960], fill=road_fill)
    draw.line([380, 900, 1880, 900], fill=road_border, width=2)
    draw.line([380, 960, 1880, 960], fill=road_border, width=2)

    # Left Road wrapping around the LEFT of RJ Block and SV Block:
    # Runs North from y=960 up to y=260 along x=380 to 460
    draw.rectangle([380, 260, 460, 960], fill=road_fill)
    draw.line([380, 260, 380, 960], fill=road_border, width=2)
    draw.line([460, 260, 460, 900], fill=road_border, width=2)

    # Road turning behind SV Block at North:
    draw.rectangle([380, 260, 1400, 320], fill=road_fill)
    draw.line([380, 260, 1400, 260], fill=road_border, width=2)
    draw.line([460, 320, 1400, 320], fill=road_border, width=2)

    # Road between RJ Block and SV Block (connecting from left road to east road & VR):
    draw.rectangle([380, 600, 1400, 680], fill=road_fill)
    draw.line([380, 600, 1400, 600], fill=road_border, width=2)
    draw.line([380, 680, 1400, 680], fill=road_border, width=2)
    for dx in range(480, 1380, 40):
        draw.line([dx, 640, dx + 24, 640], fill=(255, 255, 255), width=3)

    # Vertical Connector Road / Corridor between RJ/SV and VR Block (as drawn in user's sketch):
    # Runs from y=320 down to y=900 at x=1310 to 1390
    draw.rectangle([1310, 320, 1390, 900], fill=road_fill)
    draw.line([1310, 320, 1310, 900], fill=road_border, width=2)
    draw.line([1390, 320, 1390, 900], fill=road_border, width=2)

    # Road on the far right running past VR Block:
    draw.rectangle([1880, 260, 1960, 960], fill=road_fill)
    draw.line([1880, 260, 1880, 960], fill=road_border, width=2)
    draw.line([1960, 260, 1960, 960], fill=road_border, width=2)
    draw.rectangle([1310, 260, 1960, 320], fill=road_fill)

    # 5. BUILDINGS (MATCHING EXACT PLACEMENT FROM USER'S SKETCH)

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 1: RJ BLOCK (Foreground Center-Left)
    # ════════════════════════════════════════════════════════════════════════
    # Positioned at the top of the central avenue: x=660 to 1230, y=720 to 880
    rj_x1, rj_y1 = 660, 710
    rj_x2, rj_y2 = 1250, 870

    # 3D Drop Shadow
    draw.rounded_rectangle([rj_x1 + 8, rj_y1 + 10, rj_x2 + 8, rj_y2 + 10], radius=8, fill=(0, 0, 0, 50))
    # Main White/Cream Building Body
    draw.rounded_rectangle([rj_x1, rj_y1, rj_x2, rj_y2], radius=8, fill=(255, 255, 255), outline=(148, 163, 184), width=3)
    # West Wing (Hatched as drawn in user's sketch)
    draw.rectangle([rj_x1, rj_y1, rj_x1 + 120, rj_y2], fill=(241, 245, 249), outline=(203, 213, 225), width=2)
    for hx in range(rj_x1 + 10, rj_x1 + 120, 16):
        draw.line([hx, rj_y1 + 10, hx + 20, rj_y2 - 10], fill=(203, 213, 225), width=2)
    # East Wing (Hatched as drawn in user's sketch)
    draw.rectangle([rj_x2 - 120, rj_y1, rj_x2, rj_y2], fill=(241, 245, 249), outline=(203, 213, 225), width=2)
    for hx in range(rj_x2 - 120, rj_x2 - 10, 16):
        draw.line([hx, rj_y1 + 10, hx + 20, rj_y2 - 10], fill=(203, 213, 225), width=2)

    # Center Section Entrance Portico (Orange triangular canopy & entrance ticks facing south!)
    port_cx = (rj_x1 + rj_x2) // 2
    port_w = 80
    draw.polygon([(port_cx - port_w//2, rj_y2), (port_cx, rj_y2 + 35), (port_cx + port_w//2, rj_y2)], fill=(224, 112, 45), outline=(180, 80, 25))
    # Entrance ticks (drawn in user's sketch)
    draw.line([port_cx - 20, rj_y2, port_cx - 20, rj_y2 + 25], fill=(255, 255, 255), width=3)
    draw.line([port_cx + 20, rj_y2, port_cx + 20, rj_y2 + 25], fill=(255, 255, 255), width=3)

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 2: SV BLOCK (SRINIVASA BLOCK & AUDITORIUM)
    # Positioned DIRECTLY BEHIND (NORTH OF) RJ BLOCK!
    # ════════════════════════════════════════════════════════════════════════
    sv_x1, sv_y1 = 680, 360
    sv_x2, sv_y2 = 1230, 580

    # 3D Drop Shadow
    draw.rounded_rectangle([sv_x1 + 8, sv_y1 + 10, sv_x2 + 8, sv_y2 + 10], radius=8, fill=(0, 0, 0, 50))
    # Silver-Grey Metallic ACP Body
    draw.rounded_rectangle([sv_x1, sv_y1, sv_x2, sv_y2], radius=8, fill=(226, 232, 240), outline=(148, 163, 184), width=3)
    # Reflective Blue Glass Panels
    draw.rectangle([sv_x1 + 30, sv_y1 + 30, sv_x1 + 140, sv_y2 - 30], fill=(30, 64, 175), outline=(23, 37, 84), width=1)
    draw.rectangle([sv_x2 - 140, sv_y1 + 30, sv_x2 - 30, sv_y2 - 30], fill=(30, 64, 175), outline=(23, 37, 84), width=1)
    # Auditorium Hall section in middle
    draw.rounded_rectangle([sv_x1 + 170, sv_y1 + 25, sv_x2 - 170, sv_y2 - 25], radius=6, fill=(241, 245, 249), outline=(203, 213, 225), width=1)
    draw.text(((sv_x1 + sv_x2)//2, (sv_y1 + sv_y2)//2), "MAIN AUDITORIUM", fill=(100, 116, 139), font=f_badge, anchor="mm")

    # Entrance ticks on SV Block (as drawn in user's sketch):
    # Two ticks at bottom (South, facing courtyard):
    draw.line([sv_x1 + 180, sv_y2, sv_x1 + 180, sv_y2 + 18], fill=(30, 64, 175), width=4)
    draw.line([sv_x1 + 240, sv_y2, sv_x1 + 240, sv_y2 + 18], fill=(30, 64, 175), width=4)
    # Two ticks at left (West, facing side road):
    draw.line([sv_x1, sv_y1 + 100, sv_x1 - 18, sv_y1 + 100], fill=(30, 64, 175), width=4)
    draw.line([sv_x1, sv_y1 + 140, sv_x1 - 18, sv_y1 + 140], fill=(30, 64, 175), width=4)

    # CRITICAL DETAIL FROM USER'S SKETCH:
    # Dashed line `_ _ _ _` in the courtyard in front of SV Block!
    # And the Chevron Canopy Tent!
    dash_y = 640
    for dx in range(sv_x1 + 40, sv_x2 - 40, 50):
        draw.line([dx, dash_y, dx + 30, dash_y], fill=(30, 41, 59), width=3)
    draw.text(((sv_x1 + sv_x2)//2, dash_y - 14), "COURTYARD ACTIVITY ZONE", fill=(100, 116, 139), font=f_badge, anchor="mb")

    # Chevron Activity Tent in Courtyard
    tent_x1, tent_y1 = 510, 610
    tent_x2, tent_y2 = 630, 720
    draw.rectangle([tent_x1, tent_y1, tent_x2, tent_y2], fill=(255, 255, 255), outline=(30, 41, 59), width=2)
    # Zigzag stripes
    for i in range(5):
        sy = tent_y1 + i * 22
        pts = [(tent_x1, sy), ((tent_x1 + tent_x2)//2, sy + 11), (tent_x2, sy), (tent_x2, sy + 11), ((tent_x1 + tent_x2)//2, sy + 22), (tent_x1, sy + 11)]
        draw.polygon(pts, fill=(30, 41, 59) if i % 2 == 0 else (241, 245, 249))
    draw.rounded_rectangle([tent_x1 - 10, tent_y2 + 6, tent_x2 + 10, tent_y2 + 28], radius=4, fill=(15, 23, 42))
    draw.text(((tent_x1 + tent_x2)//2, tent_y2 + 17), "CHEVRON TENT", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 3: VR BLOCK (Upper Right - North-East)
    # ════════════════════════════════════════════════════════════════════════
    vr_x1, vr_y1 = 1450, 360
    vr_x2, vr_y2 = 1840, 580

    draw.rounded_rectangle([vr_x1 + 8, vr_y1 + 10, vr_x2 + 8, vr_y2 + 10], radius=8, fill=(0, 0, 0, 50))
    draw.rounded_rectangle([vr_x1, vr_y1, vr_x2, vr_y2], radius=8, fill=(254, 243, 199), outline=(217, 119, 6), width=3)
    draw.rectangle([vr_x1 + 18, vr_y1 + 18, vr_x2 - 18, vr_y2 - 18], fill=(253, 230, 138), outline=(245, 158, 11), width=1)

    # Connection ticks/pathway into VR from the vertical corridor (Matching User's Sketch):
    draw.line([1390, 450, vr_x1, 450], fill=(217, 119, 6), width=4)
    draw.line([1390, 490, vr_x1, 490], fill=(217, 119, 6), width=4)
    # Wavy shading / path drawn by user:
    for wy in range(430, 510, 8):
        draw.line([1410, wy, 1435, wy + 4], fill=(217, 119, 6), width=2)

    # Ground east of RJ Block: Green lawn & palm trees (Strictly 3 buildings only: RJ, SV, VR)
    draw.rounded_rectangle([1390, 680, 2100, 900], radius=12, fill=garden_bg, outline=lawn_border, width=2)
    for tx in [1480, 1620, 1760, 1900]:
        draw.ellipse([tx - 18, 770, tx + 18, 806], fill=(46, 125, 50))
        draw.ellipse([tx - 12, 755, tx + 12, 785], fill=(76, 175, 80))

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
    draw_nav_arrow((1060, 1400), (1060, 970))

    # Step 2: Turn Left in front of RJ Block and wrap around the Left (West) side
    draw_nav_arrow((1060, 930), (420, 930))
    draw_nav_arrow((420, 930), (420, 660))

    # Step 3: Turn right into Courtyard to Registration & Chevron Tent
    draw_nav_arrow((420, 660), (560, 660))

    # Step 4: Follow Connector Road / Pathway across to VR Block
    draw_nav_arrow((1240, 650), (1350, 650))
    draw_nav_arrow((1350, 650), (1350, 470))
    draw_nav_arrow((1350, 470), (1440, 470))

    # Step Badge Pills
    def draw_step_badge(cx, cy, num_str, title_str):
        r = 16
        draw.ellipse([cx - r + 2, cy - r + 3, cx + r + 2, cy + r + 3], fill=(0, 0, 0, 90))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(220, 38, 38), outline=(255, 255, 255), width=2)
        draw.text((cx, cy), num_str, fill=(255, 255, 255), font=f_step, anchor="mm")
        tw = int(draw.textlength(title_str, font=f_badge))
        draw.rounded_rectangle([cx - tw//2 - 8, cy + r + 4, cx + tw//2 + 8, cy + r + 24], radius=4, fill=(15, 23, 42, 235), outline=(255, 255, 255), width=1)
        draw.text((cx, cy + r + 14), title_str, fill=(255, 255, 255), font=f_badge, anchor="mm")

    draw_step_badge(1060, 1200, "1", "CENTRAL PALM AVENUE")
    draw_step_badge(740, 930, "2", "TURN LEFT AROUND RJ BLOCK")
    draw_step_badge(490, 740, "3", "REGISTRATION & CHEVRON TENT")
    draw_step_badge(1350, 560, "4", "CORRIDOR PATH TO VR BLOCK")

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

    # CARD 1: RJ BLOCK
    rj_lines = [
        "• 1st Floor: Idea Lab I (P01) · Idea Lab II (P09)",
        "• 1st Floor: Co-Work Space (P04)",
        "• 1st Floor: Seminar Hall-A (P07) · Seminar Hall-B (P08)",
        "• 2nd Floor: Seminar Hall-A (P02) · Seminar Hall-B (P03)"
    ]
    draw_card(60, 680, 480, 180, (22, 101, 52), "RJ BLOCK", "7 PANELS · ACADEMIC & INNOVATION CORE", rj_lines, "PANELS 1, 2, 3, 4, 7, 8, 9")

    # CARD 2: SV BLOCK
    sv_lines = [
        "• Ground Floor: Registration & Check-In Desk",
        "• Courtyard: Chevron Event Activity Tent",
        "• 1st Floor: Seminar Hall 1 (P13) · Seminar Hall 2 (P14)",
        "• 1st Floor: Seminar Hall 3 (P06)",
        "• Main Auditorium: Inauguration & Valedictory"
    ]
    draw_card(60, 160, 480, 195, (30, 64, 175), "SV BLOCK (SRINIVASA)", "3 PANELS · AUDITORIUM & REGISTRATION", sv_lines, "PANELS 6, 13, 14")

    # CARD 3: VR BLOCK
    vr_lines = [
        "• Ground Floor: Ground Floor - A (P05) · GF - B (P10)",
        "• 1st Floor: First Floor - A (P11) · FF - B (P12)",
        "• 2nd Floor: Second Floor (P15)"
    ]
    draw_card(1860, 360, 480, 175, (194, 65, 12), "VR BLOCK", "5 PANELS · VISVESVARAYA BLOCK", vr_lines, "PANELS 5, 10, 11, 12, 15")

    # ════════════════════════════════════════════════════════════════════════
    # 8. INSTITUTIONAL HEADER & BRANDING
    # ════════════════════════════════════════════════════════════════════════
    HEADER_H = 100
    draw.rectangle([0, 0, W, HEADER_H], fill=(15, 23, 42))
    draw.rectangle([0, 0, W, 5], fill=(234, 179, 8))
    draw.text((36, 18), "RMK JUNIOR HACKATHON 2026", fill=(255, 255, 255), font=f_title)
    draw.text((36, 62), "OFFICIAL 2D ARCHITECTURAL CAMPUS VENUE & NAVIGATION PLAN · RMKCET", fill=(148, 163, 184), font=f_subtitle)

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
        ((22, 101, 52), "RJ Block (Panels 1, 2, 3, 4, 7, 8, 9)"),
        ((30, 64, 175), "SV Block (Panels 6, 13, 14 & Auditorium)"),
        ((194, 65, 12), "VR Block (Panels 5, 10, 11, 12, 15)"),
        ((220, 38, 38), "Official Navigation Route"),
        ((30, 41, 59), "Chevron Activity Tent & Courtyard"),
        ((148, 163, 184), "Academic & Lab Wing")
    ]
    cur_lx = 40
    for col, txt in legend_items:
        draw.rounded_rectangle([cur_lx, 1650, cur_lx + 22, 1672], radius=4, fill=col, outline=(255, 255, 255, 120), width=1)
        draw.text((cur_lx + 30, 1661), txt, fill=(226, 232, 240), font=f_legend, anchor="lm")
        cur_lx += int(draw.textlength(txt, font=f_legend)) + 50

    # Save outputs
    out_2d_path = r"frontend\assets\campus_venue_map_2d.jpg"
    img_rgb = img.convert("RGB")
    img_rgb.save(out_2d_path, quality=95)
    print("2D Architectural Map saved successfully to:", out_2d_path)

    artifact_2d_path = r"C:\Users\krish\.gemini\antigravity\brain\85886fa9-8576-486f-bb61-edd05d989cbf\rmk_authoritative_2d_campus_map.jpg"
    img_rgb.save(artifact_2d_path, quality=95)
    print("2D Artifact saved to:", artifact_2d_path)

if __name__ == "__main__":
    build_2d_authoritative_map()

