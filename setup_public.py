import os
import shutil
import urllib.request

os.makedirs('public/models', exist_ok=True)
os.makedirs('public/sample_images', exist_ok=True)

# Copy verified models
if os.path.exists('models/darshan_pothole.onnx'):
    shutil.copy('models/darshan_pothole.onnx', 'public/models/pothole_model.onnx')
    print("Copied pothole_model.onnx (4.74 MB)")

if os.path.exists('models/phongwit_rdd2022_detect.onnx'):
    shutil.copy('models/phongwit_rdd2022_detect.onnx', 'public/models/rdd_model.onnx')
    print("Copied rdd_model.onnx (10.1 MB)")

if os.path.exists('yolov8n.onnx'):
    shutil.copy('yolov8n.onnx', 'public/models/obstacle_model.onnx')
    print("Copied obstacle_model.onnx (12.3 MB)")

# Sample images list
sample_images = {
    'pothole_crater.jpg': 'https://huggingface.co/DarshanM0di/potholedetect/resolve/main/99b267afc3d05210c797fd45ae3f9302.jpg',
    'pothole_deep.jpg': 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=1000',
    'cracked_asphalt.jpg': 'https://images.unsplash.com/photo-1590496793929-36417d3117de?w=1000',
    'clean_highway.jpg': 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1000',
    'suburban_road.jpg': 'https://images.unsplash.com/photo-1498084393753-b411b2d26b34?w=1000',
    'road_obstacle.jpg': 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=1000'
}

for name, url in sample_images.items():
    dest = os.path.join('public/sample_images', name)
    if not os.path.exists(dest):
        print(f"Downloading sample image: {name}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp, open(dest, 'wb') as f:
                f.write(resp.read())
            print(f"Saved {name}")
        except Exception as e:
            print(f"Error downloading {name}: {e}")
    else:
        print(f"{name} already exists")

# Create a sample favicon
svg_favicon = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 19L10 3M14 3L20 19M7 13h10M12 8v3"/>
</svg>'''
with open('public/favicon.svg', 'w') as f:
    f.write(svg_favicon)

print("Setup public assets complete!")
