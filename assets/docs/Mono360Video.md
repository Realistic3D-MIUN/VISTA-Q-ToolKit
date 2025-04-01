# Dataset Setup Guide for 360° Monocular Videos

### 1. Loading Data
Place the data (360° monocular videos) for evaluation inside `./public/` directory.

### 2. Setup Config CSV
Generate the [./public/Test_Configs/Mono_360_Video_Test_Sequence.csv/](./../../public/Test_Configs/Mono_360_Video_Test_Sequence.csv), and [./public/Test_Configs/Mono_360_Video_Train_Sequence.csv/](./../../public/Test_Configs/Mono_360_Video_Train_Sequence.csv)(used for user training) file with following parameters:-

* **sample_id**: Unique identification for the 360° video
* **video_path**: Location of 360° video file
* **zoom_factor**: How far, close you want the 360° video to appear in VR
* **presentation_time**: How long the 360° video should be presented

Below is an example used in this repo:
| sample_id | video_path | zoom_factor | presentation_time |
|-----------|------------|-------------|------------------|
| lab | ./public/examples/videos/mono_360_videos/lab_1.MP4 | 1 | 5 |
| outside_360 | ./public/examples/videos/mono_360_videos/Outside360.mp4 | 1 | 5 |

### 4. Results

The results are saved in [public/Results/Mono_360_Video_Test_Results.csv](./../../public/Results/Mono_360_Video_Test_Results.csv)

Below is the example of results:

| testID | sample_id | rating | date_time |
|--------|-----------|---------|-----------|
| MG28_VRTrain | lab | 4 - Good | 2024-01-15T14:26:30.431Z |
| MG28_VRTrain | outside_360 | 5 - Excellent | 2024-01-15T14:26:45.221Z |
| MG28_VRTest | lab | 3 - Fair | 2024-01-15T14:27:31.840Z |
| MG28_VRTest | outside_360 | 4 - Good | 2024-01-15T14:27:44.132Z |
