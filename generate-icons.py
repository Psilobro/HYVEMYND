from PIL import Image
import os

def generate_app_icons(logo_path="www/assets/images/logo.png"):
    """Generate all required app icon sizes from a single logo.png"""
    
    if not os.path.exists(logo_path):
        print(f"Please add your logo as: {logo_path}")
        print("Recommended: 512x512 PNG with transparent background")
        return
    
    # Load the source logo
    logo = Image.open(logo_path)
    
    # Icon sizes needed for Android
    android_sizes = [
        (36, "ldpi"),
        (48, "mdpi"), 
        (72, "hdpi"),
        (96, "xhdpi"),
        (144, "xxhdpi"),
        (192, "xxxhdpi")
    ]
    
    # Create Android icon directory
    android_icon_dir = "android/app/src/main/res"
    
    for size, density in android_sizes:
        icon_dir = f"{android_icon_dir}/mipmap-{density}"
        os.makedirs(icon_dir, exist_ok=True)
        
        # Create padded version for adaptive icons (foreground needs padding)
        padded_size = int(size * 0.7)  # Logo takes 70% of space, 30% padding
        padding = (size - padded_size) // 2
        
        # Create transparent background for foreground layer
        foreground = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        logo_resized = logo.resize((padded_size, padded_size), Image.Resampling.LANCZOS)
        
        # Ensure logo has alpha channel for proper pasting
        if logo_resized.mode != 'RGBA':
            logo_resized = logo_resized.convert('RGBA')
        
        foreground.paste(logo_resized, (padding, padding), logo_resized)
        
        # Regular icons (full size)
        resized = logo.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(f"{icon_dir}/ic_launcher.png")
        resized.save(f"{icon_dir}/ic_launcher_round.png")
        
        # Foreground with padding for adaptive icons
        foreground.save(f"{icon_dir}/ic_launcher_foreground.png")
        
        print(f"✅ Generated {size}x{size} icons for {density}")
    
    # Generate favicon sizes
    favicon_sizes = [16, 32, 48, 64, 128, 256]
    for size in favicon_sizes:
        resized = logo.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(f"www/assets/images/favicon-{size}.png")
        print(f"✅ Generated favicon-{size}.png")
    
    print("\n🎉 All app icons generated!")
    print("📋 To use your own logo:")
    print("   1. Replace www/assets/images/logo.png with your 512x512 PNG")
    print("   2. Run: python generate-icons.py")
    print("   3. Rebuild Android: npx cap build android")

if __name__ == "__main__":
    generate_app_icons()