"""
composite_definitive_sv_behind_rj_map.py
Composites the definitive 3D map where SV Block is DIRECTLY BEHIND RJ Block!
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

def build_map():
    base_img_path = r"C:\Users\krish\.gemini\antigravity\brain\85886fa9-8576-486f-bb61-edd05d989cbf\rmk_campus_isometric_view_1794566094935.jpg"
    base_img = Image.open(base_img_path).convert("RGBA")

    TARGET_W = 2064
    RENDER_H = 1152 # 1376 * 1.5, 768 * 1.5
    HEADER_H = 95
    FOOTER_H = 75
    TOTAL_H = HEADER_H + RENDER_H + FOOTER_H

    base_scaled = base_img.resize((TARGET_W, RENDER_H), Image.Resampling.LANCZOS)

    master = Image.new("RGBA", (TARGET_W, TOTAL_H), (15, 23, 42, 255))
    master.paste(base_scaled, (0, HEADER_H))

    draw = ImageDraw.Draw(master)

    SX = TARGET_W / 1376.0
    SY = RENDER_H / 768.0

    def pt(orig_x, orig_y):
        return (int(orig_x * SX), int(orig_y * SY) + HEADER_H)

    font_dir = r"C:\Windows\Fonts"
    f_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 38)
    f_subtitle = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 19)
    f_card_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 22)
    f_card_sub = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 15)
    f_card_detail = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 14)
    f_badge = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 14)
    f_badge_bold = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 15)
    f_step_num = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 17)
    f_legend = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 16)

    # 1. TOP HEADER BANNER
    draw.rectangle([0, 0, TARGET_W, HEADER_H], fill=(15, 23, 42))
    draw.rectangle([0, 0, TARGET_W, 5], fill=(234, 179, 8))
    draw.text((32, 16), "RMK JUNIOR HACKATHON 2026", fill=(255, 255, 255), font=f_title)
    draw.text((32, 58), "OFFICIAL CAMPUS VENUE & JURY EVALUATION NAVIGATION MAP · RMKCET", fill=(148, 163, 184), font=f_subtitle)

    # Compass
    cx, cy = TARGET_W - 65, 48
    draw.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(30, 41, 59), outline=(71, 85, 105), width=2)
    draw.polygon([(cx, cy - 19), (cx - 7, cy + 5), (cx, cy)], fill=(239, 68, 68))
    draw.polygon([(cx, cy - 19), (cx + 7, cy + 5), (cx, cy)], fill=(220, 38, 38))
    draw.polygon([(cx, cy + 19), (cx - 7, cy + 5), (cx, cy)], fill=(203, 213, 225))
    draw.polygon([(cx, cy + 19), (cx + 7, cy + 5), (cx, cy)], fill=(148, 163, 184))
    draw.text((cx, cy - 26), "N", fill=(239, 68, 68), font=f_badge, anchor="mb")

    # 2. DIRECTIONAL ROUTE ARROWS (Vibrant Red with White Outline)
    def draw_nav_arrow(p1, p2, width=6, arrow_size=18):
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

    # Route 1: From Main Gate up Central Avenue to RJ Block portico
    draw_nav_arrow(pt(740, 610), pt(740, 545), width=7, arrow_size=20)

    # Route 2: Loop LEFT in front of RJ Block around its west wing
    draw_nav_arrow(pt(730, 545), pt(425, 545), width=7, arrow_size=20)
    draw_nav_arrow(pt(425, 545), pt(425, 275), width=7, arrow_size=20)

    # Route 3: Turn right BEHIND RJ Block directly into SV Block & Chevron Tent Courtyard
    draw_nav_arrow(pt(425, 275), pt(630, 275), width=7, arrow_size=20)

    # Route 4: Elevated connector walkway from RJ/SV behind to VR Block
    draw_nav_arrow(pt(1030, 395), pt(1130, 395), width=6, arrow_size=18)

    # Step Badges
    def draw_step_badge(pos, num_str, title_str):
        x, y = pos
        r = 16
        draw.ellipse([x - r + 2, y - r + 3, x + r + 2, y + r + 3], fill=(0, 0, 0, 100))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(220, 38, 38), outline=(255, 255, 255), width=2)
        draw.text((x, y), num_str, fill=(255, 255, 255), font=f_step_num, anchor="mm")
        tw = int(draw.textlength(title_str, font=f_badge))
        draw.rounded_rectangle([x - tw//2 - 8, y + r + 4, x + tw//2 + 8, y + r + 24], radius=4, fill=(15, 23, 42, 235), outline=(255, 255, 255, 180), width=1)
        draw.text((x, y + r + 14), title_str, fill=(255, 255, 255), font=f_badge, anchor="mm")

    draw_step_badge(pt(740, 580), "1", "CENTRAL PALM AVENUE")
    draw_step_badge(pt(530, 545), "2", "TURN LEFT AROUND RJ BLOCK")
    draw_step_badge(pt(520, 275), "3", "SV BLOCK COURTYARD & REGISTRATION")
    draw_step_badge(pt(1080, 425), "4", "CORRIDOR PATH TO VR BLOCK")

    # 3. HIGH-CONTRAST VENUE CALLOUT CARDS
    def draw_overlay_card(x, y, w, h, header_bg, title, subtitle, lines, badge_text="", pin_pos=None):
        if pin_pos:
            draw.line([pin_pos, (x + w//2, y + h)], fill=(255, 255, 255), width=4)
            draw.line([pin_pos, (x + w//2, y + h)], fill=header_bg, width=2)
            draw.ellipse([pin_pos[0]-6, pin_pos[1]-6, pin_pos[0]+6, pin_pos[1]+6], fill=(220, 38, 38), outline=(255, 255, 255), width=2)

        draw.rounded_rectangle([x + 4, y + 6, x + w + 4, y + h + 6], radius=10, fill=(0, 0, 0, 130))
        draw.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=(255, 255, 255, 250), outline=(226, 232, 240), width=2)
        header_h = 42
        draw.rounded_rectangle([x, y, x + w, y + header_h], radius=10, fill=header_bg)
        draw.rectangle([x, y + header_h - 8, x + w, y + header_h], fill=header_bg)
        draw.text((x + 14, y + 11), title, fill=(255, 255, 255), font=f_card_title)
        
        if badge_text:
            bw = int(draw.textlength(badge_text, font=f_badge_bold)) + 16
            draw.rounded_rectangle([x + w - bw - 10, y + 7, x + w - 10, y + 35], radius=6, fill=(255, 255, 255))
            draw.text((x + w - bw//2 - 10, y + 21), badge_text, fill=header_bg, font=f_badge_bold, anchor="mm")

        draw.text((x + 14, y + header_h + 8), subtitle, fill=(15, 23, 42), font=f_card_sub)
        ly = y + header_h + 30
        for line in lines:
            draw.text((x + 14, ly), line, fill=(51, 65, 85), font=f_card_detail)
            ly += 19

    CARD_Y = HEADER_H + 15
    CARD_W = 460
    CARD_H = 175

    # CARD 1: SV BLOCK (DIRECTLY BEHIND RJ BLOCK!)
    sv_lines = [
        "• Position: DIRECTLY BEHIND RJ BLOCK",
        "• Ground Floor: Registration & Check-In Desk",
        "• Courtyard: Chevron Event Activity Tent",
        "• 1st Floor: Seminar Hall 1 (P13) · Seminar Hall 2 (P14)",
        "• 1st Floor: Seminar Hall 3 (P06)",
        "• Auditorium: Inauguration & Valedictory"
    ]
    draw_overlay_card(
        x=28, y=CARD_Y,
        w=CARD_W, h=CARD_H,
        header_bg=(30, 64, 175), # Royal Blue
        title="SV BLOCK (SRINIVASA)",
        subtitle="3 PANELS · AUDITORIUM & REGISTRATION",
        lines=sv_lines,
        badge_text="PANELS 6, 13, 14",
        pin_pos=pt(740, 100) # Pointer to SV Block directly behind RJ!
    )

    # CARD 2: RJ BLOCK (Foreground Center)
    rj_lines = [
        "• 1st Floor: Idea Lab I (P01) · Idea Lab II (P09)",
        "• 1st Floor: Co-Work Space (P04)",
        "• 1st Floor: Seminar Hall-A (P07) · Seminar Hall-B (P08)",
        "• 2nd Floor: Seminar Hall-A (P02) · Seminar Hall-B (P03)"
    ]
    draw_overlay_card(
        x=(TARGET_W - CARD_W) // 2, y=CARD_Y,
        w=CARD_W, h=CARD_H,
        header_bg=(22, 101, 52), # Forest Green
        title="RJ BLOCK",
        subtitle="7 PANELS · ACADEMIC & INNOVATION CORE",
        lines=rj_lines,
        badge_text="PANELS 1, 2, 3, 4, 7, 8, 9",
        pin_pos=pt(740, 440) # Pointer to RJ Block
    )

    # CARD 3: VR BLOCK (East / Right Side)
    vr_lines = [
        "• Ground Floor: Ground Floor - A (P05) · GF - B (P10)",
        "• 1st Floor: First Floor - A (P11) · FF - B (P12)",
        "• 2nd Floor: Second Floor (P15)"
    ]
    draw_overlay_card(
        x=TARGET_W - CARD_W - 28, y=CARD_Y,
        w=CARD_W, h=CARD_H,
        header_bg=(194, 65, 12), # Terracotta Orange
        title="VR BLOCK",
        subtitle="5 PANELS · VISVESVARAYA BLOCK",
        lines=vr_lines,
        badge_text="PANELS 5, 10, 11, 12, 15",
        pin_pos=pt(1160, 240) # Pointer to VR Block
    )

    # Chevron Tent Badge in the courtyard BETWEEN RJ and SV!
    tent_pin = pt(740, 270)
    draw.rounded_rectangle([tent_pin[0] - 130, tent_pin[1] - 38, tent_pin[0] + 130, tent_pin[1] - 12], radius=6, fill=(15, 23, 42, 235), outline=(255, 255, 255), width=2)
    draw.text((tent_pin[0], tent_pin[1] - 25), "CHEVRON ACTIVITY TENT", fill=(255, 255, 255), font=f_badge, anchor="mm")
    draw.line([tent_pin, (tent_pin[0], tent_pin[1] - 12)], fill=(255, 255, 255), width=2)
    draw.ellipse([tent_pin[0]-4, tent_pin[1]-4, tent_pin[0]+4, tent_pin[1]+4], fill=(220, 38, 38))

    # Main Gate Badge
    gate_pin = pt(740, 630)
    draw.rounded_rectangle([gate_pin[0] - 130, gate_pin[1] + 16, gate_pin[0] + 130, gate_pin[1] + 44], radius=6, fill=(15, 23, 42, 235), outline=(255, 255, 255), width=2)
    draw.text((gate_pin[0], gate_pin[1] + 30), "RMK MAIN ENTRANCE GATE", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # 4. BOTTOM LEGEND BAR
    footer_y = HEADER_H + RENDER_H
    draw.rectangle([0, footer_y, TARGET_W, TOTAL_H], fill=(15, 23, 42))
    draw.line([0, footer_y, TARGET_W, footer_y], fill=(51, 65, 85), width=2)

    legend_items = [
        ((22, 101, 52), "RJ Block (Foreground · Panels 1, 2, 3, 4, 7, 8, 9)"),
        ((30, 64, 175), "SV Block (Directly Behind RJ · Panels 6, 13, 14 & Auditorium)"),
        ((194, 65, 12), "VR Block (East Wing · Panels 5, 10, 11, 12, 15)"),
        ((220, 38, 38), "Road Loop (Around Left of RJ to SV behind)"),
        ((35, 38, 42), "Chevron Activity Tent & Courtyard")
    ]

    cur_lx = 40
    for col, txt in legend_items:
        draw.rounded_rectangle([cur_lx, footer_y + 26, cur_lx + 22, footer_y + 48], radius=4, fill=col, outline=(255, 255, 255, 120), width=1)
        draw.text((cur_lx + 30, footer_y + 37), txt, fill=(226, 232, 240), font=f_legend, anchor="lm")
        cur_lx += int(draw.textlength(txt, font=f_legend)) + 46

    # Save to frontend/assets/campus_venue_map.jpg
    out_path = r"frontend\assets\campus_venue_map.jpg"
    img_rgb = master.convert("RGB")
    img_rgb.save(out_path, quality=95)
    print("Master campus navigation map saved successfully to:", out_path)

    # Save to artifacts
    artifact_path = r"C:\Users\krish\.gemini\antigravity\brain\85886fa9-8576-486f-bb61-edd05d989cbf\rmk_final_sv_behind_rj_map.jpg"
    img_rgb.save(artifact_path, quality=95)
    print("Artifact saved to:", artifact_path)

if __name__ == "__main__":
    build_map()
