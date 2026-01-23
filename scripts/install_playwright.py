#!/usr/bin/env python3
"""
Script para instalar los navegadores de Playwright (funciona en CI y local).
Ejecutar: python scripts/install_playwright.py
"""
import subprocess
import sys

try:
    # Usamos el modulo de la CLI integrada en Playwright
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "--with-deps"])
    print("Playwright browsers installed successfully.")
except subprocess.CalledProcessError as e:
    print("Error installing Playwright browsers:", e)
    sys.exit(1)
