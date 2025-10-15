// CHECKITOUT: code that you add here will be prepended to all shaders

struct Light {
    pos: vec3f,
    color: vec3f
}

struct LightSet {
    numLights: u32,
    lights: array<Light>
}

// TODO-2: you may want to create a ClusterSet struct similar to LightSet

struct CameraUniforms { 

    viewProj: mat4x4<f32>,
    invProj: mat4x4<f32>, 
    screenWidth: f32,
    screenHeight: f32,
    nearPlane: f32,
    farPlane: f32,
    viewMat: mat4x4<f32>

    };

    struct ClusterParams {
    // u32 
    screenWidth  : u32,
    screenHeight : u32,
    tileSize     : u32,
    zSlices      : u32,

    // f32 
    nearPlane    : f32,
    farPlane     : f32,
    tanHalfFovY  : f32,
    aspect       : f32,

    maxLightsPerCluster : u32,
    _pad0 : u32,
    _pad1 : u32,
    _pad2 : u32,  
};


struct ClusterLights {
    count: u32,
    indices: array<u32, 1024>
}


fn clusterIndex(cx: u32, cy: u32, cz: u32, numTilesX: u32, numTilesY: u32) -> u32 {
    return (cz * numTilesY + cy) * numTilesX + cx;
}

// CHECKITOUT: this special attenuation function ensures lights don't affect geometry outside the maximum light radius
fn rangeAttenuation(distance: f32) -> f32 {
    return clamp(1.f - pow(distance / ${lightRadius}, 4.f), 0.f, 1.f) / (distance * distance);
}

fn calculateLightContrib(light: Light, posWorld: vec3f, nor: vec3f) -> vec3f {
    let vecToLight = light.pos - posWorld;
    let distToLight = length(vecToLight);

    let lambert = max(dot(nor, normalize(vecToLight)), 0.f);
    return light.color * lambert * rangeAttenuation(distToLight);
}
