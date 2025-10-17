// Clustered Deferred Fullscreen Compute Shader
@group(${bindGroup_scene}) @binding(0) var<uniform> camera: CameraUniforms;
@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(2) var<storage, read> clusterLights: array<ClusterLights>;
@group(${bindGroup_scene}) @binding(3) var gBufferPosition: texture_2d<f32>;
@group(${bindGroup_scene}) @binding(4) var gBufferNormal: texture_2d<f32>;
@group(${bindGroup_scene}) @binding(5) var gBufferAlbedo: texture_2d<f32>;
@group(${bindGroup_scene}) @binding(6) var outputTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    let screenSize = textureDimensions(gBufferPosition);
    let pixelCoord = vec2i(globalId.xy);
    
    // Bounds check
    if (pixelCoord.x >= i32(screenSize.x) || pixelCoord.y >= i32(screenSize.y)) {
        return;
    }
    
    // Read G-buffer
    let position = textureLoad(gBufferPosition, pixelCoord, 0).xyz;
    let normal = textureLoad(gBufferNormal, pixelCoord, 0).xyz;
    let albedo = textureLoad(gBufferAlbedo, pixelCoord, 0).rgb;
    
    // Calculate cluster index
    let screenPos = vec2f(f32(pixelCoord.x), f32(pixelCoord.y));
    let tileWidth = camera.screenWidth / f32(${clusterWidth});
    let tileHeight = camera.screenHeight / f32(${clusterHeight});
    
    let clusterX = u32(screenPos.x / tileWidth);
    let clusterY = u32(screenPos.y / tileHeight);
    
    let posView = (camera.viewMat * vec4f(position, 1.0)).xyz;
    let viewZ = -posView.z;
    
    let nearPlane = camera.nearPlane;
    let farPlane = camera.farPlane;
    
    var clusterZ = u32(
        log(viewZ / nearPlane) / log(farPlane / nearPlane) * f32(${clusterDepth})
    );
    clusterZ = clamp(clusterZ, 0u, ${clusterDepth} - 1u);
    
    let clusterIdx = clusterIndex(clusterX, clusterY, clusterZ, ${clusterWidth}, ${clusterHeight});
    
    // Lighting calculation
    let numLights = clusterLights[clusterIdx].count;
    
    var totalLightContrib = vec3f(0.0, 0.0, 0.0);
    
    for (var i = 0u; i < numLights; i++) {
        let lightIdx = clusterLights[clusterIdx].indices[i];
        let light = lightSet.lights[lightIdx];
        totalLightContrib += calculateLightContrib(light, position, normal);
    }
    
    let finalColor = albedo * totalLightContrib;
    
    // Write to output texture
    textureStore(outputTexture, pixelCoord, vec4f(finalColor, 1.0));
}