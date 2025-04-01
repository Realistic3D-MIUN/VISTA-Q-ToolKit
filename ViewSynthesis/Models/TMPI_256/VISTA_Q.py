import os
import sys
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
import torchvision.transforms as transforms
import traceback
import OpenGL

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Import model components
from tmpi import TMPI
import config
from dpt_wrapper import DPTWrapper
from utils import imutils, utils

# Define device constant
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class VISTA_Q:
    def __init__(self, height=config.imgsz_max, width=config.imgsz_max):
        """
        Initialize the VISTA_Q class for TMPI_256.
        
        Args:
            height (int): Height of the rendered image
            width (int): Width of the rendered image
        """
        self.height = height
        self.width = width
        self.model = None
        self.renderer = None
        self.depth_estimator = None
        self.transform = transforms.Compose([
            transforms.Resize((self.height, self.width)),
            transforms.ToTensor()
        ])
        self.img_input = None
        self.img_depth = None
        self.mpi_data = None
        self.initial_pose = torch.eye(4)
        self._renderer_initialized = False
        
        # Setup model configuration
        self.setup_model_config()
        
    def setup_model_config(self):
        """Set up model-specific configurations"""
        self.num_planes = config.num_planes
        self.tilesz2w_ratio = config.tilesz2w_ratio
        self.tilesz_min = config.tilesz_min
        self.tilesz_max = config.tilesz_max
        self.padsz2tile_ratio = config.padsz2tile_ratio
        
        # Camera intrinsics matrix
        self.K = torch.tensor([
            [0.58, 0, 0.5],
            [0, 0.58, 0.5],
            [0, 0, 1]
        ]).unsqueeze(0)
        
    def load_model(self, checkpoint_path="./weights/mpti_04.pth"):
        """
        Load the TMPI model from a checkpoint.
        
        Args:
            checkpoint_path (str): Path to the model checkpoint
            
        Returns:
            bool: True if model loaded successfully
        """
        try:
            # Resolve checkpoint path relative to the current file
            if not os.path.isabs(checkpoint_path):
                module_dir = os.path.dirname(os.path.abspath(__file__))
                checkpoint_path = os.path.join(module_dir, checkpoint_path)
            
            print(f"Loading model from: {checkpoint_path}")
            
            # Initialize depth estimation model
            self.depth_estimator = DPTWrapper(model_path=os.path.join(current_dir, 'DPT/weights/dpt_hybrid-midas-501f0c75.pt'))
            
            # Initialize TMPI model - following predictImage.py approach
            base_model = TMPI(num_planes=self.num_planes)
            base_model = base_model.to(DEVICE).eval()
            
            # Use DataParallel if GPU available
            if torch.cuda.is_available() and torch.cuda.device_count() > 0:
                self.model = torch.nn.parallel.DataParallel(
                    base_model, 
                    device_ids=range(torch.cuda.device_count())
                )
            else:
                self.model = base_model
            
            # Load the model weights - directly load the entire model
            self.model.load_state_dict(torch.load(checkpoint_path, map_location=DEVICE))
            self.model.eval()  # Ensure model is in evaluation mode
            
            print("Status: Model Loaded!")
            return True
        except Exception as e:
            print(f"Error loading model: {str(e)}")
            traceback.print_exc()
            return False
    
    def load_image(self, image_path):
        """
        Load and preprocess an input image.
        
        Args:
            image_path (str): Path to the input image
            
        Returns:
            bool: True if image loaded successfully
        """
        try:
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image not found at {image_path}")
            
            # Load image using imutils from predictImage.py
            src_rgb = imutils.png2np(image_path).astype(np.float32)
            h, w = src_rgb.shape[:2]
            
            # Scale the image if too large
            if h >= w and h >= config.imgsz_max:
                h_scaled, w_scaled = config.imgsz_max, int(config.imgsz_max / h * w)
            elif w > h and w >= config.imgsz_max:
                h_scaled, w_scaled = int(config.imgsz_max / w * h), config.imgsz_max
            else:
                h_scaled, w_scaled = h, w
            
            self.img_input = F.interpolate(
                torch.from_numpy(src_rgb).permute(2, 0, 1).unsqueeze(0), 
                (h_scaled, w_scaled), 
                mode="bilinear"
            ).to(DEVICE)
            
            # Update camera intrinsics for the input image
            self.K = self.K.clone()
            self.K[:, 0, :] *= w_scaled
            self.K[:, 1, :] *= h_scaled
            
            # Estimate depth using DPT
            with torch.no_grad():
                self.img_depth = torch.from_numpy(
                    self.depth_estimator(self.img_input.squeeze().permute(1, 2, 0).cpu().numpy())
                ).unsqueeze(0).unsqueeze(0).to(DEVICE)
                
                # Normalize depth to [0, 1]
                self.img_depth = (self.img_depth - torch.min(self.img_depth)) / (torch.max(self.img_depth) - torch.min(self.img_depth))
            
            # Process the image and depth into tiles
            self._process_tiles()
            
            print(f"Image loaded successfully: {image_path}")
            return True
        except Exception as e:
            print(f"Error loading image: {str(e)}")
            traceback.print_exc()
            return False
    
    def _process_tiles(self):
        """Process the input image and depth into tiles for the TMPI model"""
        h, w = self.img_input.shape[-2:]
        
        # Calculate tile size based on image width
        tile_sz = int(np.clip(
            utils.next_power_of_two(self.tilesz2w_ratio * w - 1),
            a_min=self.tilesz_min, 
            a_max=self.tilesz_max
        ))
        pad_sz = int(tile_sz * self.padsz2tile_ratio)
        
        # Create tiles
        src_disp_tiles, src_rgb_tiles, K_tiles, sx, sy = self._create_tiles(
            self.img_depth, self.img_input, self.K, tile_sz, pad_sz
        )
        
        # Store tile data for later use
        self.tile_data = {
            "src_rgb_tiles": src_rgb_tiles.squeeze(0),
            "src_disp_tiles": src_disp_tiles.squeeze(0),
            "K": K_tiles.squeeze(0),
            "sx": sx.squeeze(0),
            "sy": sy.squeeze(0),
            "tile_sz": tile_sz,
            "pad_sz": pad_sz,
        }
        
        # Generate MPI representation
        with torch.no_grad():
            self.mpi_data, self.mpi_disp = self.model(
                src_rgb_tiles, 
                src_disp_tiles, 
                self.img_input, 
                self.img_depth
            )
    
    def _create_tiles(self, src_disp, src_rgb, K, tile_sz, pad_sz):
        """
        Create tiles from source depth and RGB images.
        
        Args:
            src_disp: Source disparity map
            src_rgb: Source RGB image
            K: Camera intrinsics matrix
            tile_sz: Tile size
            pad_sz: Padding size
            
        Returns:
            Tuple of (src_disp_tiles, src_rgb_tiles, K_tiles, sx, sy)
        """
        bs, _, h, w = src_disp.shape
        K_, sx_, sy_, dmap_, rgb_ = [], [], [], [], []

        sy = torch.arange(0, h, tile_sz - pad_sz)
        sx = torch.arange(0, w, tile_sz - pad_sz)

        src_disp = F.pad(src_disp, (0, tile_sz, 0, tile_sz), 'replicate') 
        src_rgb = F.pad(src_rgb, (0, tile_sz, 0, tile_sz), 'replicate') 

        K_, src_disp_, src_rgb_,  sx_, sy_ = [], [], [], [], []
        for y in sy:
            for x in sx:
                l, r, t, b = x, x + tile_sz, y, y + tile_sz
                Ki = K.clone()
                Ki[:, 0, 2] = Ki[:, 0, 2] - x
                Ki[:, 1, 2] = Ki[:, 1, 2] - y

                K_.append(Ki)
                src_disp_.append(src_disp[:, :, t:b, l:r])
                src_rgb_.append(src_rgb[:, :, t:b, l:r])
                sx_.append(x)
                sy_.append(y)

        src_rgb_ = torch.stack(src_rgb_, 1)
        src_disp_ = torch.stack(src_disp_, 1)
        K_ = torch.stack(K_, 1)
        sx_, sy_ = torch.tensor(sx_).unsqueeze(0).expand(bs, -1), torch.tensor(sy_).unsqueeze(0).expand(bs, -1)
        return src_disp_, src_rgb_, K_, sx_, sy_
    
    def _get_position_vector(self, x, y, z=0):
        """
        Convert x, y, z coordinates to camera position.
        
        Args:
            x (float): X coordinate (-0.1 to 0.1)
            y (float): Y coordinate (-0.1 to 0.1)
            z (float): Z coordinate (-0.1 to 0.1)
            
        Returns:
            torch.Tensor: Camera pose matrix
        """
        # Create camera pose matrix
        pose = torch.eye(4)
        pose[0, 3] = float(format(x, '.7f'))
        pose[1, 3] = float(format(y, '.7f'))
        pose[2, 3] = float(format(z, '.7f'))
        
        return pose.unsqueeze(0)
    
    def _initialize_renderer(self):
        """Initialize or reinitialize the OpenGL renderer"""
        from tmpi_renderer_gl import TMPIRendererGL
        import OpenGL.GL as gl
        
        # Clean up existing renderer if it exists
        if self.renderer is not None:
            try:
                self.renderer.cleanup()  # Assuming cleanup method exists in TMPIRendererGL
            except:
                pass
            self.renderer = None
        
        # Initialize new renderer
        OpenGL.ERROR_CHECKING = True
        h, w = self.img_input.shape[-2:]
        try:
            self.renderer = TMPIRendererGL(h, w)
            self._renderer_initialized = True
            # Clear any existing GL errors
            gl.glGetError()
        except Exception as e:
            print(f"Error initializing renderer: {str(e)}")
            self._renderer_initialized = False
            raise

    def generate_view(self, x, y, z=0, scale=1):
        """
        Generate a novel view based on the given camera position.
        
        Args:
            x (float): X coordinate (-0.1 to 0.1)
            y (float): Y coordinate (-0.1 to 0.1)
            z (float): Z coordinate (-0.1 to 0.1, default=0)
            scale (int): Scale factor for the output image size
            
        Returns:
            PIL.Image: Generated view as a PIL image
        """
        if self.model is None or self.img_input is None or self.mpi_data is None:
            raise RuntimeError("Model or input image not loaded. Call load_model() and load_image() first.")
            
        try:
            # Clamp coordinates to valid range
            x = max(-0.1, min(0.1, x))
            y = max(-0.1, min(0.1, y))
            z = max(-0.1, min(0.1, z))
            
            # Get camera pose for the desired viewpoint
            pose = self._get_position_vector(x, y, z)
            
            # Initialize or reinitialize renderer if needed
            if not self._renderer_initialized:
                self._initialize_renderer()
            
            # Render the new view
            with torch.no_grad():
                h, w = self.img_input.shape[-2:]
                print(f"Rendering view with dimensions: {h}x{w}")
                print(f"MPI data shape: {self.mpi_data.shape}")
                print(f"MPI disparity shape: {self.mpi_disp.shape}")
                
                # Ensure data is in the correct format
                mpi_data = self.mpi_data.cpu().contiguous()
                mpi_disp = self.mpi_disp.cpu().contiguous()
                pose = pose.cpu().contiguous()
                K = self.K.cpu().contiguous()
                sx = self.tile_data["sx"].cpu().contiguous()
                sy = self.tile_data["sy"].cpu().contiguous()
                
                try:
                    rendered_view = self.renderer(
                        mpi_data,
                        mpi_disp,
                        pose,
                        K,
                        sx,
                        sy
                    )
                except OpenGL.error.GLError as gl_error:
                    print("OpenGL error occurred, attempting to reinitialize renderer...")
                    self._renderer_initialized = False
                    self._initialize_renderer()
                    rendered_view = self.renderer(
                        mpi_data,
                        mpi_disp,
                        pose,
                        K,
                        sx,
                        sy
                    )
                
                # Convert numpy array to PIL image
                rendered_view = rendered_view[0]
                rendered_img = Image.fromarray(
                    (np.clip(rendered_view, 0, 1) * 255).astype(np.uint8)
                )
            
            # Resize if needed
            if scale != 1:
                rendered_img = rendered_img.resize(
                    (int(rendered_img.width * scale), int(rendered_img.height * scale)), 
                    Image.LANCZOS
                )
                
            return rendered_img
            
        except Exception as e:
            print(f"Error generating view: {str(e)}")
            traceback.print_exc()
            
            # Create a fallback error image
            error_img = Image.new('RGB', (self.width, self.height), color='red')
            return error_img

    def __del__(self):
        """Cleanup when the object is destroyed"""
        if self.renderer is not None:
            try:
                self.renderer.cleanup()  # Assuming cleanup method exists in TMPIRendererGL
            except:
                pass


# Example usage:
if __name__ == "__main__":
    # Create an instance
    vista = VISTA_Q()
    
    # Load model
    if vista.load_model():
        print("Model loaded successfully")
    
    # Load image
    if vista.load_image("./test_data/0001.jpg"):
        print("Image loaded successfully")
    
    # Generate a view
    novel_view = vista.generate_view(0, 0, 0)
    novel_view.show()
