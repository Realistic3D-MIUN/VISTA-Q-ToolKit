# Dataset Setup Guide for 360° Monocular Images

### 1. Loading Data
Place the data (360° monocular images) for evaluation inside `./public/` directory.

### 2. Setup Config CSV
Generate the [./public/Test_Configs/Mono_360_Test_Sequence.csv/](./../../public/Test_Configs/Mono_360_Test_Sequence.csv), and [./public/Test_Configs/Mono_360_Train_Sequence.csv/](./../../public/Test_Configs/Mono_360_Train_Sequence.csv)(used for user training) file with following parameters:-

* **sample_id**: Unique identification for the 360° image
* **image_path**: Location of 360° image
* **zoom_factor**: How far, close you want the 360° image to appear in VR
* **presentation_time**: How long the 360° image should be presented in seconds

Below is an example used in this repo:
| sample_id | image_path | zoom_factor | presentation_time |
|-----------|------------|-------------|------------------|
| 17_2.5K_F003 | ./public/examples/images/mono_360_images/f003.png | 1 | 10 |
| 18_2.5K_F005 | ./public/examples/images/mono_360_images/f005.png | 1 | 10 |

### 4. Results

The results are saved in [public/Results/Mono_360_Test_Results.csv](./../../public/Results/Mono_360_Test_Results.csv)

Below is the example of results:

| testID | sample_id | rating | date_time |
|--------|-----------|---------|-----------|
| MG28_VRTrain | 360_001 | 5 - Excellent | 2025-04-01T07:26:30.431Z |
| MG28_VRTrain | 360_002 | 5 - Excellent | 2025-04-01T07:26:30.431Z |
| MG28_VRTest | 360_001 | 5 - Excellent | 2025-04-01T07:27:31.840Z |
| MG28_VRTest | 360_002 | 5 - Excellent | 2025-04-01T07:27:44.132Z |
