precision lowp float;
precision lowp int;
precision lowp sampler2DArray;

uniform sampler2DArray field;
uniform vec2 camArraySize;
uniform float aperture;
uniform float focus;
in vec2 vSt;
in vec2 vUv;

void main() {
    // Initialize color accumulation
    vec4 color = vec4(0.0);
    float colorCount = 0.0;

    // Visual grid for alignment - show thin grid lines at fixed intervals
    bool isGridLine = false;
    float gridSize = 0.1;
    if (mod(vUv.x, gridSize) < 0.002 || mod(vUv.y, gridSize) < 0.002) {
        isGridLine = true;
    }

    // Check if UVs are within bounds
    if (vUv.x < 0.0 || vUv.x > 1.0 || vUv.y < 0.0 || vUv.y > 1.0) {
        // Make out-of-bounds areas visible with a color (red) for debugging
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        return;
    }
    
    // Ensure some valid sampled pixels with a minimum aperture
    float effectiveAperture = max(1.0, aperture);

    // Sample from camera array based on aperture
    for (float i = 0.0; i < camArraySize.x; i++) {
        for (float j = 0.0; j < camArraySize.y; j++) {
            float dx = i - (vSt.x * camArraySize.x - 0.5);
            float dy = j - (vSt.y * camArraySize.y - 0.5);
            float sqDist = dx * dx + dy * dy;
            
            if (sqDist < effectiveAperture) {
                float camOff = i + camArraySize.x * j;
                vec2 focOff = vec2(dx, dy) * focus;
                
                // Sample with safe UV coordinates
                vec2 sampleUV = clamp(vUv + focOff, 0.01, 0.99);
                color += texture(field, vec3(sampleUV, camOff));
                colorCount++;
            }
        }
    }
    
    // Ensure we have at least one sample
    if (colorCount < 1.0) {
        // If no samples found, use center camera
        float centerI = floor(camArraySize.x / 2.0);
        float centerJ = floor(camArraySize.y / 2.0);
        float camOff = centerI + camArraySize.x * centerJ;
        color = texture(field, vec3(vUv, camOff));
        colorCount = 1.0;
    }
    
    // Output color with opacity, showing grid lines if enabled
    if (isGridLine) {
        // Mix in a blue grid for alignment
        gl_FragColor = vec4(mix(color.rgb / colorCount, vec3(0.0, 0.0, 1.0), 0.3), 1.0);
    } else {
        gl_FragColor = vec4(color.rgb / colorCount, 1.0);
    }
}
