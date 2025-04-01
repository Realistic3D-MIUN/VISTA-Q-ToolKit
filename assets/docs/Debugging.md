### SteamVR - OpenXR Related Issues with Three.js
Depending on your verison of SteamVR and the Browser, you might face issue with some tracking. If this happends you will not be able to run any of the [Three.js Examples](https://threejs.org/examples/?q=vr) as well.
Perform following actions in case of this issue

1. Close the Browser
2. Turn off the VR
3. Exit SteamVR
4. Open command prompt as admin and run following
```
"C:\Program Files (x86)\Steam\steamapps\common\SteamVR\bin\win64\vrpathreg.exe" set-default-runtime "C:\Program Files (x86)\Steam\steamapps\common\SteamVR"
```
5. Turn on VR
6. Start SteamVR
7. Open the browser and load the website again
