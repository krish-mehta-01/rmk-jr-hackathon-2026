"""
composite_master_3d_navigation_map.py
Takes the authentic 3D isometric render (rmk_campus_isometric_view_png_1794565323531.jpg)
and adds ultra-sharp institutional headers, directional navigation routes, building callout cards,
panel directories, and a clear legend.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

def build_composite_map():
    base_img_path = r"C:\Users\krish\.gemini\antigravity\brain\85886fa9-8576-486f-bb61-edd05d989cbf\rmk_campus_isometric_view_png_1794565323531.jpg"
    base_img = Image.open(base_img_path).convert("RGBA")

    # Target resolution: 2064 x 1320 (extra vertical canvas for header and legend bar)
    TARGET_W = 2064
    RENDER_H = 1152 # 1376 * 1.5 = 2064, 768 * 1.5 = 1152
    HEADER_H = 95
    FOOTER_H = 75
    TOTAL_H = HEADER_H + RENDER_H + FOOTER_H

    # Upscale base 3D render using high-quality Lanczos filter
    base_scaled = base_img.resize((TARGET_W, RENDER_H), Image.Resampling.LANCZOS)

    # Master canvas
    master = Image.new("RGBA", (TARGET_W, TOTAL_H), (15, 23, 42, 255))
    master.paste(base_scaled, (0, HEADER_H))

    draw = ImageDraw.Draw(master)

    # Scale factor from original 1376x768 to 2064x1152
    SX = TARGET_W / 1376.0
    SY = RENDER_H / 768.0

    def pt(orig_x, orig_y):
        return (int(orig_x * SX), int(orig_y * SY) + HEADER_H)

    # Fonts
    font_dir = r"C:\Windows\Fonts"
    f_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 38)
    f_subtitle = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 19)
    f_card_title = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 22)
    f_card_sub = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 16)
    f_card_detail = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 15)
    f_badge = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 14)
    f_badge_bold = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 15)
    f_step_num = ImageFont.truetype(os.path.join(font_dir, "arialbd.ttf"), 17)
    f_legend = ImageFont.truetype(os.path.join(font_dir, "arial.ttf"), 16)

    # ════════════════════════════════════════════════════════════════════════
    # 1. TOP HEADER BANNER
    # ════════════════════════════════════════════════════════════════════════
    draw.rectangle([0, 0, TARGET_W, HEADER_H], fill=(15, 23, 42))
    # Golden top border
    draw.rectangle([0, 0, TARGET_W, 5], fill=(234, 179, 8))
    # Title & Subtitle
    draw.text((32, 16), "RMK JUNIOR HACKATHON 2026", fill=(255, 255, 255), font=f_title)
    draw.text((32, 58), "OFFICIAL CAMPUS VENUE & JURY EVALUATION NAVIGATION MAP · RMKCET", fill=(148, 163, 184), font=f_subtitle)

    # North Compass on top right
    cx, cy = TARGET_W - 65, 48
    draw.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(30, 41, 59), outline=(71, 85, 105), width=2)
    draw.polygon([(cx, cy - 19), (cx - 7, cy + 5), (cx, cy)], fill=(239, 68, 68))
    draw.polygon([(cx, cy - 19), (cx + 7, cy + 5), (cx, cy)], fill=(220, 38, 38))
    draw.polygon([(cx, cy + 19), (cx - 7, cy + 5), (cx, cy)], fill=(203, 213, 225))
    draw.polygon([(cx, cy + 19), (cx + 7, cy + 5), (cx, cy)], fill=(148, 163, 184))
    draw.text((cx, cy - 26), "N", fill=(239, 68, 68), font=f_badge, anchor="mb")

    # ════════════════════════════════════════════════════════════════════════
    # 2. DIRECTIONAL NAVIGATION ROUTE ARROWS (Vibrant Red with White Border)
    # ════════════════════════════════════════════════════════════════════════
    def draw_nav_arrow(p1, p2, width=6, arrow_size=18):
        # White outer border for contrast
        draw.line([p1, p2], fill=(255, 255, 255), width=width + 4)
        draw.line([p1, p2], fill=(220, 38, 38), width=width)
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        dist = math.hypot(dx, dy)
        if dist < 1: return
        ux, uy = dx / dist, dy / dist
        px, py = -uy, ux
        left = (p2[0] - ux * arrow_size + px * (arrow_size * 0.55), p2[1] - uy * arrow_size + py * (arrow_size * 0.55))
        right = (p2[0] - ux * arrow_size - px * (arrow_size * 0.55), p2[1] - uy * arrow_size - py * (arrow_size * 0.55))
        # White border arrow
        draw.polygon([p2, left, right], fill=(255, 255, 255))
        inner_left = (p2[0] - ux * (arrow_size-3) + px * ((arrow_size-3) * 0.5), p2[1] - uy * (arrow_size-3) + py * ((arrow_size-3) * 0.5))
        inner_right = (p2[0] - ux * (arrow_size-3) - px * ((arrow_size-3) * 0.5), p2[1] - uy * (arrow_size-3) - py * ((arrow_size-3) * 0.5))
        draw.polygon([p2, inner_left, inner_right], fill=(220, 38, 38))

    # Route 1: Main Gate -> Up Central Palm Avenue to front of RJ Block portico
    draw_nav_arrow(pt(695, 600), pt(695, 435), width=7, arrow_size=20)

    # Route 2: Turn Left in front of RJ Block around to SV Block Courtyard
    draw_nav_arrow(pt(690, 435), pt(395, 435), width=7, arrow_size=20)
    draw_nav_arrow(pt(395, 435), pt(395, 340), width=7, arrow_size=20)
    draw_nav_arrow(pt(395, 340), pt(340, 340), width=7, arrow_size=20)

    # Route 3: Cross behind RJ Block through Central Garden to VR Block
    draw_nav_arrow(pt(535, 260), pt(535, 175), width=6, arrow_size=18)
    draw_nav_arrow(pt(535, 175), pt(1055, 175), width=6, arrow_size=18)

    # ════════════════════════════════════════════════════════════════════════
    # 3. NUMBERED STEP PILLS
    # ════════════════════════════════════════════════════════════════════════
    def draw_step_pill(pos, num_str, title_str):
        x, y = pos
        r = 16
        # Shadow
        draw.ellipse([x - r + 2, y - r + 3, x + r + 2, y + r + 3], fill=(0, 0, 0, 100))
        # Red circle with white border
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(220, 38, 38), outline=(255, 255, 255), width=2)
        draw.text((x, y), num_str, fill=(255, 255, 255), font=f_step_num, anchor="mm")
        # Text label pill
        tw = int(draw.textlength(title_str, font=f_badge))
        draw.rounded_rectangle([x - tw//2 - 8, y + r + 4, x + tw//2 + 8, y + r + 24], radius=4, fill=(15, 23, 42, 235), outline=(255, 255, 255, 180), width=1)
        draw.text((x, y + r + 14), title_str, fill=(255, 255, 255), font=f_badge, anchor="mm")

    draw_step_pill(pt(695, 520), "1", "MAIN PALM AVENUE")
    draw_step_pill(pt(470, 435), "2", "TURN LEFT TO SV BLOCK")
    draw_step_pill(pt(335, 360), "3", "REGISTRATION & CHEVRON TENT")
    draw_step_pill(pt(795, 175), "4", "CENTRAL GARDEN PATH TO VR BLOCK")

    # ════════════════════════════════════════════════════════════════════════
    # 4. PINPOINT CALLOUT CARDS (Clean Trio Across Top Baseline)
    # ════════════════════════════════════════════════════════════════════════
    def draw_overlay_card(x, y, w, h, header_bg, title, subtitle, lines, badge_text="", pin_pos=None):
        # Draw pointer line if pin_pos provided
        if pin_pos:
            draw.line([pin_pos, (x + w//2, y + h)], fill=(255, 255, 255), width=4)
            draw.line([pin_pos, (x + w//2, y + h)], fill=header_bg, width=2)
            draw.ellipse([pin_pos[0]-6, pin_pos[1]-6, pin_pos[0]+6, pin_pos[1]+6], fill=(220, 38, 38), outline=(255, 255, 255), width=2)

        # Card shadow
        draw.rounded_rectangle([x + 4, y + 6, x + w + 4, y + h + 6], radius=10, fill=(0, 0, 0, 130))
        # Card body
        draw.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=(255, 255, 255, 250), outline=(226, 232, 240), width=2)
        # Header banner
        header_h = 42
        draw.rounded_rectangle([x, y, x + w, y + header_h], radius=10, fill=header_bg)
        draw.rectangle([x, y + header_h - 8, x + w, y + header_h], fill=header_bg)
        # Header text
        draw.text((x + 14, y + 11), title, fill=(255, 255, 255), font=f_card_title)
        
        # Badge pill with high contrast (White pill, header_bg colored text)
        if badge_text:
            bw = int(draw.textlength(badge_text, font=f_badge_bold)) + 16
            draw.rounded_rectangle([x + w - bw - 10, y + 7, x + w - 10, y + 35], radius=6, fill=(255, 255, 255))
            draw.text((x + w - bw//2 - 10, y + 21), badge_text, fill=header_bg, font=f_badge_bold, anchor="mm")

        # Subtitle
        draw.text((x + 14, y + header_h + 9), subtitle, fill=(15, 23, 42), font=f_card_sub)
        # Detail lines
        ly = y + header_h + 33
        for line in lines:
            draw.text((x + 14, ly), line, fill=(51, 65, 85), font=f_card_detail)
            ly += 20

    # Top baseline for all three cards
    CARD_Y = HEADER_H + 15
    CARD_W = 460
    CARD_H = 175

    # CARD 1: SV BLOCK (Top Left)
    sv_lines = [
        "• Ground Floor: Registration & Check-In Desk",
        "• Ground Floor Plaza: Chevron Activity Tent",
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
        pin_pos=pt(360, 160)
    )

    # CARD 2: RJ BLOCK (Center Top)
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
        pin_pos=pt(705, 310)
    )

    # CARD 3: VR BLOCK (Top Right)
    vr_lines = [
        "• Ground Floor: Ground Floor - A (P05)",
        "• Ground Floor: Ground Floor - B (P10)",
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
        pin_pos=pt(1175, 230)
    )

    # CARD 4: CHEVRON TENT BADGE (SV Courtyard)
    tent_pin = pt(245, 320)
    draw.rounded_rectangle([tent_pin[0] - 120, tent_pin[1] - 38, tent_pin[0] + 120, tent_pin[1] - 12], radius=6, fill=(15, 23, 42, 235), outline=(255, 255, 255), width=2)
    draw.text((tent_pin[0], tent_pin[1] - 25), "CHEVRON ACTIVITY TENT", fill=(255, 255, 255), font=f_badge, anchor="mm")
    draw.line([tent_pin, (tent_pin[0], tent_pin[1] - 12)], fill=(255, 255, 255), width=2)
    draw.ellipse([tent_pin[0]-4, tent_pin[1]-4, tent_pin[0]+4, tent_pin[1]+4], fill=(220, 38, 38))

    # CARD 5: MAIN GATE BADGE (Bottom Center)
    gate_pin = pt(695, 615)
    draw.rounded_rectangle([gate_pin[0] - 130, gate_pin[1] + 16, gate_pin[0] + 130, gate_pin[1] + 44], radius=6, fill=(15, 23, 42, 235), outline=(255, 255, 255), width=2)
    draw.text((gate_pin[0], gate_pin[1] + 30), "RMK MAIN ENTRANCE GATE", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # ════════════════════════════════════════════════════════════════════════
    # 5. BOTTOM LEGEND BAR
    # ════════════════════════════════════════════════════════════════════════
    footer_y = HEADER_H + RENDER_H
    draw.rectangle([0, footer_y, TARGET_W, TOTAL_H], fill=(15, 23, 42))
    draw.line([0, footer_y, TARGET_W, footer_y], fill=(51, 65, 85), width=2)

    legend_items = [
        ((22, 101, 52), "RJ Block (Panels 1, 2, 3, 4, 7, 8, 9)"),
        ((30, 64, 175), "SV Block (Panels 6, 13, 14 & Auditorium)"),
        ((194, 65, 12), "VR Block (Panels 5, 10, 11, 12, 15)"),
        ((220, 38, 38), "Official Navigation Route"),
        ((35, 38, 42), "Chevron Activity Tent & Helpdesk"),
        ((100, 116, 139), "Bus & Visitor Parking Ground")
    ]

    cur_lx = 40
    for col, txt in legend_items:
        draw.rounded_rectangle([cur_lx, footer_y + 26, cur_lx + 22, footer_y + 48], radius=4, fill=col, outline=(255, 255, 255, 120), width=1)
        draw.text((cur_lx + 30, footer_y + 37), txt, fill=(226, 232, 240), font=f_legend, anchor="lm")
        cur_lx += int(draw.textlength(txt, font=f_legend)) + 50

    # Save outputs
    frontend_path = r"c:\Users\krish\Documents\RMK Engineering College\RMK Jr. hackathon\frontend\assets\campus_venue_map.jpg"
    img_rgb = master.convert("RGB")
    img_rgb.save(frontend_path, quality=95)
    print("Composited map saved successfully to:", frontend_path)

    # Save to artifacts directory
    artifact_path = r"C:\Users\krish\.gemini\antigravity\brain\85886fa9-8576-486f-bb61-edd05d989cbf\rmk_master_composite_navigation_map.jpg"
    img_rgb.save(artifact_path, quality=95)
    print("Artifact saved to:", artifact_path)

if __name__ == "__main__":
    build_composite_map()
