"""Rigenera l'intero catalogo Special e Super senza perdere gli altri personaggi."""
from pathlib import Path
import subprocess
import sys

folder=Path(__file__).resolve().parent
for script in ['import-arianna-specials.py','import-other-specials.py']:
    subprocess.run([sys.executable,str(folder/script),*sys.argv[1:]],check=True)
