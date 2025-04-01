# ModelVisualizer Integration Guide

This guide explains how to make your model compatible with the ModelVisualizer framework.

## Overview

The ModelVisualizer is a general purpose tool for visualizing and evaluating different models. To make your model compatible, you need to implement a specific interface in a file called `VISTA_Q.py` located in your model's directory.

## Requirements

Each model implementation must provide a `VISTA_Q.py` file with the following interface:

1. A `VISTA_Q` class with the following methods:
   - `__init__()`: Initialize your model
   - `load_model()`: Load model weights/parameters
   - `load_image()`: Load and preprocess an input image
   - `generate_view()`: Generate novel views based on camera position

## Template Usage

1. Copy the template file `VISTA_Q_template.py` to your model directory as `VISTA_Q.py`
2. Modify the template to implement your model's specific logic
3. Ensure that your implementation handles errors gracefully

## Common Issues and Best Practices

### Device Management

If your model uses PyTorch or TensorFlow, make sure all tensors are on the same device (CPU or GPU). The template includes helper methods for device management.

```python
# Example for PyTorch
self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
self.model.to(self.device)
tensor = tensor.to(self.device)
```

### Path Resolution

Use relative paths within your model's directory structure. The template includes a helper method to resolve checkpoint paths.

```python
# Example of correct path resolution
module_dir = os.path.dirname(os.path.abspath(__file__))
checkpoint_path = os.path.join(module_dir, "checkpoint", "checkpoint_best.pth")
```

### Error Handling

Always use try/except blocks to catch errors and provide meaningful fallbacks. This ensures the visualizer doesn't crash if your model encounters an issue.

```python
try:
    # Your code here
except Exception as e:
    print(f"Error: {str(e)}")
    # Provide a fallback
```

## Example Model Structure

```
Models/
└── MyModel/
    ├── VISTA_Q.py           # Interface implementation
    ├── model.py             # Your model definition
    ├── utils.py             # Utility functions
    └── checkpoint/
        └── checkpoint_best.pth  # Model weights
```

## Test Sequence CSV Format

The test sequence CSV file should have the following columns:
- `sample_id`: Unique identifier for the test sample
- `image_path`: Path to the input image
- `model_folder`: Path to the model directory containing VISTA_Q.py
- `presentation_time`: Time in seconds to display each visualization

Example:
```csv
sample_id,image_path,model_folder,presentation_time
person_MyModel,./Images/person.jpg,./Models/MyModel/,10
landscape_MyModel,./Images/landscape.jpg,./Models/MyModel/,10
``` 