# VISTA-Q ToolKit: View Synthesis Method Visualizer

A comprehensive toolkit for evaluating Deep Learning-based view synthesis models in Quality of Experience (QoE) studies. This toolkit provides an intuitive interface for testing multiple models and collecting user ratings.

## Features

- Support for multiple view synthesis models
- Two interaction modes:
  - Mouse-based control
  - Face tracking control (using webcam)
- Automated test sequence execution
- Built-in rating collection system
- Results export in CSV format
- Modular model integration system

## Prerequisites

- Python 3.7 or higher
- Webcam (for face tracking mode)
- Sufficient disk space for models and test images

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/Realistic3D-MIUN/VISTA-Q-ToolKit.git
    ```

2. Navigate to the ViewSynthesis directory:
    ```bash
    cd VISTA-Q-ToolKit
    cd ViewSynthesis
    ```

3. Download the pre-compiled models:
    - Download [Models.zip](Will_Add_Later)
    - Extract the contents to the `/Models/` directory
    - This includes modified versions of [AdaMPI](https://github.com/yxuhan/AdaMPI) and [TMPI](https://github.com/facebookresearch/TMPI) models

4. Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Quick Start

Choose your preferred interaction mode:

### Mouse Control Mode
```bash
python VISTA_Q_ToolKit_MouseControl.py
```

### Face Tracking Mode
```bash
python VISTA_Q_ToolKit_FaceTracking.py
```

The toolkit will:
1. Load the test configuration from `./Test_Configs/ViewSynthesis_Test_Sequence.csv`
2. Execute the test sequence
3. Save results to `./Test_Results/ViewSynthesis_Results.csv`

## Model Integration Guide

### Directory Structure
```
/Models/
  /MyModel/
    /VISTA_Q.py      # Main interface file
    /model.py        # Model implementation
    /utils.py        # Utility functions
    /weights/        # Model weights
    ...
```

### Required Interface Implementation

Your `VISTA_Q.py` must implement the following interface:

```python
class VISTA_Q:
    def __init__(self):
        """Initialize the model"""
        pass
        
    def load_model(self):
        """Load model weights and prepare for inference"""
        return self
        
    def load_image(self, image_path):
        """Load and preprocess input image"""
        return self
        
    def generate_view(self, x, y, z=0, scale=1):
        """Generate novel view based on coordinates
        Args:
            x, y: View coordinates
            z: Optional depth parameter
            scale: Optional scaling factor
        Returns:
            PIL.Image: Generated view
        """
        return image
```

### Import Guidelines

1. Use standard Python imports:
   ```python
   from model import MyModel
   import utils
   ```

2. For file paths, use absolute paths:
   ```python
   import os
   module_dir = os.path.dirname(os.path.abspath(__file__))
   checkpoint_path = os.path.join(module_dir, "weights", "model.pth")
   ```

## Test Configuration

Configure your test sequence using a CSV file with the following format:

```csv
sample_id,image_path,model_folder,presentation_time
person_MyModel,./Images/person.jpg,./Models/MyModel/,10
landscape_AnotherModel,./Images/landscape.jpg,./Models/AnotherModel/,10
```

Fields:
- `sample_id`: Unique identifier for the test case
- `image_path`: Path to the input image
- `model_folder`: Directory containing the model
- `presentation_time`: Display duration in seconds

Example configuration file: `./Test_Configs/Test_Sequence.csv`

## User Interface

### Mouse Control Mode
- Use mouse movement to control view angles
- Click to capture ratings
- Press ESC to exit

### Face Tracking Mode
- Move your head to control view angles
- Look at rating buttons to select scores
- Press ESC to exit

## Troubleshooting

### Common Issues

1. Import Errors
   - Verify all dependencies are installed
   - Check model directory structure
   - Ensure proper path resolution

2. Model Loading Failures
   - Verify model weights are present
   - Check file permissions
   - Ensure sufficient memory

3. Face Tracking Issues
   - Check webcam connection (check device_id is correct, currently we have set it to `0` in the code)
   - Verify face is visible to camera
