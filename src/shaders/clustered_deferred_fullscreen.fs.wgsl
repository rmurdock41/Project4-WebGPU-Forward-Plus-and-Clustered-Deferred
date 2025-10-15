// TODO-3: implement the Clustered Deferred fullscreen fragment shader

// Similar to the Forward+ fragment shader, but with vertex information coming from the G-buffer instead.


@group(${bindGroup_scene}) @binding(0) var<uniform> camera: CameraUniforms;
@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(2) var<storage, read> clusterLights: array<ClusterLights>;


@group(${bindGroup_scene}) @binding(3) var gBufferPosition: texture_2d<f32>;
@group(${bindGroup_scene}) @binding(4) var gBufferNormal: texture_2d<f32>;
@group(${bindGroup_scene}) @binding(5) var gBufferAlbedo: texture_2d<f32>;

struct FragmentInput {
    @builtin(position) fragPos: vec4f,
    @location(0) uv: vec2f
}

@fragment
fn main(in: FragmentInput) -> @location(0) vec4f {
  
    let position = textureLoad(gBufferPosition, vec2i(in.fragPos.xy), 0).xyz;
    let normal = textureLoad(gBufferNormal, vec2i(in.fragPos.xy), 0).xyz;
    let albedo = textureLoad(gBufferAlbedo, vec2i(in.fragPos.xy), 0).rgb;
    
    let screenPos = in.fragPos.xy;
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
    
    let numLights = clusterLights[clusterIdx].count;
    
    var totalLightContrib = vec3f(0.0, 0.0, 0.0);
    
    for (var i = 0u; i < numLights; i++) {
        let lightIdx = clusterLights[clusterIdx].indices[i];
        let light = lightSet.lights[lightIdx];
        totalLightContrib += calculateLightContrib(light, position, normal);
    }
    
    let finalColor = albedo * totalLightContrib;
    
    return vec4f(finalColor, 1.0);
}