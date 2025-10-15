// TODO-3: implement the Clustered Deferred G-buffer fragment shader

// This shader should only store G-buffer information and should not do any shading.


@group(${bindGroup_model}) @binding(0) var<uniform> modelMat: mat4x4f;

@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseSampler: sampler;

struct FragmentInput {
    @builtin(position) fragPos: vec4f,
    @location(0) pos: vec3f,      
    @location(1) nor: vec3f,      
    @location(2) uv: vec2f
}

struct GBufferOutput {
    @location(0) position: vec4f,
    @location(1) normal: vec4f,
    @location(2) albedo: vec4f
}

@fragment
fn main(in: FragmentInput) -> GBufferOutput {
    var output: GBufferOutput;
    
   
    let albedo = textureSample(diffuseTex, diffuseSampler, in.uv);
    
    // Alpha test
    if (albedo.a < 0.5) {
        discard;
    }
    
  
    output.position = vec4f(in.pos, 1.0);
    output.normal = vec4f(normalize(in.nor), 1.0);
    output.albedo = vec4f(albedo.rgb, 1.0);
    
    return output;
}