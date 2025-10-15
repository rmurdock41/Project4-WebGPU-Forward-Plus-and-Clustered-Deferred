// TODO-2: implement the Forward+ fragment shader

// See naive.fs.wgsl for basic fragment shader setup; this shader should use light clusters instead of looping over all lights

// ------------------------------------
// Shading process:
// ------------------------------------
// Determine which cluster contains the current fragment.
// Retrieve the number of lights that affect the current fragment from the cluster’s data.
// Initialize a variable to accumulate the total light contribution for the fragment.
// For each light in the cluster:
//     Access the light's properties using its index.
//     Calculate the contribution of the light based on its position, the fragment’s position, and the surface normal.
//     Add the calculated contribution to the total light accumulation.
// Multiply the fragment’s diffuse color by the accumulated light contribution.
// Return the final color, ensuring that the alpha component is set appropriately (typically to 1).

// TODO-2: implement the Forward+ fragment shader

@group(${bindGroup_scene}) @binding(0) var<uniform> camera: CameraUniforms;
@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(2) var<storage, read> clusterLights: array<ClusterLights>;

@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseSampler: sampler;

struct FragmentInput {
    @builtin(position) fragPos: vec4f,
    @location(0) pos: vec3f,
    @location(1) nor: vec3f,
    @location(2) uv: vec2f
}

@fragment
fn main(in: FragmentInput) -> @location(0) vec4f {
    let diffuseColor = textureSample(diffuseTex, diffuseSampler, in.uv);
    if (diffuseColor.a < 0.5) {
        discard;
    }

    let screenPos = in.fragPos.xy;
    let tileWidth = camera.screenWidth / f32(${clusterWidth});
    let tileHeight = camera.screenHeight / f32(${clusterHeight});
    
    let clusterX = u32(screenPos.x / tileWidth);
    let clusterY = u32(screenPos.y / tileHeight);
    
    let posView = (camera.viewMat * vec4f(in.pos, 1.0)).xyz;
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
        totalLightContrib += calculateLightContrib(light, in.pos, in.nor);
    }
    
    let finalColor = diffuseColor.rgb * totalLightContrib;
    
    return vec4f(finalColor, 1.0);
}