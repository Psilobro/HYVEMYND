# HYVEMYND Capacitor Build Script
# Ensures WASM files are properly included in Android build

Write-Host "Building HYVEMYND for Android with WASM engine..."

# Ensure WASM files are in place
if (-not (Test-Path "www\js\nokamute.js")) {
    Write-Host "nokamute.js not found! Run wasm-pack build --target web --release in reference-ai-5 first"
    exit 1
}

if (-not (Test-Path "www\js\nokamute_bg.wasm")) {
    Write-Host "nokamute_bg.wasm not found! Run wasm-pack build --target web --release in reference-ai-5 first"
    exit 1
}

Write-Host "WASM files found"

# Copy assets to Android
Write-Host "Copying assets to Android..."
npx cap copy android

if ($LASTEXITCODE -eq 0) {
    Write-Host "Assets copied successfully"
    
    # Sync Capacitor plugins
    Write-Host "Syncing Capacitor plugins..."
    npx cap sync android
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Capacitor sync complete"
        
        # Build the Android APK
        Write-Host "Building Android APK..."
        npx cap build android
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Android build complete!"
            Write-Host "APK location: android\app\build\outputs\apk\"
        } else {
            Write-Host "Android build failed"
            exit 1
        }
    } else {
        Write-Host "Capacitor sync failed"
        exit 1
    }
} else {
    Write-Host "Asset copy failed"
    exit 1
}