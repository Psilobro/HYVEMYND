const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateAppIcons(logoPath = 'www/assets/images/logo.png') {
    console.log('🎨 Generating app icons from', logoPath);
    
    if (!fs.existsSync(logoPath)) {
        console.error(`❌ Logo not found: ${logoPath}`);
        return;
    }
    
    try {
        // Android icon sizes
        const androidSizes = [
            { size: 36, density: 'ldpi' },
            { size: 48, density: 'mdpi' },
            { size: 72, density: 'hdpi' },
            { size: 96, density: 'xhdpi' },
            { size: 144, density: 'xxhdpi' },
            { size: 192, density: 'xxxhdpi' }
        ];
        
        // Generate Android icons
        for (const { size, density } of androidSizes) {
            const iconDir = `android/app/src/main/res/mipmap-${density}`;
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(iconDir)) {
                fs.mkdirSync(iconDir, { recursive: true });
            }
            
            // Generate regular icon
            await sharp(logoPath)
                .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png()
                .toFile(`${iconDir}/ic_launcher.png`);
                
            await sharp(logoPath)
                .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png()
                .toFile(`${iconDir}/ic_launcher_round.png`);
            
            // Generate foreground with padding for adaptive icons
            const paddedSize = Math.floor(size * 0.7);
            const padding = Math.floor((size - paddedSize) / 2);
            
            await sharp({
                create: {
                    width: size,
                    height: size,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            })
            .composite([{
                input: await sharp(logoPath)
                    .resize(paddedSize, paddedSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .png()
                    .toBuffer(),
                top: padding,
                left: padding
            }])
            .png()
            .toFile(`${iconDir}/ic_launcher_foreground.png`);
            
            console.log(`✅ Generated ${size}x${size} icons for ${density}`);
        }
        
        // Generate favicon sizes
        const faviconSizes = [16, 32, 48, 64, 128, 256];
        for (const size of faviconSizes) {
            await sharp(logoPath)
                .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png()
                .toFile(`www/assets/images/favicon-${size}.png`);
            console.log(`✅ Generated favicon-${size}.png`);
        }
        
        console.log('\n🎉 All app icons generated successfully!');
        
    } catch (error) {
        console.error('❌ Error generating icons:', error);
    }
}

// Run the icon generation
generateAppIcons();