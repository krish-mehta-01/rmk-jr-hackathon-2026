"""
generate_master_campus_map.py
Generates a high-resolution (2400x1600) 2D/3D Architectural Masterplan Campus Navigation Map
for RMK Junior Hackathon 2026 matching the real campus aerial and satellite ground truth.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_campus_master_map():
    W, H = 2400, 1600
    img = Image.new("RGBA", (W, H), (238, 242, 235, 255))
    draw = ImageDraw.Draw(img)

    # Fonts
    font_dir = r"C:\Windows\Fonts"
    f_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 48)
    f_subtitle = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 26)
    f_block_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 30)
    f_block_sub = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 20)
    f_block_detail = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 18)
    f_badge = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 16)
    f_step = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 22)
    f_legend = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 18)
    f_legend_bold = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 20)

    # 1. BASE BACKGROUND & TERRAIN
    # Soft lush grass background
    draw.rectangle([0, 0, W, H], fill=(234, 241, 230))

    # Landscaped garden zones (rich green textures)
    garden_color = (212, 228, 204)
    lawn_border = (185, 208, 172)
    
    # Left campus lawn (west of road)
    draw.rounded_rectangle([60, 160, 420, 1340], radius=16, fill=garden_color, outline=lawn_border, width=2)
    # Right campus lawn (east of VR block)
    draw.rounded_rectangle([1980, 160, 2340, 1340], radius=16, fill=garden_color, outline=lawn_border, width=2)
    # Central courtyard garden between RJ, SV, and VR blocks
    draw.rounded_rectangle([920, 360, 1540, 840], radius=24, fill=(204, 224, 195), outline=lawn_border, width=3)

    # Formal front garden (east of central avenue)
    draw.rounded_rectangle([1380, 1020, 1960, 1340], radius=16, fill=(216, 232, 208), outline=lawn_border, width=2)
    # Geometric decorative garden hedges in front garden
    for r in [60, 110, 160]:
        draw.ellipse([1670 - r, 1180 - r*0.7, 1670 + r, 1180 + r*0.7], outline=(175, 200, 160), width=3)
    draw.line([1670, 1040, 1670, 1320], fill=(175, 200, 160), width=3)
    draw.line([1400, 1180, 1940, 1180], fill=(175, 200, 160), width=3)

    # 2. PARKING LOT (West of Central Palm Avenue, South-West)
    draw.rounded_rectangle([440, 1020, 1020, 1340], radius=12, fill=(195, 200, 202), outline=(170, 175, 178), width=2)
    # Parking stalls / painted bays
    for y_row in [1060, 1130, 1200, 1270]:
        for x_bay in range(460, 1000, 32):
            draw.line([x_bay, y_row, x_bay, y_row + 45], fill=(245, 245, 245), width=2)
    # Parking label
    draw.text((730, 1030), "BUS & VISITOR PARKING", fill=(100, 110, 115), font=f_badge, anchor="mt")

    # 3. HIGHWAY AT BOTTOM (Chennai - Tada Highway NH 16)
    hw_top = 1380
    hw_bottom = 1520
    draw.rectangle([0, hw_top, W, hw_bottom], fill=(55, 62, 68))
    # Highway lane markings
    mid_hw = (hw_top + hw_bottom) // 2
    for x in range(30, W, 70):
        draw.line([x, mid_hw, x + 40, mid_hw], fill=(255, 255, 255), width=4)
    # Highway edges
    draw.line([0, hw_top, W, hw_top], fill=(220, 220, 220), width=3)
    draw.line([0, hw_bottom, W, hw_bottom], fill=(220, 220, 220), width=3)
    # Highway label
    draw.text((W // 2, hw_bottom - 24), "CHENNAI - TADA HIGHWAY (NH 16)", fill=(200, 210, 220), font=f_badge, anchor="mb")

    # 4. ROAD NETWORK & ASPHALT DRIVEWAYS
    road_fill = (80, 88, 95)
    road_border = (65, 72, 78)
    asphalt_plaza = (92, 100, 108)

    # Central Palm Avenue (from Main Gate to RJ Block)
    # Runs from y=1380 up to y=920, center at x=1200, width=140
    ave_left = 1130
    ave_right = 1270
    draw.rectangle([ave_left, 900, ave_right, hw_top], fill=road_fill)
    draw.line([ave_left, 900, ave_left, hw_top], fill=road_border, width=3)
    draw.line([ave_right, 900, ave_right, hw_top], fill=road_border, width=3)
    # Center median with green lawn & palms
    median_w = 24
    draw.rectangle([1200 - median_w//2, 920, 1200 + median_w//2, hw_top], fill=(130, 175, 110))
    for my in range(940, hw_top - 30, 60):
        # Palm tree dots on median
        draw.ellipse([1200 - 8, my - 8, 1200 + 8, my + 8], fill=(45, 110, 40))

    # Road looping LEFT around RJ Block:
    # 1. Driveway in front of RJ Block portico: curves left (West)
    draw.rectangle([480, 860, ave_right, 930], fill=road_fill)
    # 2. Road running North along the left of RJ Block:
    draw.rectangle([440, 480, 520, 930], fill=road_fill)
    # 3. Open Courtyard Plaza in front of SV Block:
    draw.rounded_rectangle([440, 460, 920, 820], radius=16, fill=asphalt_plaza)
    # White parking/perimeter line across SV courtyard
    draw.line([460, 780, 900, 780], fill=(220, 220, 220), width=3)

    # 4. Eastward Connector Pathway behind RJ Block (connecting to VR Block)
    # Runs from SV courtyard across north of RJ block (y=500 to 560) east to x=1580
    draw.rectangle([900, 500, 1600, 560], fill=(140, 148, 154))
    # North-South Road on East of VR Block
    draw.rectangle([1860, 240, 1940, 1100], fill=road_fill)
    draw.rectangle([1580, 500, 1940, 560], fill=road_fill)
    draw.rectangle([1580, 1020, 1940, 1080], fill=road_fill)

    # Road running North past SV Block to North Academic Block:
    draw.rectangle([440, 200, 520, 500], fill=road_fill)
    draw.rectangle([440, 200, 1860, 260], fill=road_fill)

    # 5. RMK MAIN ENTRANCE ARCH GATE
    gate_y = 1350
    # White classical arch gate structure
    draw.rounded_rectangle([1100, gate_y - 20, 1300, gate_y + 20], radius=8, fill=(255, 255, 255), outline=(160, 165, 170), width=3)
    # Arch gate pillars
    for gx in [1110, 1190, 1210, 1290]:
        draw.rectangle([gx - 10, gate_y - 25, gx + 10, gate_y + 25], fill=(240, 242, 245), outline=(140, 145, 150), width=2)
    # Gate Signboard
    draw.rounded_rectangle([1120, gate_y - 45, 1280, gate_y - 20], radius=4, fill=(18, 52, 102))
    draw.text((1200, gate_y - 33), "RMK MAIN GATE", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # 6. TREES & PALM AVENUE LINING
    def draw_palm(cx, cy, radius=18):
        # Shadow
        draw.ellipse([cx - radius + 4, cy - radius*0.7 + 6, cx + radius + 4, cy + radius*0.7 + 6], fill=(0, 0, 0, 40))
        # Outer fronds
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            fx = cx + int(math.cos(rad) * radius)
            fy = cy + int(math.sin(rad) * radius * 0.8)
            draw.line([cx, cy, fx, fy], fill=(42, 115, 48), width=3)
        # Inner crown
        draw.ellipse([cx - radius//2, cy - int(radius*0.4), cx + radius//2, cy + int(radius*0.4)], fill=(65, 150, 60))
        draw.ellipse([cx - radius//4, cy - int(radius*0.2), cx + radius//4, cy + int(radius*0.2)], fill=(90, 185, 75))

    def draw_tree_canopy(cx, cy, w, h):
        draw.ellipse([cx - w//2 + 4, cy - h//2 + 6, cx + w//2 + 4, cy + h//2 + 6], fill=(0, 0, 0, 35))
        draw.ellipse([cx - w//2, cy - h//2, cx + w//2, cy + h//2], fill=(50, 125, 55))
        draw.ellipse([cx - w//3, cy - h//3, cx + w//4, cy + h//4], fill=(75, 160, 70))

    # Lining the Central Palm Avenue (Left & Right)
    for py in range(930, 1340, 45):
        draw_palm(ave_left - 24, py, radius=16)
        draw_palm(ave_right + 24, py, radius=16)

    # Lush grove in central courtyard
    tree_coords = [
        (960, 600, 70, 60), (1030, 640, 65, 55), (1110, 590, 80, 70), (1180, 650, 75, 65),
        (1260, 610, 70, 60), (1330, 660, 80, 70), (1400, 600, 75, 65), (1470, 640, 70, 60),
        (980, 420, 65, 55), (1050, 460, 70, 60), (1140, 430, 75, 65), (1220, 470, 80, 70),
        (1300, 420, 70, 60), (1380, 460, 75, 65), (1450, 410, 65, 55),
        (960, 720, 65, 55), (1040, 760, 70, 60), (1120, 720, 75, 65), (1200, 770, 80, 70),
        (1280, 730, 75, 65), (1360, 770, 70, 60), (1440, 720, 65, 55)
    ]
    for tx, ty, tw, th in tree_coords:
        draw_tree_canopy(tx, ty, tw, th)

    # 7. DRAW BUILDINGS WITH ARCHITECTURAL DETAIL

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 1: RJ BLOCK (Foreground Center, Main Academic & Admin Block)
    # ════════════════════════════════════════════════════════════════════════
    # Symmetrical 3-section building (West Wing, Center Core, East Wing)
    # Coordinates: Center at x=1200, y=860
    rj_y_top = 800
    rj_y_bot = 890
    
    # 3D Shadow
    draw.rounded_rectangle([926, rj_y_top + 10, 1476, rj_y_bot + 14], radius=8, fill=(0, 0, 0, 60))
    # West Wing
    draw.rectangle([920, rj_y_top + 10, 1060, rj_y_bot], fill=(245, 246, 248), outline=(180, 185, 190), width=2)
    # Center Block (Stepped slightly forward and higher)
    draw.rectangle([1060, rj_y_top, 1340, rj_y_bot], fill=(255, 255, 255), outline=(170, 175, 180), width=3)
    # East Wing
    draw.rectangle([1340, rj_y_top + 10, 1480, rj_y_bot], fill=(245, 246, 248), outline=(180, 185, 190), width=2)

    # Flat Roof Parapet & Skylights
    draw.rectangle([930, rj_y_top + 18, 1050, rj_y_bot - 8], fill=(215, 218, 222), outline=(190, 195, 200), width=1)
    draw.rectangle([1070, rj_y_top + 8, 1330, rj_y_bot - 8], fill=(225, 228, 232), outline=(190, 195, 200), width=1)
    draw.rectangle([1350, rj_y_top + 18, 1470, rj_y_bot - 8], fill=(215, 218, 222), outline=(190, 195, 200), width=1)
    # Air conditioning / rooftop vent housings
    for rx in [970, 1010, 1120, 1160, 1240, 1280, 1380, 1420]:
        draw.rectangle([rx, rj_y_top + 25, rx + 18, rj_y_top + 38], fill=(160, 168, 175))

    # CRITICAL REAL ARCHITECTURAL DETAIL:
    # Orange/Terracotta Pitched Entrance Canopy/Portico at Ground Floor Center facing south!
    portico_x = 1200
    portico_w = 70
    portico_h = 32
    # Shadow
    draw.polygon([(portico_x - portico_w//2 + 3, rj_y_bot + 4),
                  (portico_x + 3, rj_y_bot + portico_h + 4),
                  (portico_x + portico_w//2 + 3, rj_y_bot + 4)], fill=(0, 0, 0, 70))
    # Triangular orange canopy
    draw.polygon([(portico_x - portico_w//2, rj_y_bot),
                  (portico_x, rj_y_bot + portico_h),
                  (portico_x + portico_w//2, rj_y_bot)], fill=(224, 112, 45), outline=(180, 80, 25))
    # White entrance pillars underneath canopy
    draw.rectangle([portico_x - 24, rj_y_bot, portico_x - 16, rj_y_bot + 14], fill=(255, 255, 255))
    draw.rectangle([portico_x + 16, rj_y_bot, portico_x + 24, rj_y_bot + 14], fill=(255, 255, 255))

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 2: SRINIVASA BLOCK (SV BLOCK & AUDITORIUM)
    # ════════════════════════════════════════════════════════════════════════
    # Large rectangular block running North-South, West of central courtyard
    # Coordinates: x=540 to 860, y=280 to 680
    sv_x1, sv_y1 = 560, 260
    sv_x2, sv_y2 = 880, 680

    # 3D Shadow
    draw.rounded_rectangle([sv_x1 + 10, sv_y1 + 12, sv_x2 + 10, sv_y2 + 12], radius=10, fill=(0, 0, 0, 60))
    # Main Silver-Grey ACP Composite Cladding Body
    draw.rounded_rectangle([sv_x1, sv_y1, sv_x2, sv_y2], radius=8, fill=(218, 224, 230), outline=(150, 160, 170), width=3)
    # Flat Roof Inset
    draw.rounded_rectangle([sv_x1 + 16, sv_y1 + 16, sv_x2 - 16, sv_y2 - 16], radius=6, fill=(235, 240, 245), outline=(185, 195, 205), width=2)
    # Blue Reflective Ribbon Glass Panels (Real photo detail)
    for gy in range(sv_y1 + 40, sv_y2 - 60, 70):
        # Left ribbon window
        draw.rectangle([sv_x1 + 25, gy, sv_x1 + 70, gy + 32], fill=(45, 105, 155), outline=(30, 75, 115), width=1)
        # Center auditorium acoustic ceiling section
        draw.rectangle([sv_x1 + 90, gy, sv_x2 - 90, gy + 32], fill=(225, 230, 236))
        # Right ribbon window
        draw.rectangle([sv_x2 - 70, gy, sv_x2 - 25, gy + 32], fill=(45, 105, 155), outline=(30, 75, 115), width=1)

    # South Facade Entrance Portico (facing open courtyard & chevron tent)
    draw.rectangle([(sv_x1 + sv_x2)//2 - 60, sv_y2 - 10, (sv_x1 + sv_x2)//2 + 60, sv_y2 + 15], fill=(180, 190, 200), outline=(120, 130, 140), width=2)

    # CRITICAL REAL SATELLITE DETAIL:
    # Black-and-White Chevron / Star-Patterned Event Canopy Tent in the SV Courtyard!
    tent_x1, tent_y1 = 520, 710
    tent_x2, tent_y2 = 620, 830
    # Tent Shadow
    draw.rectangle([tent_x1 + 6, tent_y1 + 8, tent_x2 + 6, tent_y2 + 8], fill=(0, 0, 0, 50))
    # Tent base
    draw.rectangle([tent_x1, tent_y1, tent_x2, tent_y2], fill=(255, 255, 255), outline=(40, 40, 40), width=2)
    # Distinctive Chevron / Zig-zag stripes (matching real satellite photo!)
    num_stripes = 6
    stripe_h = (tent_y2 - tent_y1) // num_stripes
    for i in range(num_stripes):
        sy = tent_y1 + i * stripe_h
        # Draw chevron peak
        pts = [
            (tent_x1, sy),
            ((tent_x1 + tent_x2)//2, sy + stripe_h//2),
            (tent_x2, sy),
            (tent_x2, sy + stripe_h//2),
            ((tent_x1 + tent_x2)//2, sy + stripe_h),
            (tent_x1, sy + stripe_h//2)
        ]
        if i % 2 == 0:
            draw.polygon(pts, fill=(35, 38, 42))
        else:
            draw.polygon(pts, fill=(245, 248, 250))
    # Tent label
    draw.rounded_rectangle([tent_x1 - 10, tent_y2 + 10, tent_x2 + 10, tent_y2 + 35], radius=4, fill=(30, 40, 50))
    draw.text(((tent_x1 + tent_x2)//2, tent_y2 + 22), "EVENT ACTIVITY TENT", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 3: VR BLOCK (Visvesvaraya Block)
    # ════════════════════════════════════════════════════════════════════════
    # Long academic building running North-South on the East, with a West T-wing
    # Coordinates: x=1660 to 1820, y=260 to 980
    vr_x1, vr_y1 = 1660, 260
    vr_x2, vr_y2 = 1800, 980
    wing_x1, wing_y1 = 1540, 580
    wing_x2, wing_y2 = 1660, 680

    # 3D Shadow
    draw.rounded_rectangle([vr_x1 + 10, vr_y1 + 12, vr_x2 + 10, vr_y2 + 12], radius=8, fill=(0, 0, 0, 60))
    draw.rounded_rectangle([wing_x1 + 8, wing_y1 + 10, wing_x2 + 8, wing_y2 + 10], radius=6, fill=(0, 0, 0, 60))
    # Main North-South Body
    draw.rounded_rectangle([vr_x1, vr_y1, vr_x2, vr_y2], radius=8, fill=(242, 238, 232), outline=(175, 170, 160), width=3)
    # Cross wing projecting west
    draw.rounded_rectangle([wing_x1, wing_y1, wing_x2, wing_y2], radius=6, fill=(242, 238, 232), outline=(175, 170, 160), width=2)
    # Flat Roof Inset
    draw.rounded_rectangle([vr_x1 + 12, vr_y1 + 12, vr_x2 - 12, vr_y2 - 12], radius=6, fill=(210, 205, 198), outline=(180, 175, 168), width=2)
    draw.rounded_rectangle([wing_x1 + 8, wing_y1 + 8, wing_x2, wing_y2 - 8], radius=4, fill=(210, 205, 198))
    # Skylights / Solar roof rows (visible in satellite photo!)
    for vy in range(vr_y1 + 35, vr_y2 - 35, 45):
        draw.rectangle([vr_x1 + 30, vy, vr_x2 - 30, vy + 22], fill=(165, 160, 155), outline=(145, 140, 135), width=1)

    # ════════════════════════════════════════════════════════════════════════
    # BUILDING 4: NORTH ACADEMIC BLOCK
    # ════════════════════════════════════════════════════════════════════════
    # Positioned at top center (y=160 to 220, x=960 to 1440)
    draw.rounded_rectangle([960 + 8, 150 + 10, 1440 + 8, 220 + 10], radius=8, fill=(0, 0, 0, 50))
    draw.rounded_rectangle([960, 150, 1440, 220], radius=8, fill=(235, 236, 240), outline=(170, 175, 180), width=2)
    draw.text((1200, 185), "NORTH ACADEMIC COMPLEX", fill=(100, 110, 120), font=f_badge, anchor="mm")

    # ════════════════════════════════════════════════════════════════════════
    # 8. STEP-BY-STEP DIRECTIONAL ROUTE (Glowing Navigation Arrows)
    # Exactly matching user's hand-drawn sketch and white aerial line!
    # ════════════════════════════════════════════════════════════════════════

    route_color = (220, 38, 38)      # Vibrant Red #DC2626
    route_halo = (254, 226, 226, 180) # Soft red glow

    def draw_route_arrow(p1, p2, width=8, arrow_len=24):
        # Line
        draw.line([p1, p2], fill=route_color, width=width)
        # Arrowhead at p2
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        dist = math.hypot(dx, dy)
        if dist < 1: return
        ux, uy = dx / dist, dy / dist
        # Perpendicular
        px, py = -uy, ux
        # Arrow points
        left = (p2[0] - ux * arrow_len + px * (arrow_len * 0.6), p2[1] - uy * arrow_len + py * (arrow_len * 0.6))
        right = (p2[0] - ux * arrow_len - px * (arrow_len * 0.6), p2[1] - uy * arrow_len - py * (arrow_len * 0.6))
        draw.polygon([p2, left, right], fill=route_color)

    # Step 1: Up Central Avenue from Main Gate to RJ Block Portico
    draw_route_arrow((1200, 1340), (1200, 940), width=9, arrow_len=26)

    # Step 2: In front of RJ Block, curve LEFT (West) around the West Wing
    draw_route_arrow((1200, 930), (480, 930), width=9, arrow_len=26)
    draw_route_arrow((480, 930), (480, 750), width=9, arrow_len=26)

    # Step 3: Turn right into SV Courtyard to Registration & Chevron Tent
    draw_route_arrow((480, 750), (660, 750), width=9, arrow_len=26)

    # Step 4: From SV Courtyard, cross behind RJ Block through Central Garden directly to VR Block
    draw_route_arrow((780, 680), (780, 530), width=8, arrow_len=24)
    draw_route_arrow((780, 530), (1640, 530), width=8, arrow_len=26)

    # Numbered step badge pills along route
    def draw_step_badge(cx, cy, step_num, step_title):
        # Badge circle
        r = 20
        draw.ellipse([cx - r + 3, cy - r + 3, cx + r + 3, cy + r + 3], fill=(0, 0, 0, 50))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(220, 38, 38), outline=(255, 255, 255), width=3)
        draw.text((cx, cy), str(step_num), fill=(255, 255, 255), font=f_step, anchor="mm")
        # Text label
        tw = int(draw.textlength(step_title, font=f_badge))
        draw.rounded_rectangle([cx - tw//2 - 10, cy + r + 6, cx + tw//2 + 10, cy + r + 28], radius=4, fill=(255, 255, 255, 240), outline=(200, 205, 210), width=1)
        draw.text((cx, cy + r + 17), step_title, fill=(30, 40, 50), font=f_badge, anchor="mm")

    draw_step_badge(1200, 1140, "1", "MAIN ENTRANCE ROUTE")
    draw_step_badge(840, 930, "2", "TURN LEFT TO SV BLOCK")
    draw_step_badge(700, 750, "3", "REGISTRATION & CHECK-IN")
    draw_step_badge(1220, 530, "4", "CENTRAL PATH TO VR BLOCK")

    # ════════════════════════════════════════════════════════════════════════
    # 9. HIGH-CONTRAST VENUE & PANEL CARDS (Crisp Floating Infoboxes)
    # ════════════════════════════════════════════════════════════════════════

    def draw_card(x, y, w, h, header_bg, title, subtitle, lines, badge_text=""):
        # Card shadow
        draw.rounded_rectangle([x + 6, y + 8, x + w + 6, y + h + 8], radius=12, fill=(0, 0, 0, 70))
        # Card body
        draw.rounded_rectangle([x, y, x + w, y + h], radius=12, fill=(255, 255, 255), outline=(210, 215, 220), width=2)
        # Header banner
        header_h = 60
        draw.rounded_rectangle([x, y, x + w, y + header_h], radius=12, fill=header_bg)
        draw.rectangle([x, y + header_h - 12, x + w, y + header_h], fill=header_bg) # Flatten bottom radius
        # Header title
        draw.text((x + 18, y + 20), title, fill=(255, 255, 255), font=f_block_title)
        if badge_text:
            bw = int(draw.textlength(badge_text, font=f_badge)) + 16
            draw.rounded_rectangle([x + w - bw - 16, y + 16, x + w - 16, y + 44], radius=6, fill=(255, 255, 255, 60))
            draw.text((x + w - bw//2 - 16, y + 30), badge_text, fill=(255, 255, 255), font=f_badge, anchor="mm")
        # Subtitle
        draw.text((x + 18, y + header_h + 16), subtitle, fill=(18, 52, 102), font=f_block_sub)
        # Body lines
        ly = y + header_h + 46
        for line in lines:
            draw.text((x + 18, ly), line, fill=(60, 70, 80), font=f_block_detail)
            ly += 25

    # CARD 1: RJ BLOCK
    rj_lines = [
        "• 1st Floor: Idea Lab I (P01) · Idea Lab II (P09)",
        "• 1st Floor: Co-Work Space (P04)",
        "• 1st Floor: Seminar Hall-A (P07) · Seminar Hall-B (P08)",
        "• 2nd Floor: Seminar Hall-A (P02) · Seminar Hall-B (P03)"
    ]
    draw_card(930, 680, 540, 200, (22, 101, 52), "RJ BLOCK", "7 PANELS · ACADEMIC & INNOVATION CORE", rj_lines, "PANELS 1, 2, 3, 4, 7, 8, 9")

    # CARD 2: SV BLOCK / SRINIVASA BLOCK
    sv_lines = [
        "• Ground Floor: Registration & Check-In Desk",
        "• Ground Floor: Event Activity & Waiting (Chevron Tent)",
        "• 1st Floor: Seminar Hall 1 (P13) · Seminar Hall 2 (P14)",
        "• 1st Floor: Seminar Hall 3 (P06)",
        "• Main Auditorium: Inauguration & Valedictory Ceremony"
    ]
    draw_card(60, 240, 480, 225, (30, 64, 175), "SV BLOCK (SRINIVASA)", "3 PANELS · AUDITORIUM & REGISTRATION", sv_lines, "PANELS 6, 13, 14")

    # CARD 3: VR BLOCK
    vr_lines = [
        "• Ground Floor: Ground Floor - A (P05) · Ground Floor - B (P10)",
        "• 1st Floor: First Floor - A (P11) · First Floor - B (P12)",
        "• 2nd Floor: Second Floor (P15)"
    ]
    draw_card(1820, 640, 520, 180, (194, 65, 12), "VR BLOCK", "5 PANELS · VISVESVARAYA BLOCK", vr_lines, "PANELS 5, 10, 11, 12, 15")

    # ════════════════════════════════════════════════════════════════════════
    # 10. INSTITUTIONAL HEADER & BRANDING
    # ════════════════════════════════════════════════════════════════════════
    # Top banner background
    draw.rounded_rectangle([40, 20, W - 40, 120], radius=16, fill=(15, 23, 42), outline=(30, 41, 59), width=2)
    # Top gold accent stripe
    draw.rounded_rectangle([40, 20, W - 40, 26], radius=4, fill=(234, 179, 8))
    # Title & Subtitle
    draw.text((70, 42), "RMK JUNIOR HACKATHON 2026", fill=(255, 255, 255), font=f_title)
    draw.text((70, 92), "OFFICIAL CAMPUS VENUE & JURY EVALUATION NAVIGATION MAP · RMKCET", fill=(148, 163, 184), font=f_subtitle)

    # North Indicator (Compass) on top right of header
    compass_x = W - 110
    compass_y = 70
    draw.ellipse([compass_x - 30, compass_y - 30, compass_x + 30, compass_y + 30], fill=(30, 41, 59), outline=(71, 85, 105), width=2)
    # North Arrow (Red & White)
    draw.polygon([(compass_x, compass_y - 24), (compass_x - 10, compass_y + 8), (compass_x, compass_y + 2)], fill=(239, 68, 68))
    draw.polygon([(compass_x, compass_y - 24), (compass_x + 10, compass_y + 8), (compass_x, compass_y + 2)], fill=(220, 38, 38))
    draw.polygon([(compass_x, compass_y + 24), (compass_x - 10, compass_y + 8), (compass_x, compass_y + 2)], fill=(203, 213, 225))
    draw.polygon([(compass_x, compass_y + 24), (compass_x + 10, compass_y + 8), (compass_x, compass_y + 2)], fill=(148, 163, 184))
    draw.text((compass_x, compass_y - 34), "N", fill=(239, 68, 68), font=f_badge, anchor="mb")

    # ════════════════════════════════════════════════════════════════════════
    # 11. BOTTOM LEGEND & QUICK GUIDE BAR
    # ════════════════════════════════════════════════════════════════════════
    draw.rounded_rectangle([40, 1530, W - 40, 1590], radius=10, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    legend_items = [
        ((22, 101, 52), "RJ Block (7 Panels: P01-P04, P07-P09)"),
        ((30, 64, 175), "SV Block (3 Panels: P06, P13, P14 & Auditorium)"),
        ((194, 65, 12), "VR Block (5 Panels: P05, P10-P12, P15)"),
        ((220, 38, 38), "Directional Walking & Vehicle Route"),
        ((35, 38, 42), "Chevron Activity Tent & Helpdesk")
    ]
    cur_lx = 70
    for col, txt in legend_items:
        draw.rounded_rectangle([cur_lx, 1550, cur_lx + 24, 1572], radius=4, fill=col)
        draw.text((cur_lx + 32, 1561), txt, fill=(51, 65, 85), font=f_legend, anchor="lm")
        cur_lx += int(draw.textlength(txt, font=f_legend)) + 65

    # Save outputs
    out_path = r"c:\Users\krish\Documents\RMK Engineering College\RMK Jr. hackathon\frontend\assets\campus_venue_map.jpg"
    img_rgb = img.convert("RGB")
    img_rgb.save(out_path, quality=95)
    print("Master campus navigation map saved successfully to:", out_path)

    # Also save to artifacts directory
    artifact_path = r"C:\Users\krish\.gemini\antigravity\brain\85886fa9-8576-486f-bb61-edd05d989cbf\rmk_master_campus_venue_map.jpg"
    img_rgb.save(artifact_path, quality=95)
    print("Artifact saved to:", artifact_path)

if __name__ == "__main__":
    create_campus_master_map()

