# Dataset Setup Guide for Stereo Videos

### 1. Loading Data
Place the data (stereo videos) for evaluation inside `./public/` directory.

### 2. Setup Config CSV
Generate the [./public/Test_Configs/Stereo_Video_Test_Sequence.csv/](./../../public/Test_Configs/Stereo_Video_Test_Sequence.csv), and [./public/Test_Configs/Stereo_Video_Train_Sequence.csv/](./../../public/Test_Configs/Stereo_Video_Train_Sequence.csv)(used for user training) file with following parameters:-

* **sample_id**: Unique identification for the video
* **left_video_path**: Location of left eye video
* **right_video_path**: Location of right eye video
* **zoom_factor**: How far, close you want the video to appear in VR
* **presentation_time**: How long the video should be presented

Below is an example used in this repo:
| sample_id | left_video_path | right_video_path | zoom_factor | presentation_time |
|-----------|----------------|------------------|-------------|------------------|
| earth | ./public/examples/videos/stereo_videos/earth_left.mp4 | ./public/examples/videos/stereo_videos/earth_right.mp4 | 0.8 | 10 |
| spaceship | ./public/examples/videos/stereo_videos/ship_left.mp4 | ./public/examples/videos/stereo_videos/ship_right.mp4 | 0.8 | 10 |

### 4. Results

The results are saved in [public/Results/Stereo_Video_Test_Results.csv](./../../public/Results/Stereo_Video_Test_Results.csv)

Below is the example of results:

| testID | sample_id | rating | date_time |
|--------|-----------|---------|-----------|
| MG28_VRTrain | earth | 3 - Fair | 2025-04-01T07:20:30.677Z |
| MG28_VRTest | spaceship | 3 - Fair | 2025-04-01T07:21:21.333Z |
| MG28_VRTest | earth | 4 - Good | 2025-04-01T07:21:21.333Z |
| MG29_VRTest | spaceship | 4 - Good | 2025-04-01T07:22:43.313Z |
| MG29_VRTest | earth | 3 - Fair | 2025-04-01T07:22:43.313Z |
