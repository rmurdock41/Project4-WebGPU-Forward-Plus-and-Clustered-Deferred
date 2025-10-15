// TODO-2: implement the light clustering compute shader

// ------------------------------------
// Calculating cluster bounds:
// ------------------------------------
// For each cluster (X, Y, Z):
//     - Calculate the screen-space bounds for this cluster in 2D (XY).
//     - Calculate the depth bounds for this cluster in Z (near and far planes).
//     - Convert these screen and depth bounds into view-space coordinates.
//     - Store the computed bounding box (AABB) for the cluster.

// ------------------------------------
// Assigning lights to clusters:
// ------------------------------------
// For each cluster:
//     - Initialize a counter for the number of lights in this cluster.

//     For each light:
//         - Check if the light intersects with the cluster’s bounding box (AABB).
//         - If it does, add the light to the cluster's light list.
//         - Stop adding lights if the maximum number of lights is reached.

//     - Store the number of lights assigned to this cluster.
// TODO-2: implement the light clustering compute shader

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read> lightSet: LightSet;
@group(0) @binding(2) var<storage, read_write> clusterLights: array<ClusterLights>;

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    let clusterX = globalId.x;
    let clusterY = globalId.y;
    let clusterZ = globalId.z;
    
    if (clusterX >= ${clusterWidth} || clusterY >= ${clusterHeight} || clusterZ >= ${clusterDepth}) {
        return;
    }
    
    let clusterIdx = clusterIndex(clusterX, clusterY, clusterZ, ${clusterWidth}, ${clusterHeight});
    
    let screenMin = vec2f(
        f32(clusterX) * (camera.screenWidth / f32(${clusterWidth})),
        f32(clusterY) * (camera.screenHeight / f32(${clusterHeight}))
    );
    let screenMax = vec2f(
        f32(clusterX + 1) * (camera.screenWidth / f32(${clusterWidth})),
        f32(clusterY + 1) * (camera.screenHeight / f32(${clusterHeight}))
    );
    
    // to NDC（Y flip）
    let ndcMin = vec2f(
        (screenMin.x / camera.screenWidth) * 2.0 - 1.0,
        1.0 - (screenMax.y / camera.screenHeight) * 2.0
    );
    let ndcMax = vec2f(
        (screenMax.x / camera.screenWidth) * 2.0 - 1.0,
        1.0 - (screenMin.y / camera.screenHeight) * 2.0
    );
    

    let nearPlane = camera.nearPlane;
    let farPlane = camera.farPlane;
    let zNear = nearPlane * pow(farPlane / nearPlane, f32(clusterZ) / f32(${clusterDepth}));
    let zFar = nearPlane * pow(farPlane / nearPlane, f32(clusterZ + 1) / f32(${clusterDepth}));
    
    // NDC to View Space
    var viewMin = camera.invProj * vec4f(ndcMin, -1.0, 1.0);
    viewMin = viewMin / viewMin.w;
    var viewMax = camera.invProj * vec4f(ndcMax, -1.0, 1.0);
    viewMax = viewMax / viewMax.w;
    
    let minNear = viewMin.xyz * (zNear / -viewMin.z);
    let maxNear = viewMax.xyz * (zNear / -viewMax.z);
    let minFar = viewMin.xyz * (zFar / -viewMin.z);
    let maxFar = viewMax.xyz * (zFar / -viewMax.z);
    
    let aabbMin = min(min(minNear, maxNear), min(minFar, maxFar));
    let aabbMax = max(max(minNear, maxNear), max(minFar, maxFar));
    

    var lightCount = 0u;
    let lightRadius = f32(${lightRadius});
    
    for (var i = 0u; i < lightSet.numLights; i++) {
        let light = lightSet.lights[i];
        let lightPosView = (camera.viewMat * vec4f(light.pos, 1.0)).xyz;
        
        let closestPoint = clamp(lightPosView, aabbMin, aabbMax);
        let distSq = dot(lightPosView - closestPoint, lightPosView - closestPoint);
        
        if (distSq <= lightRadius * lightRadius) {
            if (lightCount < ${maxLightsPerCluster}) {
                clusterLights[clusterIdx].indices[lightCount] = i;
                lightCount++;
            }
        }
    }
    
    clusterLights[clusterIdx].count = lightCount;
}