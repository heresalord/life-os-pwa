import math
from PIL import Image, ImageDraw, ImageFilter

def create_kairo_icon(size=512, maskable=False):
    # Render at 2x for smooth antialiased scaling
    canvas_size = size * 2
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = canvas_size / 2
    radius = canvas_size * 0.46

    # 1. Background
    if maskable:
        # Full bleed square for Android maskable icon
        bg = Image.new("RGBA", (canvas_size, canvas_size), (10, 10, 10, 255))
        # Warm ambient center glow
        glow = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        for r in range(int(canvas_size * 0.45), 0, -6):
            alpha = int(25 * (1 - r / (canvas_size * 0.45)))
            glow_draw.ellipse([center - r, center - r, center + r, center + r], fill=(196, 176, 141, alpha))
        glow = glow.filter(ImageFilter.GaussianBlur(15))
        bg.paste(glow, (0, 0), glow)
        img.paste(bg, (0, 0))
    else:
        # Squircle / rounded rect for standard PWA icon
        corner_radius = int(canvas_size * 0.22)
        bg = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        bg_draw = ImageDraw.Draw(bg)
        bg_draw.rounded_rectangle([8, 8, canvas_size - 8, canvas_size - 8], radius=corner_radius, fill=(10, 10, 10, 255))
        
        # Ambient center glow
        glow = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        for r in range(int(canvas_size * 0.4), 0, -6):
            alpha = int(22 * (1 - r / (canvas_size * 0.4)))
            glow_draw.ellipse([center - r, center - r, center + r, center + r], fill=(200, 184, 154, alpha))
        glow = glow.filter(ImageFilter.GaussianBlur(12))
        bg_draw.rounded_rectangle([8, 8, canvas_size - 8, canvas_size - 8], radius=corner_radius, outline=(255, 255, 255, 18), width=3)
        img = Image.alpha_composite(img, bg)
        img = Image.alpha_composite(img, glow)

    draw = ImageDraw.Draw(img)

    # 2. Kairos Celestial Moment Ring
    ring_cx = center + canvas_size * 0.06
    ring_cy = center
    ring_r = canvas_size * 0.28
    
    # Draw dashed ring
    num_dashes = 40
    for i in range(num_dashes):
        if i % 2 == 0:
            angle_start = (i / num_dashes) * 2 * math.pi
            angle_end = ((i + 0.6) / num_dashes) * 2 * math.pi
            steps = 8
            pts = []
            for s in range(steps + 1):
                a = angle_start + (angle_end - angle_start) * (s / steps)
                pts.append((ring_cx + ring_r * math.cos(a), ring_cy + ring_r * math.sin(a)))
            for j in range(len(pts) - 1):
                draw.line([pts[j], pts[j+1]], fill=(223, 207, 176, 90), width=4)

    # 3. Kairo Gold Glyph ("K")
    scale = canvas_size / 512.0

    # Vertical pillar: (144, 126) to (188, 386)
    pillar_x0 = 148 * scale
    pillar_y0 = 124 * scale
    pillar_x1 = 192 * scale
    pillar_y1 = 388 * scale
    pillar_radius = (pillar_x1 - pillar_x0) / 2

    # Draw vertical pillar with subtle gold vertical shading
    pillar_img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    p_draw = ImageDraw.Draw(pillar_img)
    p_draw.rounded_rectangle([pillar_x0, pillar_y0, pillar_x1, pillar_y1], radius=pillar_radius, fill=(216, 200, 168, 255))
    
    # Upper arm
    upper_poly = [
        (230 * scale, 256 * scale),
        (330 * scale, 142 * scale),
        (366 * scale, 174 * scale),
        (268 * scale, 286 * scale),
    ]
    p_draw.polygon(upper_poly, fill=(235, 222, 195, 255))
    # Round upper cap
    p_draw.circle((348 * scale, 158 * scale), radius=22 * scale, fill=(235, 222, 195, 255))

    # Lower arm
    lower_poly = [
        (238 * scale, 240 * scale),
        (342 * scale, 356 * scale),
        (308 * scale, 388 * scale),
        (204 * scale, 272 * scale),
    ]
    p_draw.polygon(lower_poly, fill=(204, 184, 148, 255))
    # Round lower cap
    p_draw.circle((325 * scale, 372 * scale), radius=22 * scale, fill=(204, 184, 148, 255))

    # Center junction smooth connection
    p_draw.circle((236 * scale, 256 * scale), radius=24 * scale, fill=(225, 210, 180, 255))

    # Drop shadow under the glyph
    shadow = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    offset_y = int(10 * scale)
    s_draw.rounded_rectangle([pillar_x0, pillar_y0 + offset_y, pillar_x1, pillar_y1 + offset_y], radius=pillar_radius, fill=(0, 0, 0, 140))
    s_draw.polygon([(x, y + offset_y) for x, y in upper_poly], fill=(0, 0, 0, 120))
    s_draw.polygon([(x, y + offset_y) for x, y in lower_poly], fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14 * scale))
    
    # Composite shadow then pillar
    img = Image.alpha_composite(img, shadow)
    img = Image.alpha_composite(img, pillar_img)

    # Core nexus spark
    spark_img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    sp_draw = ImageDraw.Draw(spark_img)
    sp_draw.circle((236 * scale, 256 * scale), radius=7 * scale, fill=(255, 255, 255, 230))
    img = Image.alpha_composite(img, spark_img)

    # Downsample to target size with high-quality LANCZOS filter
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

if __name__ == "__main__":
    icon_512 = create_kairo_icon(512, maskable=False)
    icon_512.save("public/icons/icon-512.png", "PNG")
    print("Saved public/icons/icon-512.png")

    icon_maskable = create_kairo_icon(512, maskable=True)
    icon_maskable.save("public/icons/icon-512-maskable.png", "PNG")
    print("Saved public/icons/icon-512-maskable.png")

    icon_192 = create_kairo_icon(192, maskable=False)
    icon_192.save("public/icons/icon-192.png", "PNG")
    print("Saved public/icons/icon-192.png")

    # Generate multi-size favicon.ico
    icon_48 = create_kairo_icon(48, maskable=False)
    icon_32 = create_kairo_icon(32, maskable=False)
    icon_16 = create_kairo_icon(16, maskable=False)
    icon_48.save("public/favicon.ico", format="ICO", sizes=[(48, 48), (32, 32), (16, 16)])
    print("Saved public/favicon.ico")
