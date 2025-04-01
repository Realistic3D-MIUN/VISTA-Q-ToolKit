# Dataset Setup Guide for Stereo Images

### 1. Loading Data
Place the data (stereo images) for evaluation inside `./public/` directory.

### 2. Setup Config CSV
Generate the [./public/Test_Configs/Stereo_Test_Sequence.csv/](./../../public/Test_Configs/Stereo_Test_Sequence.csv), and [./public/Test_Configs/Mono_Train_Sequence.csv/](./../../public/Test_Configs/Stereo_Train_Sequence.csv)(used for user training) file with following parameters:-

* **sample_id**: Unique identification for the image
* **left_image_path**: Location of left eye image
* **right_image_path**: Location of right eye image
* **zoom_factor**: How far, close you want the image to appear in VR
* **presentation_time**: How long the image should be presented

Below is an example used in this repo:
| sample_id | left_image_path | right_image_path | zoom_factor | presentation_time |
|-----------|----------------|------------------|-------------|------------------|
| rose_1 | ./public/examples/images/stereo_images/flowers_left.png | ./public/examples/images/stereo_images/flowers_right.png | 0.4 | 5 |
| cycle | ./public/examples/images/stereo_images/cycle_left.png | ./public/examples/images/stereo_images/cycle_right.png | 0.5 | 5 |

### 4. Results

The results are saved in [public/Results/Stereo_Test_Results.csv](./../../public/Results/Stereo_Test_Results.csv)

Below is the example of results:

| testID | sample_id | rating | date_time |
|--------|-----------|---------|-----------|
| MG_VRTrain | cycle | 4 - Good | 2025-04-01T07:18:54.639Z |
| MG_VRTrain | rose_1 | 3 - Fair | 2025-04-01T07:18:54.639Z |
| MG28_VRTest | rose_1 | 3 - Fair | 2025-04-01T07:19:42.251Z |
| MG28_VRTest | food | 5 - Excellent | 2025-04-01T07:19:42.251Z |
| MG28_VRTest | fence | 2 - Poor | 2025-04-01T07:19:42.251Z |
| MG28_VRTest | cycle | 4 - Good | 2025-04-01T07:19:42.251Z |



