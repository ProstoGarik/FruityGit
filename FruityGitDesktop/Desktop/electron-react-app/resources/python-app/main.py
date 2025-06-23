import sys
import zipfile
import pyflp
from pathlib import Path

def process_flp(flp_path):
    try:
        flp_path = Path(flp_path)
        project = pyflp.parse(flp_path)
        zip_path = flp_path.with_suffix('.zip')
      
        with zipfile.ZipFile(zip_path, 'w') as zp:
            zp.write(flp_path, arcname=flp_path.name)
            
            for sampler in project.channels.samplers:
                if sampler.sample_path is not None:
                    sample_path = Path(sampler.sample_path)
                    if sample_path.exists():
                        zp.write(sample_path, arcname=sample_path.name)
                    else:
                        print(f"Warning: Sample file not found - {sample_path}")
        
        print(f"Successfully created {zip_path}")
        return True
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script.py <path_to_flp>")
        sys.exit(1)
    
    flp_path = sys.argv[1]
    process_flp(flp_path)