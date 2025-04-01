# Dataset Setup Guide for Monocular Videos

### 1. Loading Data
Place the data (monocular videos) for evaluation inside `./public/` directory.

### 2. Setup Config CSV
Generate the [./public/Test_Configs/Mono_Video_Test_Sequence.csv/](./../../public/Test_Configs/Mono_Video_Test_Sequence.csv), and [./public/Test_Configs/Mono_Video_Train_Sequence.csv/](./../../public/Test_Configs/Mono_Video_Train_Sequence.csv)(used for user training) file with following parameters:-

* **sample_id**: Unique identification for the video
* **video_path**: Location of video file
* **zoom_factor**: How far, close you want the video to appear in VR
* **presentation_time**: How long the video should be presented

Below is an example used in this repo:
| sample_id | video_path | zoom_factor | presentation_time |
|-----------|------------|-------------|------------------|
| moon_circle | ./public/examples/videos/mono_videos/moon_circle.mp4 | 0.4 | 2 |
| moon_dolly_zoom | ./public/examples/videos/mono_videos/moon_dolly-zoom-in.mp4 | 0.5 | 2 |
| moon_swing | ./public/examples/videos/mono_videos/moon_swing.mp4 | 0.6 | 1 |
| moon_zoom_in | ./public/examples/videos/mono_videos/moon_zoom-in.mp4 | 0.7 | 3 |

### 4. Results

The results are saved in [public/Results/Mono_Video_Test_Results.csv](./../../public/Results/Mono_Video_Test_Results.csv)

Below is the example of results:

| testID | sample_id | rating | date_time |
|--------|-----------|---------|-----------|
| MG28_VRTrain | moon_circle | 3 - Fair | 2025-04-01T07:24:34.050Z |
| MG28_VRTrain | moon_dolly_zoom | 3 - Fair | 2025-04-01T07:24:34.050Z |
| MG28_VRTest | moon_dolly_zoom | 3 - Fair | 2025-04-01T07:25:06.205Z |
| MG28_VRTest | moon_swing | 4 - Good | 2025-04-01T07:25:06.205Z |
| MG28_VRTest | moon_zoom_in | 5 - Excellent | 2025-04-01T07:25:06.205Z |
| MG28_VRTest | moon_circle | 3 - Fair | 2025-04-01T07:25:06.205Z |

### 5. Switching from ACR to DSIS Scale
If you generate a single Video where you have compiled two videos side by side for evaluation with DSIS Scale. You need to change the  [mono_video.html](./../../views/mono_video.html)

* For ACR Scale (Default)
    ```javascript
    fetch('/api/getACR_Scale/')
        .then(response => {
            if (!response.ok) {
            throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            ratings = data; // Update the ratings variable with the fetched data
            console.log('Updated ratings:', ratings);
        })
        .catch(error => {
            console.error('Error fetching rating scale:', error);
        });
    ```

* For DSIS Scale, change above block to
    ```javascript
    fetch('/api/getDSIS_Scale/')
        .then(response => {
            if (!response.ok) {
            throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            ratings = data; // Update the ratings variable with the fetched data
            console.log('Updated ratings:', ratings);
        })
        .catch(error => {
            console.error('Error fetching rating scale:', error);
        });
    ```
