import os
import torch
import torch.nn.functional as F
from torchvision.utils import save_image
from transformers import DPTForDepthEstimation, DPTImageProcessor
from PIL import Image
import time
import sys

# Add the current directory and subdirectories to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))

# Import our model
from model.AdaMPI import MPIPredictor
from utils.mpi.homography_sampler import HomographySample
from utils.utils import image_to_tensor, disparity_to_tensor
from utils.rendererBackbone import processMPIs, cropFOV, renderSingleFrame
from parameters import device

class VISTA_Q:
    def __init__(self, ckpt_path="adampiweight/adampi_32p.pth", height=256, width=256, 
                 input_fov=110, target_fov=85, crop_fov=False, temp_dir="temp_layers/"):
        """
        Initialize the VISTA_Q class for novel view synthesis.
        
        Args:
            ckpt_path (str): Path to the model checkpoint
            height (int): Height of the output image
            width (int): Width of the output image
            input_fov (int): Input field of view
            target_fov (int): Target field of view
            crop_fov (bool): Whether to crop the FOV
            temp_dir (str): Directory to store temporary MPI layers
        """
        # Convert relative paths to absolute paths based on the current module's directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if not os.path.isabs(ckpt_path):
            self.ckpt_path = os.path.join(current_dir, ckpt_path)
        else:
            self.ckpt_path = ckpt_path
            
        if not os.path.isabs(temp_dir):
            self.temp_dir = os.path.join(current_dir, temp_dir)
        else:
            self.temp_dir = temp_dir
            
        self.height = height
        self.width = width
        self.input_fov = input_fov
        self.target_fov = target_fov
        self.crop_fov = crop_fov
        self.model = None
        self.image = None
        self.disp = None
        
        # MPI components
        self.mpi_all_rgb_src = None
        self.mpi_all_sigma_src = None
        self.disparity_all_src = None
        self.k_src_inv = None
        self.k_tgt = None
        self.homography_sampler = None
        
        os.makedirs(self.temp_dir, exist_ok=True)
        
    def load_model(self):
        """Load the MPI prediction model and depth estimation model"""
        # Load depth estimation model
        self.depth_model = DPTForDepthEstimation.from_pretrained("Intel/dpt-hybrid-midas").to(device)
        self.image_processor = DPTImageProcessor.from_pretrained("Intel/dpt-hybrid-midas")
        
        # Load MPI model
        ckpt = torch.load(self.ckpt_path)
        self.model = MPIPredictor(
            width=self.width,
            height=self.height,
            num_planes=ckpt["num_planes"],
        )
        self.model.load_state_dict(ckpt["weight"])
        self.model = self.model.to(device)
        self.model = self.model.eval()
        
        print("Status: Models loaded successfully")
        return self
    
    def load_image(self, img_path, disp_path=None):
        """
        Load and process the input image and disparity map.
        
        Args:
            img_path (str): Path to the input image
            disp_path (str, optional): Path to the disparity map. If None, will generate using MiDaS
        """
        # Convert relative paths to absolute paths based on the current module's directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if not os.path.isabs(img_path):
            abs_img_path = os.path.join(current_dir, img_path)
            if os.path.exists(abs_img_path):
                img_path = abs_img_path
        
        if disp_path is not None and not os.path.isabs(disp_path):
            abs_disp_path = os.path.join(current_dir, disp_path)
            if os.path.exists(abs_disp_path):
                disp_path = abs_disp_path
                
        self.image = image_to_tensor(img_path).to(device)  # [1,3,h,w]
        
        if disp_path is not None:
            self.disp = disparity_to_tensor(disp_path).to(device)  # [1,1,h,w]
        else:
            # Use MiDaS to generate depth map
            with torch.no_grad():
                inputs = self.image_processor(images=Image.open(img_path), return_tensors="pt")
                midas_depth = self.depth_model(pixel_values=inputs['pixel_values'].to(device)).predicted_depth.unsqueeze(1)
                self.disp = midas_depth / torch.max(midas_depth)
        
        # Resize to target dimensions
        self.image = F.interpolate(self.image, size=(self.height, self.width), mode='bilinear', align_corners=True)
        self.disp = F.interpolate(self.disp, size=(self.height, self.width), mode='bilinear', align_corners=True)
        
        # Generate MPI layers after loading image
        self._generate_mpi_layers()
        
        print("Status: Image loaded and MPI layers generated")
        return self
    
    def _generate_mpi_layers(self):
        """Generate MPI layers from the loaded image and disparity map"""
        if self.model is None:
            raise ValueError("Model not loaded. Call load_model() first.")
        if self.image is None or self.disp is None:
            raise ValueError("Image not loaded. Call load_image() first.")
        
        # Set up camera intrinsics
        K = torch.tensor([
            [0.58, 0, 0.5],
            [0, 0.58, 0.5],
            [0, 0, 1]
        ]).to(device)
        K[0, :] *= self.width
        K[1, :] *= self.height
        K = K.unsqueeze(0)
        
        print("Status: Predicting MPIs")
        start_time = time.time()
        # Predict MPI planes
        with torch.no_grad():
            pred_mpi_planes, pred_mpi_disp = self.model(self.image, self.disp)  # [b,s,4,h,w]
        
        # Process MPIs for rendering
        self.mpi_all_rgb_src, self.mpi_all_sigma_src, self.disparity_all_src, self.k_src_inv, self.k_tgt, self.homography_sampler = processMPIs(
            self.image,
            pred_mpi_planes,
            pred_mpi_disp,
            K,
            K,
            self.temp_dir
        )
        end_time = time.time()
        print(f"Status: MPIs Prediction Complete\tTime: {end_time-start_time:.2f}s")
    
    def generate_view(self, x_offset=0, y_offset=0, z_offset=0, scale=1):
        """
        Generate a novel view based on camera pose offsets.
        
        Args:
            x_offset (float): Horizontal offset
            y_offset (float): Vertical offset
            z_offset (float): Depth offset
            scale (int): Scale factor for output image
            
        Returns:
            PIL.Image: Rendered novel view
        """
        if self.mpi_all_rgb_src is None:
            raise ValueError("MPI layers not generated. Call load_image() first.")
        
        # Create pose matrix
        pose = torch.eye(4).to(device)
        pose[0, 3] = x_offset
        pose[1, 3] = y_offset
        pose[2, 3] = z_offset
        
        # Render the frame
        img = renderSingleFrame(
            self.mpi_all_rgb_src, 
            self.mpi_all_sigma_src, 
            self.disparity_all_src, 
            pose, 
            self.k_src_inv, 
            self.k_tgt, 
            self.homography_sampler
        )
        
        # Resize if needed
        if scale != 1:
            newsize = (self.height * scale, self.width * scale)
            img = img.resize(newsize)
        
        # Crop FOV if needed
        if self.crop_fov:
            img = cropFOV(img, self.input_fov, self.target_fov)
            
        return img
    
    def save_mpi_layers(self, save_dir="saved_layers/"):
        """Save the generated MPI layers to disk"""
        os.makedirs(save_dir, exist_ok=True)
        
        torch.save(self.mpi_all_rgb_src, save_dir + 'mpi_all_rgb_src.pt')
        torch.save(self.mpi_all_sigma_src, save_dir + 'mpi_all_sigma_src.pt')
        torch.save(self.disparity_all_src, save_dir + 'disparity_all_src.pt')
        torch.save(self.k_src_inv, save_dir + 'k_src_inv.pt')
        torch.save(self.k_tgt, save_dir + 'k_tgt.pt')
        torch.save(self.homography_sampler, save_dir + 'homography_sampler.pt')
        
        print(f"Status: MPI layers saved to {save_dir}")
        
    def load_mpi_layers(self, load_dir="saved_layers/"):
        """Load pre-processed MPI layers from disk"""
        self.mpi_all_rgb_src = torch.load(load_dir + 'mpi_all_rgb_src.pt').to(device)
        self.mpi_all_sigma_src = torch.load(load_dir + 'mpi_all_sigma_src.pt').to(device)
        self.disparity_all_src = torch.load(load_dir + 'disparity_all_src.pt').to(device)
        self.k_src_inv = torch.load(load_dir + 'k_src_inv.pt').to(device)
        self.k_tgt = torch.load(load_dir + 'k_tgt.pt').to(device)
        old_homography_sampler = torch.load(load_dir + 'homography_sampler.pt')
        self.homography_sampler = HomographySample(
            old_homography_sampler.Height_tgt,
            old_homography_sampler.Width_tgt,
            device
        )
        print(f"Status: MPI layers loaded from {load_dir}")
        
        
# Usage example:
if __name__ == "__main__":
    # Initialize the VISTA_Q class
    vista = VISTA_Q(ckpt_path="adampiweight/adampi_32p.pth")
    
    # Load the model
    vista.load_model()
    
    # Load an image and generate MPI layers
    vista.load_image(img_path="sample_images/000013.png")
    
    # Generate a novel view
    novel_view = vista.generate_view(x_offset=0.01, y_offset=0, z_offset=0)
    novel_view.show()