#!/usr/bin/env python3
"""
SpotifyClone Installation Script
Automatically installs compatible dependencies for Python 3.13+
"""

import subprocess
import sys
import os
import platform

def run_command(command):
    """Run a command and return success status"""
    try:
        result = subprocess.run(command, shell=True, check=True, 
                              capture_output=True, text=True)
        print(f"✓ {command}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {command}")
        print(f"Error: {e.stderr}")
        return False

def install_dependencies():
    """Install Python dependencies with compatibility fixes"""
    print("🚀 Installing SpotifyClone dependencies...")
    print(f"Python version: {sys.version}")
    print(f"Platform: {platform.system()}")
    
    # Upgrade pip first
    print("\n📦 Upgrading pip...")
    run_command(f"{sys.executable} -m pip install --upgrade pip")
    
    # Install dependencies one by one with specific versions for Python 3.13
    dependencies = [
        # Core FastAPI with Python 3.13 support
        "fastapi==0.115.4",
        "uvicorn[standard]==0.32.0", 
        "python-multipart==0.0.12",
        "aiofiles==24.1.0",
        
        # Pydantic with Python 3.13 compatibility
        "pydantic==2.10.3",
        
        # YouTube functionality
        "youtube-search-python==1.6.6",
        "yt-dlp==2024.12.13",
        
        # Additional utilities
        "requests==2.32.3",
    ]
    
    print("\n📚 Installing Python packages...")
    failed_packages = []
    
    for package in dependencies:
        print(f"\nInstalling {package}...")
        if not run_command(f"{sys.executable} -m pip install {package}"):
            failed_packages.append(package)
    
    # Try alternative installation for failed packages
    if failed_packages:
        print("\n🔄 Retrying failed packages with alternative methods...")
        for package in failed_packages:
            package_name = package.split("==")[0]
            print(f"\nTrying latest version of {package_name}...")
            run_command(f"{sys.executable} -m pip install {package_name} --upgrade")
    
    print("\n✅ Dependency installation complete!")

def create_directories():
    """Create necessary directories"""
    print("\n📁 Creating directories...")
    directories = ["uploads", "static"]
    
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"✓ Created {directory}/")
        else:
            print(f"✓ {directory}/ already exists")

def verify_installation():
    """Verify that all packages are properly installed"""
    print("\n🔍 Verifying installation...")
    
    try:
        import fastapi
        print(f"✓ FastAPI {fastapi.__version__}")
    except ImportError:
        print("✗ FastAPI not installed")
        return False
    
    try:
        import uvicorn
        print(f"✓ Uvicorn {uvicorn.__version__}")
    except ImportError:
        print("✗ Uvicorn not installed")
        return False
    
    try:
        import pydantic
        print(f"✓ Pydantic {pydantic.__version__}")
    except ImportError:
        print("✗ Pydantic not installed")
        return False
    
    try:
        import youtubesearchpython
        print("✓ YouTube Search Python")
    except ImportError:
        print("⚠ YouTube Search Python not available (optional)")
    
    try:
        import yt_dlp
        print("✓ yt-dlp")
    except ImportError:
        print("⚠ yt-dlp not available (optional)")
    
    return True

def main():
    """Main installation process"""
    print("🎵 SpotifyClone Setup Script")
    print("=" * 40)
    
    # Install dependencies
    install_dependencies()
    
    # Create directories
    create_directories()
    
    # Verify installation
    if verify_installation():
        print("\n🎉 Installation successful!")
        print("\nNext steps:")
        print("1. Run the backend: python main.py")
        print("2. Run the frontend: python -m http.server 3000")
        print("3. Open: http://localhost:3000")
        print("\nEnjoy your music! 🎵")
    else:
        print("\n❌ Installation verification failed!")
        print("Please check the error messages above.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())