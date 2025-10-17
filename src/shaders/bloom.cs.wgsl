// Bloom Compute Shader

// Bright pass: extract bright pixels
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var brightTexture: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn brightPass(@builtin(global_invocation_id) globalId: vec3u) {
    let texSize = textureDimensions(inputTexture);
    let coord = vec2i(globalId.xy);
    
    if (coord.x >= i32(texSize.x) || coord.y >= i32(texSize.y)) {
        return;
    }
    
    let color = textureLoad(inputTexture, coord, 0).rgb;
    let brightness = dot(color, vec3f(0.2126, 0.7152, 0.0722)); // Luminance
    
    // Threshold
    let threshold = f32(${bloomThreshold});
    if (brightness > threshold) {
        textureStore(brightTexture, coord, vec4f(color, 1.0));
    } else {
        textureStore(brightTexture, coord, vec4f(0.0, 0.0, 0.0, 1.0));
    }
}

// Horizontal blur pass
@group(0) @binding(0) var blurInputTexture: texture_2d<f32>;
@group(0) @binding(1) var blurOutputTexture: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn horizontalBlur(@builtin(global_invocation_id) globalId: vec3u) {
    let texSize = textureDimensions(blurInputTexture);
    let coord = vec2i(globalId.xy);
    
    if (coord.x >= i32(texSize.x) || coord.y >= i32(texSize.y)) {
        return;
    }
    
    // Simple box blur
    var color = vec3f(0.0);
    let radius = 4;
    var weightSum = 0.0;
    
    for (var i = -radius; i <= radius; i++) {
        let sampleCoord = coord + vec2i(i, 0);
        if (sampleCoord.x >= 0 && sampleCoord.x < i32(texSize.x)) {
            color += textureLoad(blurInputTexture, sampleCoord, 0).rgb;
            weightSum += 1.0;
        }
    }
    
    color /= weightSum;
    textureStore(blurOutputTexture, coord, vec4f(color, 1.0));
}

// Vertical blur pass
@compute @workgroup_size(8, 8)
fn verticalBlur(@builtin(global_invocation_id) globalId: vec3u) {
    let texSize = textureDimensions(blurInputTexture);
    let coord = vec2i(globalId.xy);
    
    if (coord.x >= i32(texSize.x) || coord.y >= i32(texSize.y)) {
        return;
    }
    
    // Simple box blur
    var color = vec3f(0.0);
    let radius = 4;
    var weightSum = 0.0;
    
    for (var i = -radius; i <= radius; i++) {
        let sampleCoord = coord + vec2i(0, i);
        if (sampleCoord.y >= 0 && sampleCoord.y < i32(texSize.y)) {
            color += textureLoad(blurInputTexture, sampleCoord, 0).rgb;
            weightSum += 1.0;
        }
    }
    
    color /= weightSum;
    textureStore(blurOutputTexture, coord, vec4f(color, 1.0));
}

// Composite pass: add bloom to original
@group(0) @binding(0) var originalTexture: texture_2d<f32>;
@group(0) @binding(1) var bloomTexture: texture_2d<f32>;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn composite(@builtin(global_invocation_id) globalId: vec3u) {
    let texSize = textureDimensions(originalTexture);
    let coord = vec2i(globalId.xy);
    
    if (coord.x >= i32(texSize.x) || coord.y >= i32(texSize.y)) {
        return;
    }
    
    let original = textureLoad(originalTexture, coord, 0).rgb;
    let bloom = textureLoad(bloomTexture, coord, 0).rgb;
    
    let finalColor = original + bloom * 0.5; // Blend bloom
    
    textureStore(outputTexture, coord, vec4f(finalColor, 1.0));
}