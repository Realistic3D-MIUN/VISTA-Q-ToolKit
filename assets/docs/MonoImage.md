# Dataset Setup Guide for Monocular Images

### 1. Loading Data
Place the data (monocular images) for evaluation inside `./public/` directory.

### 2. Setup Config CSV
Generate the [./public/Test_Configs/Mono_Test_Sequence.csv/](./../../public/Test_Configs/Mono_Test_Sequence.csv), and [./public/Test_Configs/Mono_Train_Sequence.csv/](./../../public/Test_Configs/Mono_Train_Sequence.csv)(used for user training) file with following parameters:-

* **sample_id**: Unique identification for the image
* **image_path**: Location of image
* **zoom_factor**: How far, close you want the image to appear in VR
* **presentation_time**: How long the image should be presented

Below is an example used in this repo:
| sample_id | image_path | zoom_factor | presentation_time |
|-----------|------------|-------------|------------------|
| banana | ./public/examples/images/mono_images/banana.jpeg | 0.4 | 5 |
| kitti | ./public/examples/images/mono_images/kitti.png | 0.4 | 5 |
| miun | ./public/examples/images/mono_images/miun.png | 0.5 | 5 |
| moon | ./public/examples/images/mono_images/moon.jpg | 0.6 | 5 |

### 4. Results

The results are saved in [public/Results/Mono_Test_Results.csv](./../../public/Results/Mono_Test_Results.csv)

Below is the example of results:

| testID | sample_id | rating | date_time |
|--------|-----------|---------|-----------|
| MG_VRTrain | banana | 4 - Good | 2023-12-01T07:18:54.639Z |
| MG_VRTrain | kitti | 3 - Fair | 2023-12-01T07:18:54.639Z |
| MG28_VRTest | banana | 3 - Fair | 2023-12-01T07:19:42.251Z |
| MG28_VRTest | miun | 5 - Excellent | 2023-12-01T07:19:42.251Z |
| MG28_VRTest | moon | 2 - Poor | 2023-12-01T07:19:42.251Z |




### 5. Switching from ACR to DSIS Scale
If you generate a single Image where you have compiled two images side by side for evaluation with DSIS Scale. You need to change the  [mono.html](./../../views/mono.html)

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