# Dataset Setup Guide for Light Field

### 1. Loading Data
Place the data (light field images) for evaluation inside `./public/` directory.

### 2. Setup Config CSV
Generate the [./public/Test_Configs/Light_Field_Test_Sequence.csv/](./../../public/Test_Configs/Light_Field_Test_Sequence.csv), and [./public/Test_Configs/Light_Field_Train_Sequence.csv/](./../../public/Test_Configs/Light_Field_Train_Sequence.csv)(used for user training) file with following parameters:-

* **sample_id**: Unique identification for the image
* **lf_directory_path**: Directory path where the light field images are stored for a single scene
* **file_prefix**: Prefix of the image filenames
* **cam_horizontal**: Number of horizontal camera positions
* **cam_vertical**: Number of vertical camera positions  
* **image_width**: Width of each light field image in pixels
* **image_height**: Height of each light field image in pixels
* **zoom_factor**: How far/close you want the image to appear in VR
* **presentation_time**: How long the image should be presented in seconds

For a 9x9 LF, the filenames should look like this after the prefix:-
```
0_0.png
0_1.png
.
.
0_8.png
1_0.png
.
.
1_8.png
.......
8_8.png
```


Below is an example used in this repo, wehre we setup for a LF of resolution `9x9x512x512`:
| sample_id | lf_directory_path | file_prefix | cam_horizontal | cam_vertical | image_width | image_height | zoom_factor | presentation_time |
|-----------|------------------|--------------|----------------|--------------|-------------|--------------|-------------|------------------|
| bag | ./public/examples/images/light_field_images/sample_19/ | 19_image_ | 9 | 9 | 512 | 512 | 1 | 15 |
| plant | ./public/examples/images/light_field_images/sample_20/ | 20_image_ | 9 | 9 | 512 | 512 | 0.5 | 15 |
| box | ./public/examples/images/light_field_images/sample_22/ | 22_image_ | 9 | 9 | 512 | 512 | 1 | 15 |

### 4. Results

The results are saved in [public/Results/Stereo_Test_Results.csv](./../../public/Results/Light_Field_Test_Results.csv)

Below is the example of results:

| testID | sample_id | rating | date_time |
|--------|-----------|---------|-----------|
| MG_VRTrain | bag | 4 - Good | 2023-12-01T07:18:54.639Z |
| MG_VRTrain | plant | 3 - Fair | 2023-12-01T07:18:54.639Z |
| MG28_VRTest | bag | 3 - Fair | 2023-12-01T07:19:42.251Z |
| MG28_VRTest | plant | 5 - Excellent | 2023-12-01T07:19:42.251Z |
| MG28_VRTest | box | 2 - Poor | 2023-12-01T07:19:42.251Z |



